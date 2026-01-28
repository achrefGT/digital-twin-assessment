import React, { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  X, Brain, Shield, CheckCircle, Clock, Sparkles, Lightbulb, 
  AlertCircle, TrendingUp, Target, Star, ChevronDown, ChevronUp, 
  Zap, RefreshCw, ArrowRight
} from 'lucide-react'
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
  
  const {
    recommendations,
    isLoading: isLoadingRecommendations,
    hasRecommendations,
    cacheMetadata,
    isCacheFresh,
    isWebSocketConnected,
    refreshRecommendations,
    forceRefresh,
    error: recommendationsError
  } = useRecommendations(assessmentData.assessment_id || '')

  useEffect(() => {
    if (cacheMetadata) {
      console.log('📊 [DetailedModuleView] Recommendations Cache Status:', {
        source: cacheMetadata.source,
        age: `${Math.round((Date.now() - cacheMetadata.timestamp) / 1000)}s`,
        isFresh: isCacheFresh,
        assessmentId: assessmentData.assessment_id
      })
    }
  }, [cacheMetadata, isCacheFresh, assessmentData.assessment_id])

  const moduleRecommendations = useMemo(() => {
    if (!recommendations?.recommendations) return []
    
    return recommendations.recommendations.filter(rec => 
      moduleData.domains.includes(rec.domain)
    )
  }, [recommendations, moduleData.domains])

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
        return <HumanCentricityPanel data={assessmentData.domain_data.human_centricity} />
      
      case 'resilience':
        return <ResiliencePanel data={assessmentData.domain_data.resilience} />
      
      case 'sustainability':
        return <SustainabilityPanel data={assessmentData.domain_data.sustainability} />
      
      default:
        return (
          <div className="text-center text-muted-foreground py-8">
            {t('dashboard.noDetailedView')}
          </div>
        )
    }
  }

  const renderRecommendationItem = (rec: any, priority: 'critical' | 'high' | 'medium' | 'low', index: number) => {
    const priorityConfig = getPriorityConfig(priority)
    const uniqueId = rec.recommendation_id || `${priority}-${rec.domain}-${index}`
    const isExpanded = expandedRecommendations.has(uniqueId)
    const IconComponent = priorityConfig.icon
        
    return (
      <div
        key={uniqueId}
        className={`group relative rounded-lg border transition-all duration-200 ${
          priority === 'critical' ? 'border-2' : ''
        } ${priorityConfig.borderColor} bg-white hover:shadow-md`}
      >
        <button
          onClick={() => toggleRecommendation(uniqueId)}
          className={`w-full p-4 flex items-center justify-between transition-colors`}
        >
          <div className="flex items-center gap-4 flex-1 text-left">
            <div className={`p-3 rounded-lg ${priorityConfig.bgColor} group-hover:scale-110 transition-transform`}>
              <IconComponent className={`w-5 h-5 ${priorityConfig.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="font-semibold text-foreground leading-tight">{rec.title}</h5>
              {rec.category && (
                <Badge variant="outline" className="text-xs mt-2">
                  {rec.category}
                </Badge>
              )}
            </div>
          </div>
          <div className="ml-4">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </button>
        
        {isExpanded && (
          <div className={`px-4 pb-4 space-y-4 border-t transition-colors ${
            priority === 'critical' ? priorityConfig.bgColor + '/20' : ''
          }`}>
            <p className="text-sm text-muted-foreground leading-relaxed pt-4">
              {rec.description}
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {rec.estimated_impact && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground font-medium">
                      {t('recommendations.impact')}
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {rec.estimated_impact}
                    </div>
                  </div>
                </div>
              )}
              {rec.implementation_effort && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Clock className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground font-medium">
                      {t('recommendations.effort')}
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {rec.implementation_effort}
                    </div>
                  </div>
                </div>
              )}
              {rec.confidence_score && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Star className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground font-medium">
                      {t('recommendations.confidence')}
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {(rec.confidence_score * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden border border-border/50">
        {/* Enhanced Header */}
          <div className="relative overflow-hidden">
            {/* Background gradient */}
            <div className={`absolute inset-0 ${
              module === 'human_centricity' 
                ? 'bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-blue-400/10'
                : module === 'resilience'
                ? 'bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-400/10'
                : 'bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-400/10'
            }`} />
          
          <div className="relative p-6 border-b border-border/50">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-4 flex-1">
                <div className={`p-3 rounded-xl shadow-lg ${
                  module === 'human_centricity'
                    ? 'bg-gradient-to-br from-blue-100 to-cyan-100'
                    : module === 'resilience'
                    ? 'bg-gradient-to-br from-purple-100 to-pink-100'
                    : 'bg-gradient-to-br from-green-100 to-emerald-100'
                }`}>
                  <ModuleIcon className={`h-7 w-7 ${
                    module === 'human_centricity'
                      ? 'text-blue-600'
                      : module === 'resilience'
                      ? 'text-purple-600'
                      : 'text-green-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {t(moduleData.name)}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('dashboard.detailedView')}
                  </p>
                  
                  {/* Header Stats */}
                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium">
                        {status.completed}/{status.total} {t('assessments.domains').toLowerCase()}
                      </span>
                    </div>
                    
                    {moduleScore && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                        module === 'human_centricity'
                          ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200/50'
                          : module === 'resilience'
                          ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200/50'
                          : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200/50'
                      }`}>
                        <span className={`text-sm font-bold ${getScoreColor(moduleScore)}`}>
                          {moduleScore.toFixed(1)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t('module.score')}
                        </span>
                      </div>
                    )}
                    
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      status.percentage === 100
                        ? 'bg-green-50 border border-green-200/50'
                        : 'bg-yellow-50 border border-yellow-200/50'
                    }`}>
                      <span className={`text-sm font-medium ${
                        status.percentage === 100 ? 'text-green-700' : 'text-yellow-700'
                      }`}>
                        {status.percentage.toFixed(0)}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t('module.complete')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClose} 
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:!text-red-700 hover:!bg-red-50 focus:!text-red-700 transition-colors duration-150"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Module Specific Content */}
          <div className="space-y-6 mb-6">
            {renderModuleContent()}
          </div>

          {/* Enhanced AI Recommendations Section */}
          {(hasRecommendations || isLoadingRecommendations) && (
            <div>
              <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50/50 via-transparent to-pink-50/30 overflow-hidden">
                {/* Premium Header */}
                <CardHeader className="pb-4 border-b border-border/30 bg-gradient-to-r from-purple-50/80 to-pink-50/30">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg shadow-md">
                        <Lightbulb className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">
                          {t('recommendations.title')}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {isLoadingRecommendations 
                            ? t('recommendations.loading') || 'Loading recommendations...'
                            : `${moduleRecommendations.length} ${t('recommendations.items')} ${t('recommendations.aiGenerated').toLowerCase()}`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Priority Summary */}
                  {!isLoadingRecommendations && hasRecommendations && (
                    <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30">
                      {recommendationsByPriority.critical.length > 0 && (
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <div className="w-2 h-2 rounded-full bg-red-600" />
                          <span className="text-red-700">{recommendationsByPriority.critical.length} Critical</span>
                        </div>
                      )}
                      {recommendationsByPriority.high.length > 0 && (
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-red-600">{recommendationsByPriority.high.length} High</span>
                        </div>
                      )}
                      {recommendationsByPriority.medium.length > 0 && (
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <div className="w-2 h-2 rounded-full bg-yellow-500" />
                          <span className="text-yellow-600">{recommendationsByPriority.medium.length} Medium</span>
                        </div>
                      )}
                      {recommendationsByPriority.low.length > 0 && (
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-blue-600">{recommendationsByPriority.low.length} Low</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardHeader>
                
                <CardContent className="p-6">
                  {/* Loading State */}
                  {isLoadingRecommendations && !hasRecommendations && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="relative w-12 h-12 mb-4">
                        <RefreshCw className="w-full h-full text-purple-500 animate-spin" />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {t('recommendations.loading') || 'Loading recommendations...'}
                      </p>
                      {isWebSocketConnected && (
                        <p className="text-xs text-green-600 mt-3">
                          Connected - waiting for real-time updates
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Error State */}
                  {recommendationsError && !hasRecommendations && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="p-3 rounded-full bg-red-100 mb-3">
                        <AlertCircle className="w-6 h-6 text-red-600" />
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        Error loading recommendations
                      </p>
                      <p className="text-sm text-muted-foreground mb-4">{recommendationsError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refreshRecommendations(true)}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Try Again
                      </Button>
                    </div>
                  )}
                  
                  {/* No Recommendations */}
                  {!isLoadingRecommendations && !hasRecommendations && !recommendationsError && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="p-3 rounded-full bg-gray-100 mb-3">
                        <Lightbulb className="w-6 h-6 text-gray-500" />
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">
                        {t('recommendations.noRecommendations') || 'No recommendations available yet'}
                      </p>
                      <p className="text-xs text-muted-foreground text-center">
                        {isWebSocketConnected 
                          ? 'Waiting for recommendations to be generated...'
                          : 'Complete your assessment to receive recommendations'}
                      </p>
                    </div>
                  )}
                  
                  {/* Recommendations List */}
                  {hasRecommendations && moduleRecommendations.length > 0 && (
                    <div className="space-y-6">
                      {/* Critical Priority */}
                      {recommendationsByPriority.critical.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-bold text-red-700 flex items-center gap-2 uppercase tracking-wide">
                            <AlertCircle className="w-4 h-4" />
                            Critical Issues ({recommendationsByPriority.critical.length})
                          </h4>
                          <div className="space-y-3">
                            {recommendationsByPriority.critical.map((rec, idx) => renderRecommendationItem(rec, 'critical', idx))}
                          </div>
                        </div>
                      )}

                      {/* High Priority */}
                      {recommendationsByPriority.high.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-bold text-red-600 flex items-center gap-2 uppercase tracking-wide">
                            <AlertCircle className="w-4 h-4" />
                            High Priority ({recommendationsByPriority.high.length})
                          </h4>
                          <div className="space-y-3">
                            {recommendationsByPriority.high.map((rec, idx) => renderRecommendationItem(rec, 'high', idx))}
                          </div>
                        </div>
                      )}

                      {/* Medium Priority */}
                      {recommendationsByPriority.medium.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-bold text-yellow-600 flex items-center gap-2 uppercase tracking-wide">
                            <TrendingUp className="w-4 h-4" />
                            Medium Priority ({recommendationsByPriority.medium.length})
                          </h4>
                          <div className="space-y-3">
                            {recommendationsByPriority.medium.map((rec, idx) => renderRecommendationItem(rec, 'medium', idx))}
                          </div>
                        </div>
                      )}

                      {/* Low Priority */}
                      {recommendationsByPriority.low.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-bold text-blue-600 flex items-center gap-2 uppercase tracking-wide">
                            <Target className="w-4 h-4" />
                            Low Priority ({recommendationsByPriority.low.length})
                          </h4>
                          <div className="space-y-3">
                            {recommendationsByPriority.low.map((rec, idx) => renderRecommendationItem(rec, 'low', idx))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* No Module-Specific Recommendations */}
                  {hasRecommendations && moduleRecommendations.length === 0 && (
                    <div className="text-center py-8">
                      <Lightbulb className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                      <p className="text-sm text-muted-foreground">
                        {t('recommendations.noModuleRecommendations') || 'No recommendations for this module'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Module Summary */}
          {moduleScore && status.percentage === 100 && (
            <div className="mt-6">
              <Card className="mb-4 pb-4 border-success/20 bg-gradient-to-r from-success/5 to-transparent">
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
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}