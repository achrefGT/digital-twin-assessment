import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/contexts/LanguageContext'
import { Leaf, Zap, Factory, Globe, TrendingUp, Sparkles } from 'lucide-react'

interface SustainabilityPanelProps {
  data?: {
    scores?: {
      overall_score?: number
      dimension_scores?: {
        environmental?: number
        social?: number
        economic?: number
      }
      sustainability_metrics?: {
        selected_domains?: string[]
        domain_count?: number
        dimension_weights?: Record<string, number>
        detailed_metrics?: {
          environmental?: Record<string, any>
          social?: Record<string, any>
          economic?: Record<string, any>
        }
        score_distribution?: {
          min?: number
          max?: number
          std?: number
        }
        recommendations?: string[]
      }
    }
  }
}

export const SustainabilityPanel: React.FC<SustainabilityPanelProps> = ({ data }) => {
  const { t } = useLanguage()
  if (!data?.scores) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-0">
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="relative">
              <div className="p-4 rounded-full bg-muted/20 mb-4">
                <Sparkles className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-green-900 to-green-400 opacity-20 animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('sustainability.awaiting')}</p>
              <p className="text-xs text-muted-foreground/70">{t('sustainability.tripleBottomLine')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { overall_score, dimension_scores, sustainability_metrics } = data.scores
  
  const dimensions = [
    { key: 'environmental', label: t('domain.sustainability.environmental'), icon: Leaf, color: '#10b981' },
    { key: 'social', label: t('domain.sustainability.social'), icon: Globe, color: '#3b82f6' },
    { key: 'economic', label: t('domain.sustainability.economic'), icon: TrendingUp, color: '#f59e0b' }
  ]

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-500'
  }

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500'
    if (score >= 60) return 'bg-amber-500'
    return 'bg-red-500'
  }

  // Extract key insights from sustainability metrics - now using ENV_* keys
  const getKeyInsights = () => {
    const insights = []
    
    // Selected domains count
    if (sustainability_metrics?.selected_domains?.length) {
      insights.push({
        label: t('sustainability.domainsAssessed'),
        value: `${sustainability_metrics.selected_domains.length}/3`,
        type: 'count'
      })
    }

    // Environmental metrics if available - look for ENV_* keys
    if (sustainability_metrics?.detailed_metrics?.environmental) {
      const envMetrics = sustainability_metrics.detailed_metrics.environmental
      
      // Find the first valid ENV_* criterion with description
      const envCriteria = Object.entries(envMetrics).filter(([key]) => key.startsWith('ENV_'))
      
      if (envCriteria.length > 0) {
        // Get the first criterion (typically ENV_01 - Digital Twin Realism)
        const [firstKey, firstValue] = envCriteria[0]
        if (firstValue?.description && firstValue.description !== 'None') {
          insights.push({
            label: t('sustainability.dtRealism'),
            value: firstValue.description,
            type: 'level'
          })
        }
        
        // Get energy tracking info (typically ENV_03)
        const energyKey = envCriteria.find(([key]) => key === 'ENV_03')
        if (energyKey && energyKey[1]?.description && energyKey[1].description !== 'None') {
          insights.push({
            label: t('sustainability.energyTracking'),
            value: energyKey[1].description,
            type: 'level'
          })
        }
      }
    }

    return insights.slice(0, 2) // Only show top 2 insights
  }

  const keyInsights = getKeyInsights()

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-1"></CardHeader>
      
      <CardContent className="space-y-6">
        {/* Dimension Scores Grid */}
        {dimension_scores && (
          <div className="grid grid-cols-1 gap-4">
            {dimensions.map(({ key, label, icon: Icon, color }) => {
              const score = dimension_scores[key as keyof typeof dimension_scores]
              const isSelected = sustainability_metrics?.selected_domains?.includes(key)
              
              // Only show dimensions that have scores or are selected
              if (score === undefined && !isSelected) return null

              return (
                <div key={key} className={`flex items-center justify-between group hover:bg-slate-50 p-3 rounded-xl transition-colors ${!score ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}15` }}>
                      <Icon className="h-3.5 w-3.5" style={{ color }} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">{label}</span>
                      {!score && isSelected && (
                        <Badge variant="outline" className="text-xs w-fit mt-1">
                          {t('sustainability.selected')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {score !== undefined ? (
                      <>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${getProgressColor(score)}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-slate-900 w-8 text-right">
                          {score.toFixed(0)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 w-20 text-right">
                        {t('dashboard.pending')}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Key Insights - Only if we have meaningful data */}
        {keyInsights.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
              {t('dashboard.keyInsights')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {keyInsights.map((insight, index) => (
                <div key={index} className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold text-slate-900 mb-1">
                    {insight.value}
                  </div>
                  <div className="text-xs text-slate-500">
                    {insight.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations - Only if available */}
        {sustainability_metrics?.recommendations && sustainability_metrics.recommendations.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
              {t('sustainability.recommendations')}
            </div>
            <div className="space-y-2">
              {sustainability_metrics.recommendations.map((recommendation, index) => (
                <div key={index} className="text-xs text-slate-600 bg-blue-50 p-2 rounded-lg border-l-2 border-blue-200">
                  {recommendation}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}