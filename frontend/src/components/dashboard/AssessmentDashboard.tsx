import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { useWebSocket, WebSocketMessage } from '@/hooks/useWebSocket'
import { useAssessment } from '@/hooks/useAssessment'

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
  Sparkles
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
    domains: ['sustainability'],
    icon: Sparkles,
    color: 'green',
    description: 'Triple-bottom-line lifecycle impacts'
  }
}

export const AssessmentDashboard: React.FC<AssessmentDashboardProps> = ({ 
  assessmentId 
}) => {
  const { connectionStatus, messages, subscribeToEvents } = useWebSocket(assessmentId)
  const { 
    currentAssessment, 
    updateProgress, 
    refreshAssessmentData, 
    isLoading
  } = useAssessment()
  
  const [selectedModule, setSelectedModule] = useState<string | null>(null)
  const lastMessageRef = useRef<string>('')

  // Convert currentAssessment to AssessmentData format for compatibility
  const assessmentData: AssessmentData = React.useMemo(() => {
    if (!currentAssessment) {
      return {
        completed_domains: [],
        domain_data: {},
        assessment_id: assessmentId
      }
    }

    return {
      assessment_id: currentAssessment.assessment_id,
      overall_score: currentAssessment.progress?.overall_score,
      domain_scores: currentAssessment.progress?.domain_scores || {},
      completed_domains: currentAssessment.progress?.completed_domains || [],
      domain_data: currentAssessment.progress?.domain_data || {},
      status: currentAssessment.status,
      completion_percentage: currentAssessment.progress?.completion_percentage || 0,
      summary_statistics: currentAssessment.progress?.summary_statistics
    }
  }, [currentAssessment, assessmentId])

  // WebSocket event subscription
  useEffect(() => {
    if (connectionStatus.isConnected) {
      subscribeToEvents(['score_update', 'assessment_completed', 'error'])
    }
  }, [connectionStatus.isConnected, subscribeToEvents, assessmentId])

  // Process WebSocket messages with React Query integration
  useEffect(() => {
    const latestMessage = messages[messages.length - 1]
    if (!latestMessage || latestMessage.assessment_id !== assessmentId) return

    // Avoid processing the same message twice
    const messageKey = `${latestMessage.type}-${latestMessage.timestamp}-${latestMessage.domain || 'no-domain'}`
    if (messageKey === lastMessageRef.current) return
    lastMessageRef.current = messageKey

    console.log('Processing WebSocket message:', latestMessage.type, 'for domain:', latestMessage.domain)

    if (latestMessage.type === 'score_update') {
      // Build progress update from WebSocket message
      const progressUpdate: any = {}
      
      if (latestMessage.domain) {
        // Update completed domains
        const currentCompleted = assessmentData.completed_domains || []
        progressUpdate.completed_domains = [...new Set([...currentCompleted, latestMessage.domain])]
        
        // Update domain data
        progressUpdate.domain_data = {
          ...assessmentData.domain_data,
          [latestMessage.domain]: {
            ...assessmentData.domain_data[latestMessage.domain],
            scores: latestMessage.scores || {},
            score_value: latestMessage.score_value,
            processing_time_ms: latestMessage.processing_time_ms
          }
        }
        
        // Update domain scores
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

      // Update using React Query
      updateProgress(progressUpdate)
      
    } else if (latestMessage.type === 'assessment_completed') {
      // Handle assessment completion
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
      updateProgress({
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
      })
    }
  }, [messages, assessmentId, assessmentData, updateProgress])

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading Assessment</h3>
          <p className="text-gray-600">Fetching your assessment data...</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-background to-muted/20">
      <div className="container mx-auto px-6 py-8 space-y-8">

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
                <span>Assessment Modules</span>
                <p className="text-sm text-muted-foreground font-normal mt-1">
                  Detailed breakdown by evaluation domains
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
                    }`}
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
                          }`}>
                            <IconComponent className="w-7 h-7" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">
                              {module.name}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {module.description}
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
                              <span className="text-sm font-medium text-muted-foreground">Score</span>
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