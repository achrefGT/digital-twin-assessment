import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Calendar,
  BarChart3,
  BarChart,
  CheckCircle,
  Clock,
  AlertCircle,
  Target,
  TrendingUp,
  MoreVertical,
  Eye,
  Check,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/auth';
import {
  AssessmentAPI,
  Assessment,
  assessmentKeys,
  assessmentQueries
} from '@/services/assessmentApi';
import { useAssessment } from '@/hooks/useAssessment';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useToast } from '@/hooks/use-toast';

interface AssessmentsListProps {
  onSelectAssessment: (assessment: Assessment) => void;
  currentAssessmentId?: string;
}

const isCompleted = (status?: string) => {
  if (!status) return false
  const s = status.toUpperCase()
  return s === 'COMPLETED' || s === 'ALL_COMPLETE'
}

const isInProgress = (status?: string) => {
  if (!status) return false
  const s = status.toUpperCase()
  return s === 'STARTED' || 
         s === 'PROCESSING' || 
         s.includes('_COMPLETE') || // This will catch RESILIENCE_COMPLETE, etc.
         (s.includes('COMPLETE') && !isCompleted(status))
}

// Local storage cleanup utility (kept as-is)
const cleanupAssessmentFromLocalStorage = (assessmentId: string) => {
  const STORAGE_KEYS = {
    CURRENT_ASSESSMENT: 'currentAssessment',
    LAST_ASSESSMENT_ID: 'lastAssessmentId',
    ASSESSMENT_PROGRESS: 'assessmentProgress',
    DOMAIN_DATA: 'domainData'
  };

  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ASSESSMENT);
    localStorage.removeItem(STORAGE_KEYS.LAST_ASSESSMENT_ID);
    localStorage.removeItem(`${STORAGE_KEYS.ASSESSMENT_PROGRESS}_${assessmentId}`);
    localStorage.removeItem(`${STORAGE_KEYS.DOMAIN_DATA}_${assessmentId}`);

    if ((window as any).__currentAssessmentId__ === assessmentId) {
      (window as any).__currentAssessmentId__ = null;
    }

    console.debug(`[LocalStorage] Cleaned up data for assessment: ${assessmentId}`);
  } catch (error) {
    console.error(`[LocalStorage] Failed to cleanup assessment ${assessmentId}:`, error);
  }
};

// Small helper: derive simplified status category to style consistently
const getStatusCategory = (status?: string) => {
  if (!status) return 'unknown';
  const s = status.toUpperCase();
  if (s === 'COMPLETED' || s === 'ALL_COMPLETE') return 'completed';
  if (s === 'FAILED') return 'failed';
  if (s === 'STARTED') return 'started';
  // statuses that are actively being worked on: PROCESSING or any *_COMPLETE except ALL_COMPLETE/COMPLETED
  if (s.includes('PROCESS') || (s.includes('COMPLETE') && s !== 'COMPLETED' && s !== 'ALL_COMPLETE')) return 'in-progress';
  return 'other';
};

// A compact status pill component so styling is consistent and accessible
function StatusPill({ status }: { status?: string }) {
  const category = getStatusCategory(status);
  const statusLabelMap: Record<string, string> = {
    'completed': 'Completed',
    'in-progress': 'In Progress',
    'started': 'Started',
    'failed': 'Failed',
    'other': (status || 'Unknown') as string,
    'unknown': 'Unknown',
  };

  const icon = (() => {
    switch (category) {
      case 'completed': return <CheckCircle className="w-4 h-4" aria-hidden />;
      case 'in-progress': return <TrendingUp className="w-4 h-4" aria-hidden />;
      case 'started': return <Clock className="w-4 h-4" aria-hidden />;
      case 'failed': return <AlertCircle className="w-4 h-4" aria-hidden />;
      default: return <Target className="w-4 h-4" aria-hidden />;
    }
  })();

  const pillBase = 'inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full ring-1';
  const pillVariant: Record<string, string> = {
    'completed': `${pillBase} bg-green-50 text-green-800 ring-green-200`,
    'in-progress': `${pillBase} bg-purple-50 text-purple-800 ring-purple-200 animate-pulse/50`,
    'started': `${pillBase} bg-yellow-50 text-yellow-800 ring-yellow-200`,
    'failed': `${pillBase} bg-red-50 text-red-800 ring-red-200`,
    'other': `${pillBase} bg-gray-50 text-gray-800 ring-gray-100`,
    'unknown': `${pillBase} bg-gray-50 text-gray-600 ring-gray-100`,
  };

  return (
    <div className={pillVariant[category] || pillVariant.other} aria-live="polite">
      {icon}
      <span>{statusLabelMap[category] || status}</span>
    </div>
  );
}

