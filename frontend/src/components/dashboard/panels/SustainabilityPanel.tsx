import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/contexts/LanguageContext'
import { Leaf, Globe, TrendingUp, Sparkles } from 'lucide-react'

interface SustainabilityPanelProps {
  data?: any
}

export const SustainabilityPanel: React.FC<SustainabilityPanelProps> = ({ data }) => {
  const { t } = useLanguage()
  
  // Try multiple paths to extract sustainability_metrics
  const sustainability_metrics = data?.sustainability_metrics || 
                                data?.scores?.sustainability_metrics ||
                                data?.detailed_metrics?.sustainability_metrics

  // Extract dimension_scores from multiple possible locations
  const dimension_scores = data?.dimension_scores || 
                          data?.scores?.dimension_scores || 
                          data?.domain_scores || 
                          data?.scores?.domain_scores

  console.log('🔍 SustainabilityPanel received data:', JSON.stringify(data, null, 2))
  console.log('🔍 Extracted dimension_scores:', dimension_scores)
  console.log('🔍 Extracted sustainability_metrics:', sustainability_metrics)

  if (!dimension_scores && !sustainability_metrics) {
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

  // Extract key insights from sustainability metrics
  const getKeyInsights = () => {
    const insights: Array<{label: string, value: string, type: string}> = []
    
    // Selected domains count
    if (sustainability_metrics?.selected_domains?.length) {
      insights.push({
        label: t('sustainability.domainsAssessed'),
        value: `${sustainability_metrics.selected_domains.length}/3`,
        type: 'count'
      })
    }

    // Extract detailed metrics from all selected domains
    if (sustainability_metrics?.detailed_metrics && typeof sustainability_metrics.detailed_metrics === 'object') {
      const detailedMetrics = sustainability_metrics.detailed_metrics as Record<string, any>
      
      // Process each selected domain
      Object.entries(detailedMetrics).forEach(([domainKey, metrics]) => {
        if (!metrics || typeof metrics !== 'object') return
        
        const metricsObj = metrics as Record<string, any>
        
        // Find criteria entries (e.g., ENV_01, SOC_01, etc.)
        const criteria = Object.entries(metricsObj)
          .filter(([key]) => /^[A-Z]{3}_\d{2}/.test(key))
        
        if (criteria.length > 0) {
          // Get the first criterion
          const [firstKey, firstValue] = criteria[0]
          const criterionData = firstValue as any
          
          if (criterionData?.description && criterionData.description !== 'None') {
            const domainLabel = domainKey.charAt(0).toUpperCase() + domainKey.slice(1)
            insights.push({
              label: `${domainLabel} - ${firstKey}`,
              value: criterionData.description || criterionData.level,
              type: 'level'
            })
          }
        }
      })
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
                        <span className={`text-sm font-semibold w-8 text-right ${getScoreColor(score)}`}>
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
              {sustainability_metrics.recommendations.map((recommendation: string, index: number) => (
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