import React, { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { useWebSocket, WebSocketMessage } from '@/hooks/useWebSocket'
import { useAssessment } from '@/hooks/useAssessment'
import { useAuth } from '@/auth'
import { useToast } from '@/hooks/use-toast'
import { assessmentKeys } from '@/services/assessmentApi'
import { useLanguage } from '@/contexts/LanguageContext'

import { RadarScoreChart } from './RadarScoreChart'
import { HumanCentricityPanel } from './panels/HumanCentricityPanel'
import { ResiliencePanel } from './panels/ResiliencePanel'
import { SustainabilityPanel } from './panels/SustainabilityPanel'
import { DetailedModuleView } from './DetailedModuleView'
import { 
  AlertCircle, 
  Eye, 
  Activity, 
  TrendingUp,
  Shield,
  Brain,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock
} from 'lucide-react'

interface AssessmentData {
  overall_score?: number
  domain_scores?: Record<string, number>
  completed_domains: string[]
  domain_data: Record<string, any>
  assessment_id?: string
  final_results?: any
  status?: string
  completion_percentage?: number
  summary_statistics?: {
    completed_domain_count: number
    average_score: number
    highest_score: number
    lowest_score: number
    score_distribution: Record<string, number>
  }
}

interface DomainScoresResponse {
  assessment_id: string
  overall_assessment: {
    status: string
    completion_percentage: number
    completed_domains: string[]
    pending_domains: string[]
    overall_score?: number
    created_at: string
    updated_at: string
    completed_at?: string
  }
  domain_results: Record<string, any>
  summary_statistics?: {
    completed_domain_count: number
    average_score: number
    highest_score: number
    lowest_score: number
    score_distribution: Record<string, number>
  }
}

interface AssessmentDashboardProps {
  assessmentId: string
}

interface PendingUpdate {
  messageKey: string
  timestamp: Date
  domain: string
}

// Updated module structure with icons
const MODULES = {
  human_centricity: {
    name: 'module.humanCentricity',
    domains: ['human_centricity'],
    icon: Brain,
    color: 'blue',
    description: 'module.userExperience'
  },
  resilience: {
    name: 'module.resilience',
    domains: ['resilience'],
    icon: Shield,
    color: 'purple',
    description: 'module.systemReliability'
  },
  sustainability: {
    name: 'module.sustainability',
    domains: ['sustainability'],
    icon: Sparkles,
    color: 'green',
    description: 'module.lifecycleImpacts'
  }
}

export const AssessmentDashboard: React.FC<AssessmentDashboardProps> = ({ 
  assessmentId 
}) => {
  const { connectionStatus, messages, subscribeToEvents } = useWebSocket(assessmentId)
  const { 
    updateProgressWithSnapshot,
    rollbackToSnapshot,
    clearSnapshot,
    currentAssessment
  } = useAssessment()
  const { token, isAuthenticated } = useAuth()
  const { toast } = useToast()
  const { t } = useLanguage()
  
  const [selectedModule, setSelectedModule] = useState<string | null>(null)
  const [localAssessmentData, setLocalAssessmentData] = useState<AssessmentData | null>(null)
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, PendingUpdate>>(new Map())
  const [processingDomains, setProcessingDomains] = useState<Set<string>>(new Set())
  const lastMessageRef = useRef<string>('')
  const errorTimeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Fetch domain scores for the specific assessment ID
  const { 
    data: domainScoresData, 
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: assessmentKeys.domainScores(assessmentId),
    queryFn: async (): Promise<DomainScoresResponse> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      
      if (isAuthenticated && token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`http://localhost:8000/assessments/${assessmentId}/domain-scores/`, {
        headers
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch assessment: ${response.status}`)
      }
      
      return response.json()
    },
    enabled: !!assessmentId && !!token,
    retry: 2,
    staleTime: 30000,
    refetchOnWindowFocus: true
  })

  // Helper functions to extract data
  const extractDomainScores = (domainResults: Record<string, any>): Record<string, number> => {
    const scores: Record<string, number> = {}
    Object.entries(domainResults).forEach(([domain, result]) => {
      if (result.overall_score !== undefined) {
        scores[domain] = result.overall_score
      }
    })
    return scores
  }

  const extractDomainData = (domainResults: Record<string, any>): Record<string, any> => {
    const data: Record<string, any> = {}
    Object.entries(domainResults).forEach(([domain, result]) => {
      data[domain] = {
        // Keep the original scores structure
        scores: result.domain_scores || result.detailed_scores || {},
        score_value: result.overall_score,
        submitted_at: result.submitted_at,
        processed_at: result.processed_at,
        insights: result.insights || [],
        
        // CRITICAL: Preserve ALL backend data including detailed_metrics
        detailed_metrics: result.detailed_metrics,
        domain_scores: result.domain_scores,
        dimension_scores: result.dimension_scores,
        overall_score: result.overall_score,
        
        // Keep any other fields that might be present
        ...result
      }
    })
    return data
  }

  // Convert domain scores response to assessment data
  useEffect(() => {
    if (domainScoresData) {
      const assessmentData: AssessmentData = {
        assessment_id: assessmentId,
        overall_score: domainScoresData.overall_assessment.overall_score,
        domain_scores: extractDomainScores(domainScoresData.domain_results),
        completed_domains: domainScoresData.overall_assessment.completed_domains,
        domain_data: extractDomainData(domainScoresData.domain_results),
        status: domainScoresData.overall_assessment.status,
        completion_percentage: domainScoresData.overall_assessment.completion_percentage,
        summary_statistics: domainScoresData.summary_statistics
      }
      setLocalAssessmentData(assessmentData)
    }
  }, [domainScoresData, assessmentId])

  // Current assessment data (either from query or fallback)
  const assessmentData: AssessmentData = localAssessmentData || {
    completed_domains: [],
    domain_data: {},
    assessment_id: assessmentId
  }

  // Check if this is the currently active assessment
  const isActiveAssessment = currentAssessment?.assessment_id === assessmentId

  // WebSocket event subscription - only for active assessment
  useEffect(() => {
    if (connectionStatus.isConnected && isActiveAssessment) {
      subscribeToEvents(['score_update', 'assessment_completed', 'error'])
    }
  }, [connectionStatus.isConnected, subscribeToEvents, assessmentId, isActiveAssessment])

  // Cleanup function for error timeouts
  useEffect(() => {
    return () => {
      errorTimeoutRefs.current.forEach(timeout => clearTimeout(timeout))
      errorTimeoutRefs.current.clear()
    }
  }, [])

  // Process WebSocket messages with error handling and rollback
  useEffect(() => {
    if (!isActiveAssessment) return

    const latestMessage = messages[messages.length - 1]
    if (!latestMessage || latestMessage.assessment_id !== assessmentId) return

    // Avoid processing the same message twice
    const messageKey = `${latestMessage.type}-${latestMessage.timestamp}-${latestMessage.domain || 'no-domain'}`
    if (messageKey === lastMessageRef.current) return
    lastMessageRef.current = messageKey

    console.log('Processing WebSocket message:', latestMessage.type, 'for domain:', latestMessage.domain)

    // Handle error events with rollback
    if (latestMessage.type === 'error') {
      console.error('Received error event:', latestMessage.error_message)
      
      const domain = latestMessage.domain || latestMessage.error_details?.domain
      
      if (domain) {
        // Clear any pending timeout for this domain
        const timeout = errorTimeoutRefs.current.get(domain)
        if (timeout) {
          clearTimeout(timeout)
          errorTimeoutRefs.current.delete(domain)
        }
        
        // Check if this error is related to a pending update
        if (pendingUpdates.has(domain)) {
          console.log(`Rolling back failed update for domain: ${domain}`)
          
          // Rollback the optimistic update
          const rolledBack = rollbackToSnapshot()
          
          if (rolledBack) {
            toast({
              title: t('dashboard.processingError'),
              description: t('dashboard.processingErrorDesc')
                .replace('{domain}', domain.replace('_', ' '))
                .replace('{error}', latestMessage.error_message),
              variant: "destructive",
            })
            
            // Refetch to get the correct state from backend
            setTimeout(() => refetch(), 500)
          }
          
          // Remove from pending updates
          setPendingUpdates(prev => {
            const newMap = new Map(prev)
            newMap.delete(domain)
            return newMap
          })
        } else {
          // General error not related to a specific update
          toast({
            title: t('error.error'),
            description: latestMessage.error_message || t('dashboard.unexpectedError'),
            variant: "destructive",
          })
        }
        
        // Remove from processing domains
        setProcessingDomains(prev => {
          const newSet = new Set(prev)
          newSet.delete(domain)
          return newSet
        })
      } else {
        // Error without domain context
        toast({
          title: t('dashboard.systemError'),
          description: latestMessage.error_message || t('dashboard.unexpectedError'),
          variant: "destructive",
        })
      }
      
      return
    }

    if (latestMessage.type === 'score_update') {
      const progressUpdate: any = {}
      
      if (latestMessage.domain) {
        // Mark this domain as processing
        setProcessingDomains(prev => new Set(prev).add(latestMessage.domain!))
        
        // Mark this domain update as pending
        setPendingUpdates(prev => new Map(prev).set(
          latestMessage.domain!,
          {
            messageKey,
            timestamp: new Date(),
            domain: latestMessage.domain!
          }
        ))
        
        const currentCompleted = assessmentData.completed_domains || []
        progressUpdate.completed_domains = [...new Set([...currentCompleted, latestMessage.domain])]
        
        progressUpdate.domain_data = {
          ...assessmentData.domain_data,
          [latestMessage.domain]: {
            ...assessmentData.domain_data[latestMessage.domain],
            scores: latestMessage.scores || {},
            score_value: latestMessage.score_value,
            processing_time_ms: latestMessage.processing_time_ms
          }
        }
        
        if (latestMessage.score_value !== undefined) {
          progressUpdate.domain_scores = {
            ...assessmentData.domain_scores,
            [latestMessage.domain]: latestMessage.score_value
          }
        }
      }

      if (latestMessage.overall_score !== undefined) {
        progressUpdate.overall_score = latestMessage.overall_score
      }
      
      if (latestMessage.domain_scores) {
        progressUpdate.domain_scores = { 
          ...assessmentData.domain_scores, 
          ...latestMessage.domain_scores 
        }
      }
      
      if (latestMessage.completion_percentage !== undefined) {
        progressUpdate.completion_percentage = latestMessage.completion_percentage
      }
      
      if (latestMessage.status) {
        progressUpdate.status = latestMessage.status
      }

      // Optimistic update WITH snapshot
      updateProgressWithSnapshot(progressUpdate, true)
      
      // Update local state for immediate UI refresh
      setLocalAssessmentData(prev => prev ? {
        ...prev,
        ...progressUpdate,
        domain_data: {
          ...prev.domain_data,
          ...progressUpdate.domain_data
        }
      } : null)
      
      // Set timeout to clear pending status and snapshot if no error received
      if (latestMessage.domain) {
        const domain = latestMessage.domain
        
        // Clear any existing timeout for this domain
        const existingTimeout = errorTimeoutRefs.current.get(domain)
        if (existingTimeout) {
          clearTimeout(existingTimeout)
        }
        
        // Set new timeout
        const timeout = setTimeout(() => {
          console.log(`No error received for ${domain}, clearing snapshot and pending status`)
          
          setPendingUpdates(prev => {
            const newMap = new Map(prev)
            newMap.delete(domain)
            return newMap
          })
          
          setProcessingDomains(prev => {
            const newSet = new Set(prev)
            newSet.delete(domain)
            return newSet
          })
          
          clearSnapshot()
          errorTimeoutRefs.current.delete(domain)
          
          // Show success toast
          toast({
            title: t('dashboard.domainProcessed'),
            description: t('dashboard.domainProcessedDesc').replace('{domain}', domain.replace('_', ' ')),
          })
        }, 2000) // Wait 2 seconds for potential error
        
        errorTimeoutRefs.current.set(domain, timeout)
      }
      
    } else if (latestMessage.type === 'assessment_completed') {
      console.log('Assessment completed event received')
      
      // Clear all pending updates and timeouts on completion
      errorTimeoutRefs.current.forEach(timeout => clearTimeout(timeout))
      errorTimeoutRefs.current.clear()
      setPendingUpdates(new Map())
      setProcessingDomains(new Set())
      clearSnapshot()
      
      const allDomainsWithScores = latestMessage.domain_scores ? 
        Object.keys(latestMessage.domain_scores) : []
      
      const mergedCompletedDomains = [...new Set([
        ...assessmentData.completed_domains,
        ...allDomainsWithScores
      ])]
      
      console.log('Assessment completed - final domain count:', mergedCompletedDomains.length)

      // Gather domain data from recent WebSocket messages
      const domainDataFromMessages: Record<string, any> = {}
      messages.forEach(msg => {
        if (msg.type === 'score_update' && msg.domain && allDomainsWithScores.includes(msg.domain)) {
          domainDataFromMessages[msg.domain] = {
            ...assessmentData.domain_data[msg.domain],
            scores: msg.scores || {},
            score_value: msg.score_value,
            processing_time_ms: msg.processing_time_ms
          }
        }
      })

      // Final progress update for completion
      const completionUpdate = {
        completed_domains: mergedCompletedDomains,
        domain_data: {
          ...assessmentData.domain_data,
          ...domainDataFromMessages,
          ...((latestMessage as any).domain_data || {})
        },
        overall_score: latestMessage.overall_score,
        domain_scores: latestMessage.domain_scores,
        status: 'COMPLETED',
        completion_percentage: 100
      }

      // Update global state (no snapshot needed for completion)
      updateProgressWithSnapshot(completionUpdate, false)
      
      // Update local state
      setLocalAssessmentData(prev => prev ? {
        ...prev,
        ...completionUpdate
      } : null)
      
      // Show completion toast
      toast({
        title: t('dashboard.assessmentComplete'),
        description: t('dashboard.assessmentCompleteDesc').replace('{score}', latestMessage.overall_score?.toFixed(1) || 'N/A'),
      })
      
      // Refetch to ensure we have the latest data
      setTimeout(() => refetch(), 1000)
    }
  }, [
    messages, 
    assessmentId, 
    assessmentData, 
    updateProgressWithSnapshot, 
    rollbackToSnapshot, 
    clearSnapshot, 
    isActiveAssessment, 
    toast, 
    pendingUpdates,
    refetch,
    t
  ])

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('dashboard.loadingDashboard')}</h3>
          <p className="text-gray-600">{t('dashboard.fetchingData')}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !assessmentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('dashboard.assessmentNotFound')}</h3>
          <p className="text-gray-600 mb-4">{t('dashboard.couldNotLoad')}</p>
          <Button onClick={() => refetch()}>{t('common.tryAgain')}</Button>
        </div>
      </div>
    )
  }

  const allDomains = ['human_centricity', 'resilience', 'sustainability']
  const completionPercentage = assessmentData.completion_percentage || 
    (assessmentData.completed_domains.length / allDomains.length) * 100

  // Calculate module status and scores
  const getModuleStatus = (moduleKey: string) => {
    const module = MODULES[moduleKey as keyof typeof MODULES]
    const completedDomains = module.domains.filter(domain => 
      assessmentData.completed_domains.includes(domain)
    )
    return {
      completed: completedDomains.length,
      total: module.domains.length,
      percentage: (completedDomains.length / module.domains.length) * 100
    }
  }

  const getModuleScore = (moduleKey: string) => {
    const module = MODULES[moduleKey as keyof typeof MODULES]
    const scores = module.domains
      .map(domain => assessmentData.domain_scores?.[domain])
      .filter(score => score !== undefined) as number[]
    
    if (scores.length === 0) return undefined
    return scores.reduce((sum, score) => sum + score, 0) / scores.length
  }

  const isModuleProcessing = (moduleKey: string) => {
    const module = MODULES[moduleKey as keyof typeof MODULES]
    return module.domains.some(domain => processingDomains.has(domain))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-background to-muted/20">
      <div className="container mx-auto px-6 py-8 space-y-8">

        {/* Show indicator if this is not the active assessment */}
        {!isActiveAssessment && (
          <Card className="border-amber-200 bg-amber-50/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 text-amber-800">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">
                  {t('dashboard.historicalAssessment')}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connection status indicator */}
        {isActiveAssessment && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus.isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`} />
                  <span className="text-sm text-muted-foreground">
                    {connectionStatus.isConnected ? t('dashboard.liveUpdatesActive') : t('dashboard.disconnected')}
                  </span>
                </div>
                {pendingUpdates.size > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="w-3 h-3" />
                    {pendingUpdates.size} {t('dashboard.pending')}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Radar Chart with Overall Score */}
        <RadarScoreChart 
          domainScores={assessmentData.domain_scores}
          overallScore={assessmentData.overall_score}
          completedDomains={assessmentData.completed_domains}
          completionPercentage={completionPercentage}
          totalDomains={allDomains.length}
        />
        
        {/* Module Cards - Enhanced Design */}
        <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-secondary/10 via-secondary/5 to-background border-b border-border/50">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-secondary/20 rounded-lg">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <span>{t('dashboard.assessmentModules')}</span>
                <p className="text-sm text-muted-foreground font-normal mt-1">
                  {t('dashboard.detailedBreakdown')}
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {Object.entries(MODULES).map(([moduleKey, module]) => {
                const status = getModuleStatus(moduleKey)
                const score = getModuleScore(moduleKey)
                const IconComponent = module.icon
                const isProcessing = isModuleProcessing(moduleKey)
                
                return (
                  <div 
                    key={moduleKey}
                    className={`group relative overflow-hidden rounded-2xl border border-border/50 
                                bg-gradient-to-br from-background via-background to-muted/20 p-6 
                                transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${
                      module.color === 'blue'
                        ? 'hover:border-blue-400'
                        : module.color === 'purple'
                        ? 'hover:border-purple-400'
                        : 'hover:border-green-400'
                    } ${isProcessing ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
                  >
                    {/* Animated gradient overlay */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 ${
                      module.color === 'blue' ? 'bg-gradient-to-br from-blue-500 via-blue-400 to-cyan-400' :
                      module.color === 'purple' ? 'bg-gradient-to-br from-purple-500 via-purple-400 to-pink-400' :
                      'bg-gradient-to-br from-green-500 via-green-400 to-emerald-400'
                    }`} />
                    
                    <div className="relative space-y-6">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl bg-white shadow-sm border border-border/30 group-hover:shadow-md transition-shadow ${
                            module.color === 'blue' ? 'text-blue-600' :
                            module.color === 'purple' ? 'text-purple-600' :
                            'text-green-600'
                          } ${isProcessing ? 'animate-pulse' : ''}`}>
                            <IconComponent className="w-7 h-7" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-foreground">
                                {t(module.name)}
                              </h3>
                              {isProcessing && (
                                <Badge variant="secondary" className="gap-1 text-xs">
                                  <Clock className="w-3 h-3 animate-spin" />
                                  {t('dashboard.processing')}
                                </Badge>
                              )}
                              {status.completed === status.total && !isProcessing && (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {t(module.description)}
                            </p>
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedModule(moduleKey)}
                          className="opacity-0 group-hover:opacity-100 transition-all duration-200 h-10 w-10 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 hover:scale-110"
                        >
                          <Eye className="h-5 w-5" />
                        </Button>
                      </div>
                      
                      {/* Progress Section */}
                      <div className="space-y-4">
                        
                        {/* Score Display */}
                        {score !== undefined && (
                          <div className="pt-4 border-t border-border/30">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-muted-foreground">{t('module.score')}</span>
                              <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg ${
                                  score >= 80 ? 'bg-green-100 text-green-600' :
                                  score >= 60 ? 'bg-yellow-100 text-yellow-600' :
                                  'bg-orange-100 text-orange-600'
                                }`}>
                                  <TrendingUp className="w-4 h-4" />
                                </div>
                                <span className="text-2xl font-bold text-foreground">
                                  {score.toFixed(1)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Domain-specific content panels */}
                        <div className="pt-4 border-t border-border/30">
                          {moduleKey === 'human_centricity' && (
                            <HumanCentricityPanel data={assessmentData.domain_data.human_centricity} />
                          )}
                          {moduleKey === 'resilience' && (
                            <ResiliencePanel data={assessmentData.domain_data.resilience} />
                          )}
                          {moduleKey === 'sustainability' && (
                            <SustainabilityPanel data={assessmentData.domain_data.sustainability} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Module View Modal */}
        {selectedModule && (
          <DetailedModuleView
            module={selectedModule}
            moduleData={MODULES[selectedModule as keyof typeof MODULES]}
            assessmentData={assessmentData}
            onClose={() => setSelectedModule(null)}
          />
        )}
      </div>
    </div>
  )
}