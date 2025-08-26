import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Leaf, DollarSign, Users, TrendingUp, Factory, Droplets, CheckCircle2, Sparkles } from 'lucide-react'

interface SustainabilityPanelProps {
  elcaData?: {
    scores?: {
      elca_score?: number
      environmental_rating?: string
      key_performance_indicators?: {
        carbon_footprint_kg_co2_per_unit?: number
        water_footprint_m3_per_unit?: number
        improvement_potential?: number
      }
    }
  }
  slcaData?: {
    scores?: {
      overall_score?: number
      social_sustainability_rating?: string
      social_performance_trend?: string
      key_metrics?: {
        avg_safety_reduction?: number
        avg_worker_satisfaction?: number
        total_jobs_created?: number
      }
    }
  }
  lccData?: {
    scores?: {
      economic_sustainability_score?: number
      sustainability_rating?: string
      npv?: number
      irr?: number
      payback_period?: number
      roi?: number
    }
  }
  moduleScore?: number
}

export const SustainabilityPanel: React.FC<SustainabilityPanelProps> = ({
  elcaData,
  slcaData,
  lccData,
  moduleScore
}) => {
  const hasAnyData = elcaData?.scores || slcaData?.scores || lccData?.scores

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-500'
  }

  const getRatingColor = (rating: string) => {
    const colors = {
      'excellent': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'good': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'fair': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      'poor': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      'very poor': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }
    return colors[rating?.toLowerCase()] || 'bg-muted text-muted-foreground'
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value)
  }

  const getCompletionStatus = () => {
    const domains = [
      { name: 'Environmental', data: elcaData?.scores, color: 'bg-green-500' },
      { name: 'Social', data: slcaData?.scores, color: 'bg-blue-500' },
      { name: 'Economic', data: lccData?.scores, color: 'bg-purple-500' }
    ]

    const completed = domains.filter(d => d.data)
    return {
      completed: completed.length,
      total: 3,
      percentage: (completed.length / 3) * 100,
      domains: completed
    }
  }

  const status = getCompletionStatus()

  if (!hasAnyData) {
    return (
      <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50/30 via-blue-50/20 to-purple-50/30 dark:from-emerald-950/10 dark:via-blue-950/10 dark:to-purple-950/10">
        <CardContent className="pt-0">
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="relative">
              <div className="p-4 rounded-full bg-muted/20 mb-4">
                <Sparkles className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-blue-500 opacity-20 animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Awaiting sustainability assessment</p>
              <p className="text-xs text-muted-foreground/70">Environmental • Social • Economic</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50/30 via-blue-50/20 to-purple-50/30 dark:from-emerald-950/10 dark:via-blue-950/10 dark:to-purple-950/10">
      <CardHeader className="pb-1"></CardHeader>
      
      <CardContent className="space-y-6 pt-0">
        {/* Environmental Summary */}
        {elcaData?.scores && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-green-50/60 to-emerald-50/40 dark:from-green-950/20 dark:to-emerald-950/10 border border-green-200/30 dark:border-green-800/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Leaf className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Environmental Impact</span>
              </div>
              <div className="flex items-center gap-2">
                {elcaData.scores.elca_score && (
                  <span className={`text-sm font-bold ${getScoreColor(elcaData.scores.elca_score)}`}>
                    {elcaData.scores.elca_score.toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            {elcaData.scores.key_performance_indicators && (
              <div className="grid grid-cols-3 gap-2">
                {elcaData.scores.key_performance_indicators.carbon_footprint_kg_co2_per_unit && (
                  <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-white/5">
                    <Factory className="h-3 w-3 mx-auto mb-1 text-orange-500" />
                    <div className="text-xs font-bold">{elcaData.scores.key_performance_indicators.carbon_footprint_kg_co2_per_unit.toFixed(3)}</div>
                    <div className="text-xs text-muted-foreground">CO₂/unit</div>
                  </div>
                )}
                
                {elcaData.scores.key_performance_indicators.water_footprint_m3_per_unit && (
                  <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-white/5">
                    <Droplets className="h-3 w-3 mx-auto mb-1 text-blue-500" />
                    <div className="text-xs font-bold">{elcaData.scores.key_performance_indicators.water_footprint_m3_per_unit.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">m³/unit</div>
                  </div>
                )}

                {elcaData.scores.key_performance_indicators.improvement_potential && (
                  <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-white/5">
                    <TrendingUp className="h-3 w-3 mx-auto mb-1 text-green-500" />
                    <div className="text-xs font-bold">{elcaData.scores.key_performance_indicators.improvement_potential.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">Potential</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Social Summary */}
        {slcaData?.scores && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/60 to-cyan-50/40 dark:from-blue-950/20 dark:to-cyan-950/10 border border-blue-200/30 dark:border-blue-800/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Social Impact</span>
              </div>
              <div className="flex items-center gap-2">
                {slcaData.scores.overall_score && (
                  <span className={`text-sm font-bold ${getScoreColor(slcaData.scores.overall_score)}`}>
                    {slcaData.scores.overall_score.toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            {slcaData.scores.key_metrics && (
              <div className="grid grid-cols-3 gap-2">
                {slcaData.scores.key_metrics.avg_safety_reduction !== undefined && (
                  <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-white/5">
                    <div className="text-xs font-bold">{slcaData.scores.key_metrics.avg_safety_reduction.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">Safety ↓</div>
                  </div>
                )}
                
                {slcaData.scores.key_metrics.avg_worker_satisfaction !== undefined && (
                  <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-white/5">
                    <div className="text-xs font-bold">{slcaData.scores.key_metrics.avg_worker_satisfaction.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">Satisfaction</div>
                  </div>
                )}
                
                {slcaData.scores.key_metrics.total_jobs_created !== undefined && (
                  <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-white/5">
                    <div className="text-xs font-bold">{slcaData.scores.key_metrics.total_jobs_created.toFixed(0)}</div>
                    <div className="text-xs text-muted-foreground">Jobs</div>
                  </div>
                )}
              </div>
            )}

            {slcaData.scores.social_performance_trend && (
              <div className="mt-2 text-center">
                <Badge variant="outline" className="text-xs border-blue-200 dark:border-blue-800">
                  {slcaData.scores.social_performance_trend}
                </Badge>
              </div>
            )}
          </div>
        )}

        {/* Economic Summary */}
        {lccData?.scores && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50/60 to-indigo-50/40 dark:from-purple-950/20 dark:to-indigo-950/10 border border-purple-200/30 dark:border-purple-800/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Economic Viability</span>
              </div>
              <div className="flex items-center gap-2">
                {lccData.scores.economic_sustainability_score && (
                  <span className={`text-sm font-bold ${getScoreColor(lccData.scores.economic_sustainability_score)}`}>
                    {lccData.scores.economic_sustainability_score.toFixed(1)}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {lccData.scores.npv && (
                <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-white/5">
                  <div className="text-xs font-bold">{formatCurrency(lccData.scores.npv)}</div>
                  <div className="text-xs text-muted-foreground">NPV</div>
                </div>
              )}
              
              {lccData.scores.irr && (
                <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-white/5">
                  <div className="text-xs font-bold">{(lccData.scores.irr * 100).toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">IRR</div>
                </div>
              )}
              
              {lccData.scores.payback_period && (
                <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-white/5">
                  <div className="text-xs font-bold">{lccData.scores.payback_period} yr</div>
                  <div className="text-xs text-muted-foreground">Payback</div>
                </div>
              )}
              
              {lccData.scores.roi && (
                <div className="text-center p-2 rounded-lg bg-white/50 dark:bg-white/5">
                  <div className="text-xs font-bold">{lccData.scores.roi.toFixed(1)}x</div>
                  <div className="text-xs text-muted-foreground">ROI</div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}