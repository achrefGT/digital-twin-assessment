import React from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/contexts/LanguageContext'
import { Shield, RefreshCw, Zap, Clock, Wrench, AlertTriangle, Sparkles } from 'lucide-react'

interface ResiliencePanelProps {
  data?: any
}

export const ResiliencePanel: React.FC<ResiliencePanelProps> = ({ data }) => {
  const { t } = useLanguage()

  // Extract from either nested scores object or flat structure
  const overall_score = data?.overall_score || data?.scores?.overall_score || data?.score_value
  const domain_scores = data?.domain_scores || data?.scores?.domain_scores || data?.scores
  const risk_metrics = data?.risk_metrics || data?.scores?.risk_metrics

  console.log('🔍 ResiliencePanel received data:', JSON.stringify(data, null, 2))
  console.log('🔍 Extracted domain_scores:', domain_scores)
  console.log('🔍 Extracted risk_metrics:', risk_metrics)

  if (!domain_scores && !risk_metrics) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-0">
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="relative">
              <div className="p-4 rounded-full bg-muted/20 mb-4">
                <Sparkles className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-slate-400 to-purple-500 opacity-20 animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('resilience.awaiting')}</p>
              <p className="text-xs text-muted-foreground/70">{t('module.resilience')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  const categories = [
    { key: 'Robustness', label: 'Robustness', icon: Shield, color: '#3b82f6' },
    { key: 'Redundancy', label: 'Redundancy', icon: RefreshCw, color: '#8b5cf6' },
    { key: 'Adaptability', label: 'Adaptability', icon: Zap, color: '#f59e0b' },
    { key: 'Rapidity', label: 'Rapidity', icon: Clock, color: '#06b6d4' },
    { key: 'PHM', label: 'PHM', icon: Wrench, color: '#10b981' }
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

  const getRiskLevel = (risk: number) => {
    if (risk <= 5) return { label: t('resilience.low'), color: 'text-emerald-600', bgColor: 'bg-emerald-50' }
    if (risk <= 10) return { label: t('resilience.medium'), color: 'text-amber-600', bgColor: 'bg-amber-50' }
    if (risk <= 15) return { label: t('resilience.high'), color: 'text-orange-600', bgColor: 'bg-orange-50' }
    return { label: t('resilience.critical'), color: 'text-red-600', bgColor: 'bg-red-50' }
  }

  // Get key insights - only most important metrics
  const getKeyInsights = () => {
    const insights = []
    
    if (risk_metrics?.overall_mean_risk !== undefined) {
      const riskLevel = getRiskLevel(risk_metrics.overall_mean_risk)
      insights.push({
        label: t('resilience.riskLevel'),
        value: riskLevel.label,
        color: riskLevel.color,
        bgColor: riskLevel.bgColor
      })
    }

    if (risk_metrics?.total_scenarios) {
      insights.push({
        label: t('resilience.scenarios'),
        value: risk_metrics.total_scenarios.toString(),
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
      })
    }

    return insights
  }

  const keyInsights = getKeyInsights()

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-1"></CardHeader>
      
      <CardContent className="space-y-6">
        {/* Domain Scores Grid */}
        {domain_scores && (
          <div className="grid grid-cols-1 gap-4">
            {categories.map(({ key, label, icon: Icon, color }) => {
              const score = domain_scores[key as keyof typeof domain_scores]
              if (score === undefined) return null

              return (
                <div key={key} className="flex items-center justify-between group hover:bg-slate-50 p-3 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}15` }}>
                      <Icon className="h-3.5 w-3.5" style={{ color }} />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{label}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${getProgressColor(score)}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-900 w-8 text-right">
                      {score.toFixed(0)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Risk Overview - Only if we have risk data */}
        {risk_metrics && (
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-slate-500" />
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {t('resilience.riskAssessment')}
              </div>
            </div>
            
            {/* Key Risk Metrics */}
            {keyInsights.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                {keyInsights.map((insight, index) => (
                  <div key={index} className={`rounded-lg p-3 text-center ${insight.bgColor || 'bg-slate-50'}`}>
                    <div className={`text-lg font-semibold mb-1 ${insight.color || 'text-slate-900'}`}>
                      {insight.value}
                    </div>
                    <div className="text-xs text-slate-500">
                      {insight.label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Risk Score Display */}
            {risk_metrics.overall_mean_risk !== undefined && (
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-slate-900 mb-1">
                  {risk_metrics.overall_mean_risk.toFixed(1)}
                </div>
                <div className="text-xs text-slate-500 mb-2">
                  {t('resilience.meanRiskScore')}
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all duration-500"
                    style={{ width: `${(risk_metrics.overall_mean_risk / 20) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}