export function AssessmentsList({ onSelectAssessment, currentAssessmentId }: AssessmentsListProps) {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [createError, setCreateError] = useState<Error | null>(null);
  const { createAssessment, clearAssessment, switchToAssessment, currentAssessment } = useAssessment();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);

  const activeAssessmentId = currentAssessmentId || currentAssessment?.assessment_id;

  // Keep listening for incoming messages (no visual live indicator in this version)
  const { messages: wsMessages } = useWebSocket(activeAssessmentId || '');

  const {
    data: assessments = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    ...assessmentQueries.userAssessments(token!, 20),
    enabled: !!token && !!user,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    // only lightweight debug
    console.debug('[AssessmentsList] Active assessment ID:', activeAssessmentId);
  }, [activeAssessmentId]);

  useEffect(() => {
    if (!wsMessages || wsMessages.length === 0) return;

    const latestMessage = wsMessages[wsMessages.length - 1];

    switch (latestMessage.type) {
      case 'score_update':
        queryClient.invalidateQueries({ queryKey: assessmentKeys.userAssessments() });
        toast({ title: 'Score Updated', description: `${latestMessage.domain || 'Assessment'} score updated`, duration: 3000 });
        break;
      case 'assessment_completed':
        queryClient.invalidateQueries({ queryKey: assessmentKeys.userAssessments() });
        toast({ title: 'Assessment Completed', description: `Assessment ${latestMessage.assessment_id?.slice(0,8)} completed`, duration: 4000 });
        break;
      case 'test_message':
        queryClient.invalidateQueries({ queryKey: assessmentKeys.userAssessments() });
        break;
      default:
        // no-op for other message types
        break;
    }
  }, [wsMessages, queryClient, toast]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lastAssessmentId' || e.key === 'currentAssessment') {
        queryClient.invalidateQueries({ queryKey: assessmentKeys.userAssessments() });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [queryClient]);

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: assessmentKeys.userAssessments() });
    }, 60000);

    return () => clearInterval(interval);
  }, [queryClient]);

  useEffect(() => {
    console.log('Assessment statuses:', assessments.map(a => ({ 
      id: a.assessment_id.slice(0,8), 
      status: a.status 
    })))
  }, [assessments])

  const handleCreateAssessment = async () => {
    try {
      setIsCreating(true);
      setCreateError(null);
      clearAssessment();
      navigate('/assessment');
    } catch (error) {
      console.error('Failed to navigate to create assessment:', error);
      setCreateError(error instanceof Error ? error : new Error('Failed to navigate to create assessment'));
    } finally {
      setIsCreating(false);
    }
  };

  // NEW: Handle viewing assessment dashboard (navigate to dashboard)
  const handleViewAssessment = (assessment: Assessment) => {
    navigate(`/dashboard/${assessment.assessment_id}`);
  };

  // NEW: Handle selecting assessment (make it active without showing dashboard)
  const handleSelectAssessment = async (assessment: Assessment, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    if (activeAssessmentId === assessment.assessment_id) {
      toast({ 
        title: 'Already Active', 
        description: `Assessment ${assessment.assessment_id.slice(0,8)} is already the active assessment` 
      });
      return;
    }

    try {
      setIsSwitching(assessment.assessment_id);
      const switchedAssessment = await switchToAssessment(assessment);
      // Don't call onSelectAssessment here since we're not showing the dashboard
      toast({ 
        title: 'Assessment Selected', 
        description: `Assessment ${assessment.assessment_id.slice(0,8)} is now active` 
      });
    } catch (error) {
      console.error('Failed to select assessment:', error);
      toast({ 
        title: 'Selection Failed', 
        description: error instanceof Error ? error.message : 'Could not select assessment', 
        variant: 'destructive' 
      });
    } finally {
      setIsSwitching(null);
    }
  };

  const handleDeleteAssessment = async (assessmentId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    if (!window.confirm('Are you sure you want to delete this assessment? This action cannot be undone.')) return;

    try {
      await AssessmentAPI.deleteAssessment(assessmentId, token!);
      cleanupAssessmentFromLocalStorage(assessmentId);
      if (activeAssessmentId === assessmentId) clearAssessment();

      await queryClient.invalidateQueries({ queryKey: assessmentKeys.userAssessments() });

      queryClient.removeQueries({ queryKey: assessmentKeys.detail(assessmentId) });
      queryClient.removeQueries({ queryKey: assessmentKeys.domainScores(assessmentId) });

      toast({ title: 'Assessment Deleted', description: `Assessment ${assessmentId.slice(0,8)} has been deleted.` });
    } catch (error) {
      console.error('Failed to delete assessment:', error);
      toast({ title: 'Deletion Failed', description: error instanceof Error ? error.message : 'Failed to delete assessment', variant: 'destructive' });
    }
  };

  const formatStatus = (status?: string) => {
    if (!status) return 'Unknown';
    const map: Record<string, string> = {
      'ALL_COMPLETE': 'All Complete',
      'RESILIENCE_COMPLETE': 'Resilience Done',
      'SUSTAINABILITY_COMPLETE': 'Sustainability Done',
      'HUMAN_CENTRICITY_COMPLETE': 'Human Centricity Done',
    };
    return map[status] || status;
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900">My Assessments</h2>
            <p className="text-gray-600 mt-1">Loading your assessments...</p>
          </div>
          <div className="flex items-center gap-3">
            <Button disabled className="flex items-center gap-2 px-4 py-2 rounded-md shadow-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <Plus className="w-4 h-4" />
              New Assessment
            </Button>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="rounded-2xl border-transparent shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-40 rounded-md" />
                  <Skeleton className="h-6 w-24 rounded-md" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-2 w-full rounded-md" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-8 w-full rounded-md" />
                    <Skeleton className="h-8 w-full rounded-md" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Assessments</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">{(error as Error).message || 'There was a problem loading your assessments.'}</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => refetch()} variant="outline">Try Again</Button>
          <Button onClick={handleCreateAssessment} disabled={isCreating} className="flex items-center gap-2 px-4 py-2 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <Plus className="w-4 h-4" />
            Create New Assessment
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Assessments</h2>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleCreateAssessment} disabled={isCreating} className="flex items-center gap-2 px-4 py-2 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:shadow-lg">
            <Plus className="w-4 h-4" />
            {isCreating ? 'Creating...' : 'New Assessment'}
          </Button>
        </div>
      </div>

      {assessments.length === 0 ? (
        <Card className="mt-16 mx-auto max-w-2xl rounded-2xl border-dotted border-gray-300 bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-10 text-center">
            <div className="flex items-center justify-center w-24 h-24 mx-auto mb-8 rounded-full bg-gray-50 border border-gray-200">
              <BarChart3 className="w-12 h-12 text-gray-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Start Your First Assessment
            </h3>
            <p className="text-gray-600 leading-relaxed max-w-md mx-auto">
              Create your first digital twin assessment to get started with a
              comprehensive system evaluation.
            </p>
          </CardContent>
        </Card>

      ) : (
        // center the whole grid and each card, while letting cards keep a max width for readability
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 justify-items-center">
          {assessments.map((assessment) => {
            const isActive = activeAssessmentId === assessment.assessment_id;

            return (
              <Card
                key={assessment.assessment_id}
                className={`w-full max-w-md rounded-2xl transition-transform transform hover:scale-[1.02] cursor-pointer ${isActive ? 'shadow-2xl ring-2 ring-blue-200 bg-gradient-to-br from-white to-blue-50' : 'shadow-sm bg-white'}`}
                onClick={() => handleViewAssessment(assessment)}
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                        <span>Assessment #{assessment.assessment_id.slice(0,8)}</span>
                        {isSwitching === assessment.assessment_id && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-2" />}
                      </CardTitle>

                      <div className="mt-1">
                        <StatusPill status={assessment.status} />
                      </div>
                    </div>

                    <div className="ml-4 flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md"
                          >
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectAssessment(assessment, e);
                            }}
                            disabled={isActive}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Check className="h-4 w-4" />
                            {isActive ? 'Currently Active' : 'Make Active'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewAssessment(assessment);
                            }}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                            View Dashboard
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteAssessment(assessment.assessment_id, e)}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:!text-red-700 hover:!bg-red-50 focus:!text-red-700 transition-colors duration-150"
                            role="menuitem"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600 font-medium">Progress</span>
                        <span className="font-bold text-gray-900">{Math.round(assessment.progress?.completion_percentage || 0)}%</span>
                      </div>

                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden relative" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(assessment.progress?.completion_percentage || 0)}>
                        <div
                          className={`absolute left-0 top-0 h-3 rounded-full transition-all duration-700 ease-out ${isActive ? 'bg-gradient-to-r from-blue-600 to-blue-400' : 'bg-gradient-to-r from-blue-600 to-purple-600'}`}
                          style={{ width: `${assessment.progress?.completion_percentage || 0}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className={`rounded-lg p-3 ${isActive ? 'bg-blue-50' : 'bg-gray-50'}`}>
                        <p className="text-xs text-gray-600 font-medium mb-1">Domains</p>
                        <p className="text-lg font-bold text-gray-900">{assessment.progress?.completed_domains?.length || 0}/3</p>
                      </div>
                      <div className={`rounded-lg p-3 ${isActive ? 'bg-blue-50' : 'bg-gray-50'}`}>
                        <p className="text-xs text-gray-600 font-medium mb-1">Score</p>
                        <p className="text-lg font-bold text-gray-900">{assessment.progress?.overall_score ? `${assessment.progress.overall_score.toFixed(1)}` : '--'}</p>
                      </div>
                    </div>

                    {assessment.progress?.completed_domains && assessment.progress.completed_domains.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-600 font-medium mb-2">Completed:</p>
                        <div className="flex flex-wrap gap-2">
                          {assessment.progress.completed_domains.map((domain) => (
                            <span key={domain} className="inline-flex px-3 py-1 text-xs font-medium bg-green-50 text-green-800 rounded-full">
                              {domain.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                      <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        Created: {formatDate(assessment.created_at)}
                      </div>
                      {isActive && (
                        <div>
                          <span className="inline-flex items-center justify-center text-[10px] font-medium text-white bg-blue-600 rounded-full px-2 py-0.5">
                            ACTIVE
                          </span>

                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Summary Statistics */}
      {assessments.length > 0 && (
        <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200 mt-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {assessments.length}
                </div>
                <div className="text-sm text-gray-600">Total Assessments</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {assessments.filter(a => isCompleted(a.status)).length}
                </div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600 mb-1">
  {assessments.filter(a => isInProgress(a.status)).length}
</div>
                <div className="text-sm text-gray-600">In Progress</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600 mb-1">
                  {(assessments
                    .filter(a => a.progress?.overall_score)
                    .reduce((sum, a) => sum + (a.progress?.overall_score || 0), 0) /
                   Math.max(1, assessments.filter(a => a.progress?.overall_score).length)
                  ).toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">Avg. Score</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}