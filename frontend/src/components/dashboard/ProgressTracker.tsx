import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Circle, Brain, Shield, Sparkles } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

interface ProgressTrackerProps {
  modules: Record<string, {
    name: string
    domains: string[]
  }>
  completedDomains: string[]
  domainData: Record<string, any>
  domainScores?: Record<string, number>
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  modules,
  completedDomains,
  domainData,
  domainScores
}) => {
  const { t } = useLanguage()

  const getModuleIcon = (moduleKey: string) => {
    switch (moduleKey) {
      case 'human_centricity': return Brain
      case 'resilience': return Shield
      case 'sustainability': return Sparkles
      default: return Circle
    }
  }

  const getModuleStatus = (moduleKey: string) => {
    const module = modules[moduleKey]
    const completed = module.domains.filter(domain => completedDomains.includes(domain))
    return {
      completed: completed.length,
      total: module.domains.length,
      percentage: (completed.length / module.domains.length) * 100,
      isComplete: completed.length === module.domains.length
    }
  }

  const getModuleScore = (moduleKey: string) => {
    const module = modules[moduleKey]
    const scores = module.domains
      .map(domain => domainScores?.[domain])
      .filter(score => score !== undefined) as number[]
    
    if (scores.length === 0) return undefined
    return scores.reduce((sum, score) => sum + score, 0) / scores.length
  }

  const getScoreColor = (score?: number) => {
    if (!score) return 'muted'
    if (score >= 80) return 'success'
    if (score >= 60) return 'warning'
    return 'destructive'
  }

  const totalDomains = Object.values(modules).reduce((sum, module) => sum + module.domains.length, 0)
  const totalCompleted = completedDomains.length
  const overallPercentage = (totalCompleted / totalDomains) * 100

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {t('module.assessmentProgress')}
          <span className="text-2xl font-bold text-blue-600">{overallPercentage.toFixed(0)}%</span>
        </CardTitle>
        <Progress value={overallPercentage} className="h-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(modules).map(([moduleKey, module]) => {
          const status = getModuleStatus(moduleKey)
          const score = getModuleScore(moduleKey)
          const Icon = getModuleIcon(moduleKey)

          return (
            <div key={moduleKey} className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border">
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${status.isComplete ? 'text-success' : 'text-muted-foreground'}`} />
                  <div>
                    <div className="font-medium">{module.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {status.completed}/{status.total} {t('assessments.domains').toLowerCase()} • {status.percentage.toFixed(0)}% {t('module.complete').toLowerCase()}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {score && (
                    <div className="text-right">
                      <div className={`text-lg font-bold text-${getScoreColor(score)}`}>
                        {score.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">{t('module.score')}</div>
                    </div>
                  )}
                  <Badge 
                    variant='secondary'
                    className={status.isComplete ? 'text-green-600' : ''}
                  >
                    {status.isComplete ? t('module.complete') : t('assessments.inProgress')}
                  </Badge>
                </div>
              </div>

              <div className="ml-8 space-y-2">
                {module.domains.map((domain) => {
                  const isCompleted = completedDomains.includes(domain)
                  const data = domainData[domain]
                  const domainScore = domainScores?.[domain]
                  const processingTime = data?.processing_time_ms

                  return (
                    <div
                      key={domain}
                      className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        {isCompleted ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <div className="text-sm font-medium capitalize">
                            {domain.replace('_', ' ')}
                          </div>
                          {processingTime && (
                            <div className="text-xs text-muted-foreground">
                              {t('dashboard.processedIn')} {processingTime.toFixed(2)}ms
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {domainScore !== undefined && (
                          <div className="text-right">
                            <div className={`text-sm font-bold text-${getScoreColor(domainScore)}`}>
                              {domainScore.toFixed(1)}
                            </div>
                            <div className="text-xs text-muted-foreground">{t('module.score')}</div>
                          </div>
                        )}
                        <Badge
                          variant={isCompleted ? 'secondary' : 'outline'}
                          className={`text-xs ${isCompleted ? 'text-green-600' : ''}`}
                        >
                          {isCompleted ? t('module.complete') : t('dashboard.pending')}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="pt-4 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{totalCompleted}</div>
              <div className="text-sm text-muted-foreground">{t('summaryStats.completed')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-warning">{totalDomains - totalCompleted}</div>
              <div className="text-sm text-muted-foreground">{t('assessments.progress')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-success">{overallPercentage.toFixed(0)}%</div>
              <div className="text-sm text-muted-foreground">{t('assessments.progress')}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}