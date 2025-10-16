import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Brain, Shield, Leaf, CheckCircle, Clock, Sparkles, Lightbulb, AlertCircle, TrendingUp, Target, Star, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { HumanCentricityPanel } from './panels/HumanCentricityPanel'
import { ResiliencePanel } from './panels/ResiliencePanel'
import { SustainabilityPanel } from './panels/SustainabilityPanel'
import { useLanguage } from '@/contexts/LanguageContext'
import { useRecommendations } from '@/hooks/useRecommendations'

interface DetailedModuleViewProps {
  module: string
  moduleData: {
    name: string
    domains: string[]
  }
  assessmentData: {
    completed_domains: string[]
    domain_data: Record<string, any>
    domain_scores?: Record<string, number>
    overall_score?: number
    assessment_id?: string
  }
  onClose: () => void
}

export const DetailedModuleView: React.FC<DetailedModuleViewProps> = ({
  module,
  moduleData,
  assessmentData,
  onClose
}) => {
  const { t } = useLanguage()
  const [expandedRecommendations, setExpandedRecommendations] = useState<Set<string>>(new Set())
  
  // Fetch recommendations for this assessment
  const {
    recommendations,
    isLoading: isLoadingRecommendations,
    hasRecommendations
  } = useRecommendations(assessmentData.assessment_id || '')

  // Filter recommendations for current module's domains
  const moduleRecommendations = useMemo(() => {
    if (!recommendations?.recommendations) return []
    
    return recommendations.recommendations.filter(rec => 
      moduleData.domains.includes(rec.domain)
    )
  }, [recommendations, moduleData.domains])

  // Group recommendations by priority
  const recommendationsByPriority = useMemo(() => {
    const grouped: Record<string, typeof moduleRecommendations> = {
      critical: [],
      high: [],
      medium: [],
      low: []
    }
    
    moduleRecommendations.forEach(rec => {
      const priority = rec.priority || 'low'
      if (grouped[priority]) {
        grouped[priority].push(rec)
      }
    })
    
    return grouped
  }, [moduleRecommendations])

  const toggleRecommendation = (id: string) => {
    setExpandedRecommendations(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const getModuleIcon = (moduleKey: string) => {
    switch (moduleKey) {
      case 'human_centricity': return Brain
      case 'resilience': return Shield
      case 'sustainability': return Sparkles
      default: return CheckCircle
    }
  }

  const getModuleScore = () => {
    const scores = moduleData.domains
      .map(domain => assessmentData.domain_scores?.[domain])
      .filter(score => score !== undefined) as number[]
    
    if (scores.length === 0) return undefined
    return scores.reduce((sum, score) => sum + score, 0) / scores.length
  }

  const getCompletionStatus = () => {
    const completed = moduleData.domains.filter(domain => 
      assessmentData.completed_domains.includes(domain)
    )
    return {
      completed: completed.length,
      total: moduleData.domains.length,
      percentage: (completed.length / moduleData.domains.length) * 100,
      domains: completed
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPriorityConfig = (priority: 'critical' | 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'critical':
        return {
          icon: AlertCircle,
          color: 'text-red-700',
          bgColor: 'bg-red-100',
          borderColor: 'border-red-300',
          label: t('recommendations.critical') || 'Critical'
        }
      case 'high':
        return {
          icon: AlertCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          label: t('recommendations.high') || 'High Priority'
        }
      case 'medium':
        return {
          icon: TrendingUp,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          label: t('recommendations.medium') || 'Medium'
        }
      case 'low':
        return {
          icon: Target,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          label: t('recommendations.low') || 'Low'
        }
    }
  }

  const ModuleIcon = getModuleIcon(module)
  const moduleScore = getModuleScore()
  const status = getCompletionStatus()

  const renderModuleContent = () => {
    switch (module) {
      case 'human_centricity':
        return (
          <HumanCentricityPanel 
            data={assessmentData.domain_data.human_centricity} 
          />
        )
      
      case 'resilience':
        return (
          <ResiliencePanel 
            data={assessmentData.domain_data.resilience} 
          />
        )
      
      case 'sustainability':
        return (
          <div className="space-y-6">
            <SustainabilityPanel 
              data={assessmentData.domain_data.sustainability} 
            />
          </div>
        )
      
      default:
        return (
          <div className="text-center text-muted-foreground py-8">
            {t('dashboard.noDetailedView')}
          </div>
        )
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-muted/50 to-background">
          <div className="flex items-center gap-4">
            <ModuleIcon className="h-8 w-8 text-primary" />
            <div>
              <h2 className="text-2xl font-bold">{t(moduleData.name)} - {t('dashboard.detailedView')}</h2>
              <div className="flex items-center gap-4 mt-2">
                <Badge variant="outline">
                  {status.completed}/{status.total} {t('assessments.domains').toLowerCase()} {t('module.complete').toLowerCase()}
                </Badge>
                {moduleScore && (
                  <Badge 
                    variant="secondary"
                    className={getScoreColor(moduleScore)}>
                    {t('module.score')}: {moduleScore.toFixed(1)}
                  </Badge>
                )}
                <Badge 
                  variant="secondary"
                  className={status.percentage === 100 ? "text-green-600" : ""}
                >
                  {status.percentage.toFixed(0)}% {t('module.complete')}
                </Badge>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-10 w-10 p-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Domain Status Overview */}
          <div className="mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  {t('dashboard.domainStatusOverview')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {moduleData.domains.map((domain) => {
                    const isCompleted = assessmentData.completed_domains.includes(domain)
                    const domainScore = assessmentData.domain_scores?.[domain]
                    const data = assessmentData.domain_data[domain]
                    const processingTime = data?.processing_time_ms

                    return (
                      <div
                        key={domain}
                        className={`p-4 rounded-lg border-2 transition-colors ${
                          isCompleted 
                            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20' 
                            : 'border-muted bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {isCompleted ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium capitalize">
                            {domain.replace('_', ' ')}
                          </span>
                        </div>
                        
                        {domainScore !== undefined && (
                          <div className="mb-1">
                            <span className={`text-lg font-bold ${getScoreColor(domainScore)}`}>
                              {domainScore.toFixed(1)}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">{t('module.score').toLowerCase()}</span>
                          </div>
                        )}
                        
                        <Badge 
                          variant="outline"
                          className={`text-xs mb-2 ${isCompleted ? 'text-green-600' : ''}`}
                        >
                          {isCompleted ? t('module.complete') : t('dashboard.pending')}
                        </Badge>
                        
                        {processingTime && (
                          <div className="text-xs text-muted-foreground">
                            {t('dashboard.processedIn')} {processingTime.toFixed(2)}ms
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Module Specific Content */}
          <div className="space-y-6">
            {renderModuleContent()}
          </div>

          {/* AI Recommendations Section */}
          {hasRecommendations && moduleRecommendations.length > 0 && (
            <div className="mt-6">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50/50 via-pink-50/30 to-background">
                <CardHeader className="border-b bg-gradient-to-r from-purple-50 via-pink-50 to-background">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Lightbulb className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <span className="text-lg">{t('recommendations.title')}</span>
                        <p className="text-sm text-muted-foreground font-normal mt-1">
                          {moduleRecommendations.length} {t('recommendations.items')} {t('recommendations.aiGenerated').toLowerCase()}
                        </p>
                      </div>
                    </div>
                    
                    {/* Priority Summary */}
                    <div className="flex items-center gap-3 text-sm">
                      {recommendationsByPriority.critical.length > 0 && (
                        <div className="flex items-center gap-1">
                          <AlertCircle className="w-4 h-4 text-red-700" />
                          <span className="font-medium">{recommendationsByPriority.critical.length}</span>
                        </div>
                      )}
                      {recommendationsByPriority.high.length > 0 && (
                        <div className="flex items-center gap-1">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          <span className="font-medium">{recommendationsByPriority.high.length}</span>
                        </div>
                      )}
                      {recommendationsByPriority.medium.length > 0 && (
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-4 h-4 text-yellow-600" />
                          <span className="font-medium">{recommendationsByPriority.medium.length}</span>
                        </div>
                      )}
                      {recommendationsByPriority.low.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Target className="w-4 h-4 text-blue-600" />
                          <span className="font-medium">{recommendationsByPriority.low.length}</span>
                        </div>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Critical Priority */}
                    {recommendationsByPriority.critical.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {t('recommendations.critical')} ({recommendationsByPriority.critical.length})
                        </h4>
                        {recommendationsByPriority.critical.map((rec) => {
                          const priorityConfig = getPriorityConfig('critical')
                          const isExpanded = expandedRecommendations.has(rec.recommendation_id)
                          
                          return (
                            <div
                              key={rec.recommendation_id}
                              className={`border-2 ${priorityConfig.borderColor} rounded-lg overflow-hidden bg-white`}
                            >
                              <button
                                onClick={() => toggleRecommendation(rec.recommendation_id)}
                                className="w-full p-4 flex items-center justify-between hover:bg-red-50/50 transition-colors"
                              >
                                <div className="flex items-center gap-3 flex-1 text-left">
                                  <div className={`p-2 rounded-lg ${priorityConfig.bgColor}`}>
                                    <AlertCircle className={`w-4 h-4 ${priorityConfig.color}`} />
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="font-semibold text-foreground">{rec.title}</h5>
                                    {rec.category && (
                                      <Badge variant="outline" className="text-xs mt-1">
                                        {rec.category}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                )}
                              </button>
                              
                              {isExpanded && (
                                <div className="px-4 pb-4 space-y-3 border-t bg-red-50/30">
                                  <p className="text-sm text-muted-foreground pt-3">
                                    {rec.description}
                                  </p>
                                  
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    {rec.estimated_impact && (
                                      <div className="flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" />
                                        <span>{t('recommendations.impact')}: {rec.estimated_impact}</span>
                                      </div>
                                    )}
                                    {rec.implementation_effort && (
                                      <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{t('recommendations.effort')}: {rec.implementation_effort}</span>
                                      </div>
                                    )}
                                    {rec.confidence_score && (
                                      <div className="flex items-center gap-1">
                                        <Star className="w-3 h-3" />
                                        <span>{t('recommendations.confidence')}: {(rec.confidence_score * 100).toFixed(0)}%</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* High Priority */}
                    {recommendationsByPriority.high.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-red-600 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {t('recommendations.high')} ({recommendationsByPriority.high.length})
                        </h4>
                        {recommendationsByPriority.high.map((rec) => {
                          const priorityConfig = getPriorityConfig('high')
                          const isExpanded = expandedRecommendations.has(rec.recommendation_id)
                          
                          return (
                            <div
                              key={rec.recommendation_id}
                              className={`border ${priorityConfig.borderColor} rounded-lg overflow-hidden bg-white`}
                            >
                              <button
                                onClick={() => toggleRecommendation(rec.recommendation_id)}
                                className="w-full p-4 flex items-center justify-between hover:bg-red-50/30 transition-colors"
                              >
                                <div className="flex items-center gap-3 flex-1 text-left">
                                  <div className={`p-2 rounded-lg ${priorityConfig.bgColor}`}>
                                    <AlertCircle className={`w-4 h-4 ${priorityConfig.color}`} />
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="font-semibold text-foreground">{rec.title}</h5>
                                    {rec.category && (
                                      <Badge variant="outline" className="text-xs mt-1">
                                        {rec.category}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                )}
                              </button>
                              
                              {isExpanded && (
                                <div className="px-4 pb-4 space-y-3 border-t">
                                  <p className="text-sm text-muted-foreground pt-3">
                                    {rec.description}
                                  </p>
                                  
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    {rec.estimated_impact && (
                                      <div className="flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" />
                                        <span>{t('recommendations.impact')}: {rec.estimated_impact}</span>
                                      </div>
                                    )}
                                    {rec.implementation_effort && (
                                      <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{t('recommendations.effort')}: {rec.implementation_effort}</span>
                                      </div>
                                    )}
                                    {rec.confidence_score && (
                                      <div className="flex items-center gap-1">
                                        <Star className="w-3 h-3" />
                                        <span>{t('recommendations.confidence')}: {(rec.confidence_score * 100).toFixed(0)}%</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Medium Priority */}
                    {recommendationsByPriority.medium.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-yellow-600 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          {t('recommendations.medium')} ({recommendationsByPriority.medium.length})
                        </h4>
                        {recommendationsByPriority.medium.map((rec) => {
                          const priorityConfig = getPriorityConfig('medium')
                          const isExpanded = expandedRecommendations.has(rec.recommendation_id)
                          
                          return (
                            <div
                              key={rec.recommendation_id}
                              className={`border ${priorityConfig.borderColor} rounded-lg overflow-hidden bg-white`}
                            >
                              <button
                                onClick={() => toggleRecommendation(rec.recommendation_id)}
                                className="w-full p-4 flex items-center justify-between hover:bg-yellow-50/30 transition-colors"
                              >
                                <div className="flex items-center gap-3 flex-1 text-left">
                                  <div className={`p-2 rounded-lg ${priorityConfig.bgColor}`}>
                                    <TrendingUp className={`w-4 h-4 ${priorityConfig.color}`} />
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="font-semibold text-foreground">{rec.title}</h5>
                                    {rec.category && (
                                      <Badge variant="outline" className="text-xs mt-1">
                                        {rec.category}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                )}
                              </button>
                              
                              {isExpanded && (
                                <div className="px-4 pb-4 space-y-3 border-t">
                                  <p className="text-sm text-muted-foreground pt-3">
                                    {rec.description}
                                  </p>
                                  
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    {rec.estimated_impact && (
                                      <div className="flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" />
                                        <span>{t('recommendations.impact')}: {rec.estimated_impact}</span>
                                      </div>
                                    )}
                                    {rec.implementation_effort && (
                                      <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{t('recommendations.effort')}: {rec.implementation_effort}</span>
                                      </div>
                                    )}
                                    {rec.confidence_score && (
                                      <div className="flex items-center gap-1">
                                        <Star className="w-3 h-3" />
                                        <span>{t('recommendations.confidence')}: {(rec.confidence_score * 100).toFixed(0)}%</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Low Priority */}
                    {recommendationsByPriority.low.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-blue-600 flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          {t('recommendations.low')} ({recommendationsByPriority.low.length})
                        </h4>
                        {recommendationsByPriority.low.map((rec) => {
                          const priorityConfig = getPriorityConfig('low')
                          const isExpanded = expandedRecommendations.has(rec.recommendation_id)
                          
                          return (
                            <div
                              key={rec.recommendation_id}
                              className={`border ${priorityConfig.borderColor} rounded-lg overflow-hidden bg-white`}
                            >
                              <button
                                onClick={() => toggleRecommendation(rec.recommendation_id)}
                                className="w-full p-4 flex items-center justify-between hover:bg-blue-50/30 transition-colors"
                              >
                                <div className="flex items-center gap-3 flex-1 text-left">
                                  <div className={`p-2 rounded-lg ${priorityConfig.bgColor}`}>
                                    <Target className={`w-4 h-4 ${priorityConfig.color}`} />
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="font-semibold text-foreground">{rec.title}</h5>
                                    {rec.category && (
                                      <Badge variant="outline" className="text-xs mt-1">
                                        {rec.category}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                )}
                              </button>
                              
                              {isExpanded && (
                                <div className="px-4 pb-4 space-y-3 border-t">
                                  <p className="text-sm text-muted-foreground pt-3">
                                    {rec.description}
                                  </p>
                                  
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    {rec.estimated_impact && (
                                      <div className="flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" />
                                        <span>{t('recommendations.impact')}: {rec.estimated_impact}</span>
                                      </div>
                                    )}
                                    {rec.implementation_effort && (
                                      <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{t('recommendations.effort')}: {rec.implementation_effort}</span>
                                      </div>
                                    )}
                                    {rec.confidence_score && (
                                      <div className="flex items-center gap-1">
                                        <Star className="w-3 h-3" />
                                        <span>{t('recommendations.confidence')}: {(rec.confidence_score * 100).toFixed(0)}%</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Module Summary */}
          {moduleScore && status.percentage === 100 && (
            <div className="mt-6">
              <Card className="border-success/20 bg-gradient-to-r from-success/5 to-transparent">
                <CardHeader>
                  <CardTitle className="text-success flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    {t(moduleData.name)} {t('dashboard.assessmentComplete')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${getScoreColor(moduleScore)}`}>
                        {moduleScore.toFixed(1)}
                      </div>
                      <div className="text-sm text-muted-foreground">{t('dashboard.overallScore')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary">{status.total}</div>
                      <div className="text-sm text-muted-foreground">{t('dashboard.domainsAssessed')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-success">100%</div>
                      <div className="text-sm text-muted-foreground">{t('module.complete')}</div>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                    <div className="text-sm text-muted-foreground mb-2">{t('dashboard.domainBreakdown')}</div>
                    <div className="flex flex-wrap gap-2">
                      {moduleData.domains.map(domain => {
                        const score = assessmentData.domain_scores?.[domain]
                        return (
                          <div key={domain} className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {domain.replace('_', ' ')}
                            </Badge>
                            {score && (
                              <span className={`text-xs font-bold ${getScoreColor(score)}`}>
                                {score.toFixed(1)}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}