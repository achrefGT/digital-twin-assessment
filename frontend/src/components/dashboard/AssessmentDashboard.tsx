import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { useWebSocket, WebSocketMessage } from '@/hooks/useWebSocket'
import { useAssessment } from '@/hooks/useAssessment'
import { ProgressTracker } from './ProgressTracker'
import { OverallScoreDisplay } from './OverallScoreDisplay'
import { HumanCentricityPanel } from './panels/HumanCentricityPanel'
import { ResiliencePanel } from './panels/ResiliencePanel'
import { SustainabilityPanel } from './panels/SustainabilityPanel'
import { DetailedModuleView } from './DetailedModuleView'
import { ConnectionIndicator } from './ConnectionIndicator'
import { 
  Wifi, 
  WifiOff, 
  AlertCircle, 
  Eye, 
  Activity, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  Zap,
  Shield,
  Leaf,
  Users,
  Brain,
  Sparkles,
  BarChart3,
  RefreshCw
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

interface AssessmentDashboardProps {
  assessmentId: string
}

// Updated module structure with icons
const MODULES = {
  human_centricity: {
    name: 'Human Centricity',
    domains: ['human_centricity'],
    icon: Brain,
    color: 'blue',
    description: 'User experience and accessibility metrics'
  },
  resilience: {
    name: 'Resilience',
    domains: ['resilience'],
    icon: Shield,
    color: 'purple',
    description: 'System reliability and fault tolerance'
  },
  sustainability: {
    name: 'Sustainability',
    domains: ['elca', 'slca', 'lcc'],
    icon: Sparkles,
    color: 'green',
    description: 'Triple-bottom-line lifecycle impacts'
  }
}

// Updated utility functions to use localStorage instead of in-memory cache
const persistDashboardData = (assessmentId: string, data: AssessmentData) => {
  try {
    const key = `dashboardData_${assessmentId}`
    localStorage.setItem(key, JSON.stringify(data))
    console.log('💾 Persisted dashboard data to localStorage for:', assessmentId)
  } catch (error) {
    console.error('⚠ Failed to persist dashboard data:', error)
  }
}

const loadPersistedDashboardData = (assessmentId: string): Partial<AssessmentData> => {
  try {
    const key = `dashboardData_${assessmentId}`
    const stored = localStorage.getItem(key)
    if (stored) {
      console.log('🔥 Loaded persisted dashboard data from localStorage for:', assessmentId)
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('⚠ Failed to load persisted dashboard data:', error)
  }
  return {}
}

export const AssessmentDashboard: React.FC<AssessmentDashboardProps> = ({ 
  assessmentId 
}) => {
  const { connectionStatus, messages, subscribeToEvents } = useWebSocket(assessmentId)
  const { currentAssessment, updateProgress, refreshAssessmentData } = useAssessment()
  
  const lastPersistedDataRef = useRef<string>('')
  const lastProgressUpdateRef = useRef<string>('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const [selectedModule, setSelectedModule] = useState<string | null>(null)
  
  // Initialize with persisted data
  const [assessmentData, setAssessmentData] = useState<AssessmentData>(() => {
    const persistedData = loadPersistedDashboardData(assessmentId)
    return {
      completed_domains: [],
      domain_data: {},
      assessment_id: assessmentId,
      ...persistedData
    }
  })

  // Updated initialization to sync with useAssessment
  useEffect(() => {
    console.log('🎯 AssessmentDashboard mounted with ID:', assessmentId)
    
    // If useAssessment has data for this assessment, use it
    if (currentAssessment?.assessment_id === assessmentId && currentAssessment.progress) {
      console.log('📊 Syncing with useAssessment data')
      const assessmentProgress = currentAssessment.progress
      
      setAssessmentData(prev => ({
        ...prev,
        assessment_id: assessmentId,
        completed_domains: assessmentProgress.completed_domains || [],
        completion_percentage: assessmentProgress.completion_percentage || 0,
        overall_score: assessmentProgress.overall_score,
        domain_scores: assessmentProgress.domain_scores || {},
        domain_data: assessmentProgress.domain_data || {},
        status: currentAssessment.status,
        summary_statistics: assessmentProgress.summary_statistics
      }))
      return
    }
    
    // Otherwise load persisted data
    const persistedData = loadPersistedDashboardData(assessmentId)
    if (Object.keys(persistedData).length > 0) {
      console.log('📊 Using cached data from localStorage')
      setAssessmentData(prev => ({
        ...prev,
        assessment_id: assessmentId,
        ...persistedData
      }))
    }
    
    // If no data available and this matches current assessment, trigger a refresh
    if (currentAssessment?.assessment_id === assessmentId && 
        Object.keys(persistedData).length === 0) {
      console.log('🔄 No cached data found, triggering refresh')
      refreshAssessmentData(assessmentId)
    }
  }, [assessmentId, currentAssessment, refreshAssessmentData])

  // Also sync when currentAssessment updates
  useEffect(() => {
    if (currentAssessment?.assessment_id === assessmentId && currentAssessment.progress) {
      console.log('🔄 Syncing dashboard with updated assessment data')
      const assessmentProgress = currentAssessment.progress
      
      setAssessmentData(prev => ({
        ...prev,
        assessment_id: assessmentId,
        completed_domains: assessmentProgress.completed_domains || [],
        completion_percentage: assessmentProgress.completion_percentage || 0,
        overall_score: assessmentProgress.overall_score,
        domain_scores: assessmentProgress.domain_scores || {},
        domain_data: assessmentProgress.domain_data || {},
        status: currentAssessment.status,
        summary_statistics: assessmentProgress.summary_statistics
      }))
    }
  }, [currentAssessment, assessmentId])

  // Simplified manual refresh function
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshAssessmentData(assessmentId)
      console.log('🔄 Manual refresh completed')
    } catch (error) {
      console.error('⚠ Manual refresh failed:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Persistence logic
  useEffect(() => {
    if (!assessmentData.assessment_id) return

    const currentDataHash = JSON.stringify({
      id: assessmentData.assessment_id,
      domains: assessmentData.completed_domains,
      completion: assessmentData.completion_percentage,
      scores: assessmentData.domain_scores,
      overall: assessmentData.overall_score,
      status: assessmentData.status
    })

    if (currentDataHash !== lastPersistedDataRef.current) {
      lastPersistedDataRef.current = currentDataHash
      persistDashboardData(assessmentData.assessment_id, assessmentData)
    }
  }, [assessmentData])

  // Progress update logic
  useEffect(() => {
    if (!assessmentData.assessment_id) return

    const progressHash = JSON.stringify({
      domains: assessmentData.completed_domains.length,
      completion: assessmentData.completion_percentage,
      overall: assessmentData.overall_score,
      status: assessmentData.status
    })

    if (progressHash !== lastProgressUpdateRef.current && 
        (assessmentData.completed_domains.length > 0 || 
         assessmentData.overall_score !== undefined ||
         assessmentData.status)) {
      
      lastProgressUpdateRef.current = progressHash
      
      updateProgress({
        completed_domains: assessmentData.completed_domains,
        completion_percentage: assessmentData.completion_percentage,
        domain_scores: assessmentData.domain_scores,
        overall_score: assessmentData.overall_score,
        status: assessmentData.status,
        domain_data: assessmentData.domain_data,
        summary_statistics: assessmentData.summary_statistics
      })
    }
  }, [
    assessmentData.assessment_id,
    assessmentData.completed_domains.length,
    assessmentData.completion_percentage,
    assessmentData.overall_score,
    assessmentData.status,
    updateProgress
  ])

  // WebSocket event subscription
  useEffect(() => {
    if (connectionStatus.isConnected) {
      subscribeToEvents(['score_update', 'assessment_completed', 'error'])
    }
  }, [connectionStatus.isConnected, subscribeToEvents, assessmentId])

  // Process WebSocket messages - ENHANCED with better handling
  useEffect(() => {
    const latestMessage = messages[messages.length - 1]
    if (!latestMessage || latestMessage.assessment_id !== assessmentId) return

    console.log('📨 Processing WebSocket message:', latestMessage.type, 'for domain:', latestMessage.domain)

    if (latestMessage.type === 'score_update') {
      setAssessmentData(prev => {
        const newData = { ...prev }
        
        if (latestMessage.domain) {
          // Add to completed domains if not already present
          newData.completed_domains = [...new Set([...prev.completed_domains, latestMessage.domain])]
          
          // Update domain data with WebSocket-specific information (like processing time)
          newData.domain_data = {
            ...prev.domain_data,
            [latestMessage.domain]: {
              // Preserve any existing API data
              ...prev.domain_data[latestMessage.domain],
              // Add/update with WebSocket data
              scores: latestMessage.scores || {},
              score_value: latestMessage.score_value,
              processing_time_ms: latestMessage.processing_time_ms
            }
          }
          
          // Update domain scores
          if (latestMessage.score_value !== undefined) {
            newData.domain_scores = {
              ...prev.domain_scores,
              [latestMessage.domain]: latestMessage.score_value
            }
          }
        }

        if (latestMessage.overall_score !== undefined) {
          newData.overall_score = latestMessage.overall_score
        }
        
        if (latestMessage.domain_scores) {
          newData.domain_scores = { ...newData.domain_scores, ...latestMessage.domain_scores }
        }
        
        if (latestMessage.completion_percentage !== undefined) {
          newData.completion_percentage = latestMessage.completion_percentage
        }
        
        if (latestMessage.status) {
          newData.status = latestMessage.status
        }

        console.log('🔄 Updated assessment data from WebSocket')
        return newData
      })
    } else if (latestMessage.type === 'assessment_completed') {
      setAssessmentData(prev => {
        // Get all domains with scores from the completion message
        const allDomainsWithScores = latestMessage.domain_scores ? 
          Object.keys(latestMessage.domain_scores) : []
        
        // Merge with existing completed domains
        const mergedCompletedDomains = [...new Set([
          ...prev.completed_domains,
          ...allDomainsWithScores
        ])]
        
        console.log('🎯 Assessment completed - final domain count:', mergedCompletedDomains.length)

        // Gather domain data from recent WebSocket messages to avoid data loss
        const messagesSnapshot = messages.slice()
        const domainDataFromMessages: Record<string, any> = messagesSnapshot.reduce((acc, msg) => {
          if (msg.type === 'score_update' && msg.domain && allDomainsWithScores.includes(msg.domain)) {
            acc[msg.domain] = {
              // Preserve existing data
              ...prev.domain_data[msg.domain],
              // Add WebSocket-specific data
              scores: msg.scores || {},
              score_value: msg.score_value,
              processing_time_ms: msg.processing_time_ms
            }
          }
          return acc
        }, {} as Record<string, any>)

        // Merge domain data from completion message if provided
        const completedPayloadDomainData = (latestMessage as any).domain_data || {}

        const mergedDomainData = {
          ...prev.domain_data,
          ...domainDataFromMessages,
          ...completedPayloadDomainData
        }

        return {
          ...prev,
          completed_domains: mergedCompletedDomains,
          domain_data: mergedDomainData,
          overall_score: latestMessage.overall_score,
          domain_scores: latestMessage.domain_scores,
          final_results: {
            weighted_score: latestMessage.overall_score,
            weights: latestMessage.final_weights_used
          },
          assessment_id: latestMessage.assessment_id,
          status: 'COMPLETED',
          completion_percentage: 100
        }
      })
    }
  }, [messages, assessmentId])

  // Debug logging for assessment data changes
  useEffect(() => {
    console.log('📊 Assessment Data Debug:', {
      assessment_id: assessmentData.assessment_id,
      completed_domains: assessmentData.completed_domains,
      domain_data_keys: Object.keys(assessmentData.domain_data),
      domain_scores: assessmentData.domain_scores,
      overall_score: assessmentData.overall_score,
      latest_message_type: messages[messages.length - 1]?.type,
      latest_message_domain: messages[messages.length - 1]?.domain
    })
  }, [assessmentData, messages])

  const allDomains = ['human_centricity', 'resilience', 'elca', 'slca', 'lcc']
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

  return (
    <div className="relative bg-gradient-to-br from-slate-50 via-white to-gray-50">
      <div className="container mx-auto px-6 py-8 space-y-8">
        
        {/* Header with refresh button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <ConnectionIndicator 
              connectionStatus={connectionStatus}
            />
            {assessmentData.status && (
              <Badge variant={assessmentData.status === 'COMPLETED' ? 'default' : 'secondary'}>
                {assessmentData.status}
              </Badge>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>

        {/* Assessment Overview Section */}
        <div className="space-y-8">
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Main Assessment Progress Section */}
            <div className="xl:col-span-3 order-2 xl:order-1">
              <Card className="border-2 border-gray-200 shadow-xl bg-white h-full">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div>
                      <CardTitle className="text-2xl font-bold text-gray-900">
                        Digital Twin Assessment
                      </CardTitle>
                      <p className="text-gray-600 text-base leading-relaxed">
                        Comprehensive evaluation across key technology and business domains
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  <ProgressTracker 
                    key={`${assessmentData.assessment_id}-${assessmentData.completed_domains.length}`}
                    modules={MODULES}
                    completedDomains={assessmentData.completed_domains}
                    domainData={assessmentData.domain_data}
                    domainScores={assessmentData.domain_scores}
                  />
                </CardContent>
              </Card>
            </div>
            
            {/* Score Display */}
            <div className="xl:col-span-1 order-1 xl:order-2">
              <div className="sticky top-24">
                <OverallScoreDisplay 
                  overallScore={assessmentData.overall_score}
                  domainScores={assessmentData.domain_scores}
                  finalResults={assessmentData.final_results}
                  completionPercentage={completionPercentage}
                  totalDomains={allDomains.length}
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Module Cards - Modern Design */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Object.entries(MODULES).map(([moduleKey, module]) => {
            const status = getModuleStatus(moduleKey)
            const score = getModuleScore(moduleKey)
            const IconComponent = module.icon
            
            return (
              <Card 
                key={moduleKey}
                className="group border-slate-200/60 bg-white/60 backdrop-blur-sm hover:shadow-lg transition-all duration-300 relative overflow-hidden"
              >
                {/* Gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br opacity-5 ${
                  module.color === 'blue' ? 'from-blue-500 to-cyan-500' :
                  module.color === 'purple' ? 'from-purple-500 to-pink-500' :
                  'from-green-500 to-emerald-500'
                }`} />
                
                <CardHeader className="relative pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        module.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                        module.color === 'purple' ? 'bg-purple-100 text-purple-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">
                          {module.name}
                        </CardTitle>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {module.description}
                        </p>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedModule(moduleKey)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="relative pt-0">
                  {/* Progress */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Progress</span>
                      <span className="font-medium text-slate-900">
                        {status.completed}/{status.total} domains
                      </span>
                    </div>
                    <Progress value={status.percentage} className="h-1.5" />
                    
                    {/* Score */}
                    {score !== undefined && (
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">Score</span>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            <span className="text-lg font-bold text-slate-900">
                              {score.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Domain-specific content */}
                    <div className="pt-2">
                      {moduleKey === 'human_centricity' && (
                        <HumanCentricityPanel data={assessmentData.domain_data.human_centricity} />
                      )}
                      {moduleKey === 'resilience' && (
                        <ResiliencePanel data={assessmentData.domain_data.resilience} />
                      )}
                      {moduleKey === 'sustainability' && (
                        <SustainabilityPanel 
                          elcaData={assessmentData.domain_data.elca}
                          slcaData={assessmentData.domain_data.slca}
                          lccData={assessmentData.domain_data.lcc}
                          moduleScore={score}
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

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