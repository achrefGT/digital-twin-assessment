import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Leaf, Droplets, Factory, TrendingDown, AlertCircle } from 'lucide-react'

interface ELCAPanelProps {
  data?: {
    scores?: {
      elca_score?: number
      environmental_rating?: string
      category_breakdown?: {
        category_scores?: Record<string, number>
        weighted_contributions?: Record<string, number>
      }
      performance_analysis?: {
        best_performing_category?: string
        worst_performing_category?: string
        improvement_priorities?: string[]
      }
      key_performance_indicators?: {
        carbon_footprint_kg_co2_per_unit?: number
        water_footprint_m3_per_unit?: number
        improvement_potential?: number
      }
    }
  }
}

export const ELCAPanel: React.FC<ELCAPanelProps> = ({ data }) => {
  if (!data?.scores) {
    return (
      <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50/50 to-emerald-50/30 dark:from-green-950/20 dark:to-emerald-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-lg font-medium">
            <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Leaf className="h-4 w-4 text-green-600" />
            </div>
            Environmental LCA
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted/30 mb-4">
              <Leaf className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">Awaiting environmental assessment</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { 
    elca_score, 
    environmental_rating, 
    category_breakdown, 
    performance_analysis,
    key_performance_indicators 
  } = data.scores

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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-500'
  }

  const formatCategoryName = (category: string) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50/50 to-emerald-50/30 dark:from-green-950/20 dark:to-emerald-950/10">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Leaf className="h-4 w-4 text-green-600" />
            </div>
            <span className="text-lg font-medium">Environmental LCA</span>
          </div>
          <div className="flex items-center gap-2">
            {environmental_rating && (
              <Badge variant="secondary" className={`${getRatingColor(environmental_rating)} border-0 font-medium`}>
                {environmental_rating}
              </Badge>
            )}
            {elca_score && (
              <div className={`text-xl font-bold ${getScoreColor(elca_score)}`}>
                {elca_score.toFixed(1)}
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6 pt-0">
        {/* Key Performance Indicators */}
        {key_performance_indicators && (
          <div className="grid grid-cols-3 gap-3">
            {key_performance_indicators.carbon_footprint_kg_co2_per_unit && (
              <div className="p-4 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-white/20">
                <Factory className="h-5 w-5 text-orange-500 mb-2" />
                <div className="text-lg font-bold text-foreground">
                  {key_performance_indicators.carbon_footprint_kg_co2_per_unit.toFixed(3)}
                </div>
                <div className="text-xs text-muted-foreground">kg CO₂/unit</div>
              </div>
            )}
            
            {key_performance_indicators.water_footprint_m3_per_unit && (
              <div className="p-4 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-white/20">
                <Droplets className="h-5 w-5 text-blue-500 mb-2" />
                <div className="text-lg font-bold text-foreground">
                  {key_performance_indicators.water_footprint_m3_per_unit.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">m³/unit</div>
              </div>
            )}
            
            {key_performance_indicators.improvement_potential && (
              <div className="p-4 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-white/20">
                <TrendingDown className="h-5 w-5 text-green-500 mb-2" />
                <div className="text-lg font-bold text-foreground">
                  {key_performance_indicators.improvement_potential.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Improvement</div>
              </div>
            )}
          </div>
        )}

        {/* Category Scores */}
        {category_breakdown?.category_scores && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Category Performance</h4>
            <div className="space-y-2">
              {Object.entries(category_breakdown.category_scores).slice(0, 4).map(([category, score]) => (
                <div key={category} className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium">{formatCategoryName(category)}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-20">
                      <Progress 
                        value={score} 
                        className="h-1.5 bg-muted/30" 
                      />
                    </div>
                    <span className={`text-sm font-bold w-10 text-right ${getScoreColor(score)}`}>
                      {score.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance Analysis */}
        {performance_analysis && (
          <div className="flex gap-3">
            {performance_analysis.best_performing_category && (
              <div className="flex-1 p-3 rounded-lg bg-green-50/70 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/30">
                <div className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Best</div>
                <div className="text-sm font-medium">{formatCategoryName(performance_analysis.best_performing_category)}</div>
              </div>
            )}
            
            {performance_analysis.worst_performing_category && (
              <div className="flex-1 p-3 rounded-lg bg-red-50/70 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30">
                <div className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Focus Area</div>
                <div className="text-sm font-medium">{formatCategoryName(performance_analysis.worst_performing_category)}</div>
              </div>
            )}
          </div>
        )}

        {/* Improvement Priorities */}
        {performance_analysis?.improvement_priorities && (
          <div className="p-3 rounded-lg bg-yellow-50/50 dark:bg-yellow-950/10 border border-yellow-200/30 dark:border-yellow-800/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Priority Areas</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {performance_analysis.improvement_priorities.slice(0, 3).map((priority, index) => (
                <Badge key={index} variant="outline" className="text-xs border-yellow-200 dark:border-yellow-800">
                  {formatCategoryName(priority)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}