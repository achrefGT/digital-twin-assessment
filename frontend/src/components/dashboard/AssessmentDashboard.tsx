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
  BarChart3
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

// Utility functions for persisting dashboard data
const persistDashboardData = (assessmentId: string, data: AssessmentData) => {
  try {
    (window as any).dashboardCache = (window as any).dashboardCache || {}
    ;(window as any).dashboardCache[assessmentId] = data
    console.log('💾 Persisted dashboard data for:', assessmentId)
  } catch (error) {
    console.error('❌ Failed to persist dashboard data:', error)
  }
}

const loadPersistedDashboardData = (assessmentId: string): Partial<AssessmentData> => {
  try {
    const cache = (window as any).dashboardCache || {}
    if (cache[assessmentId]) {
      console.log('🔥 Loaded persisted dashboard data for:', assessmentId)
      return cache[assessmentId]
    }
  } catch (error) {
    console.error('❌ Failed to load persisted dashboard data:', error)
  }
  return {}
}

export const AssessmentDashboard: React.FC<AssessmentDashboardProps> = ({ 
  assessmentId 
}) => {
  const { connectionStatus, messages, subscribeToEvents } = useWebSocket(assessmentId)
  const { updateProgress } = useAssessment()
  
  const lastPersistedDataRef = useRef<string>('')
  const lastProgressUpdateRef = useRef<string>('')
  
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

  // Log assessment ID changes
  useEffect(() => {
    console.log('🎯 AssessmentDashboard mounted with ID:', assessmentId)
    
    const persistedData = loadPersistedDashboardData(assessmentId)
    setAssessmentData(prev => ({
      ...prev,
      assessment_id: assessmentId,
      ...persistedData
    }))
  }, [assessmentId])

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
        status: assessmentData.status
      })
    }
  }, [
    assessmentData.assessment_id,
    assessmentData.completed_domains.length,
    assessmentData.completion_percentage,
    assessmentData.overall_score,
    assessmentData.status
  ])

  // WebSocket event subscription
  useEffect(() => {
    if (connectionStatus.isConnected) {
      subscribeToEvents(['score_update', 'assessment_completed', 'error'])
    }
  }, [connectionStatus.isConnected, subscribeToEvents, assessmentId])

  // Process WebSocket messages - FIXED RACE CONDITION
  useEffect(() => {
    const latestMessage = messages[messages.length - 1]
    if (!latestMessage || latestMessage.assessment_id !== assessmentId) return

    if (latestMessage.type === 'score_update') {
      setAssessmentData(prev => {
        const newData = { ...prev }
        
        if (latestMessage.domain) {
          newData.completed_domains = [...new Set([...prev.completed_domains, latestMessage.domain])]
          newData.domain_data = {
            ...prev.domain_data,
            [latestMessage.domain]: {
              scores: latestMessage.scores || {},
              score_value: latestMessage.score_value,
              processing_time_ms: latestMessage.processing_time_ms
            }
          }
        }

        if (latestMessage.overall_score !== undefined) {
          newData.overall_score = latestMessage.overall_score
        }
        
        if (latestMessage.domain_scores) {
          newData.domain_scores = latestMessage.domain_scores
        }
        
        if (latestMessage.completion_percentage !== undefined) {
          newData.completion_percentage = latestMessage.completion_percentage
        }
        
        if (latestMessage.status) {
          newData.status = latestMessage.status
        }

        return newData
      })
    } else if (latestMessage.type === 'assessment_completed') {
      setAssessmentData(prev => {
        // FIXED: Calculate completed domains from domain_scores instead of relying on previous state
        const allDomainsWithScores = latestMessage.domain_scores ? 
          Object.keys(latestMessage.domain_scores) : []
        
        // Merge with existing completed domains to ensure we don't lose any
        const mergedCompletedDomains = [...new Set([
          ...prev.completed_domains,
          ...allDomainsWithScores
        ])]
        
        console.log('🏁 Assessment completed - merging completed domains:', {
          previous: prev.completed_domains,
          fromScores: allDomainsWithScores,
          merged: mergedCompletedDomains
        })

        // NEW: gather any domain data already present in recent websocket messages
        // This prevents losing the domain_data for the last domain when `assessment_completed`
        // arrives before the last `score_update` or when ordering is inconsistent.
        const messagesSnapshot = messages.slice() // capture current messages array

        const domainDataFromMessages: Record<string, any> = messagesSnapshot.reduce((acc, msg) => {
          if (msg.type === 'score_update' && msg.domain && allDomainsWithScores.includes(msg.domain)) {
            acc[msg.domain] = {
              scores: msg.scores || {},
              score_value: msg.score_value,
              processing_time_ms: msg.processing_time_ms
            }
          }
          return acc
        }, {} as Record<string, any>)

        // Prefer any domain data present on the completed payload if provided
        const completedPayloadDomainData = (latestMessage as any).domain_data || {}

        const mergedDomainData = {
          ...prev.domain_data,
          ...domainDataFromMessages,
          ...completedPayloadDomainData
        }

        return {
          ...prev,
          completed_domains: mergedCompletedDomains, // Use merged list
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

  useEffect(() => {
    console.log('🔍 Assessment Data Debug:', {
      assessment_id: assessmentData.assessment_id,
      completed_domains: assessmentData.completed_domains,
      domain_data: Object.keys(assessmentData.domain_data),
      domain_scores: assessmentData.domain_scores,
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