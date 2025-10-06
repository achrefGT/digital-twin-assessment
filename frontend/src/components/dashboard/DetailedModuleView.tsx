import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Brain, Shield, Leaf, CheckCircle, Clock, Sparkles } from 'lucide-react'
import { HumanCentricityPanel } from './panels/HumanCentricityPanel'
import { ResiliencePanel } from './panels/ResiliencePanel'
import { SustainabilityPanel } from './panels/SustainabilityPanel'
import { useLanguage } from '@/contexts/LanguageContext'

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