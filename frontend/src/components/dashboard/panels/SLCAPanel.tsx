import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, TrendingUp, Award, CheckCircle, Shield, Heart, BrainCircuit } from 'lucide-react'

interface SLCAPanelProps {
  data?: {
    scores?: {
      overall_score?: number
      annual_scores?: number[]
      social_sustainability_rating?: string
      social_performance_trend?: string
      key_metrics?: {
        avg_safety_reduction?: number
        avg_worker_satisfaction?: number
        total_jobs_created?: number
        avg_skills_development?: number
      }
      recommendations?: string[]
    }
  }
}

export const SLCAPanel: React.FC<SLCAPanelProps> = ({ data }) => {
  if (!data?.scores) {
    return (
      <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50/50 to-cyan-50/30 dark:from-blue-950/20 dark:to-cyan-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-lg font-medium">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            Social LCA
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted/30 mb-4">
              <Users className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">Awaiting social assessment</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { 
    overall_score, 
    annual_scores, 
    social_sustainability_rating, 
    social_performance_trend,
    key_metrics,
    recommendations 
  } = data.scores

  const getRatingColor = (rating: string) => {
    const colors = {
      'excellent': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'good': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'fair': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      'poor': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }
    return colors[rating?.toLowerCase()] || 'bg-muted text-muted-foreground'
  }

  const getTrendColor = (trend: string) => {
    if (trend?.toLowerCase().includes('improving')) return 'text-green-600'
    if (trend?.toLowerCase().includes('stable')) return 'text-blue-600'
    if (trend?.toLowerCase().includes('declining')) return 'text-red-500'
    return 'text-muted-foreground'
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-500'
  }

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50/50 to-cyan-50/30 dark:from-blue-950/20 dark:to-cyan-950/10">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <span className="text-lg font-medium">Social LCA</span>
          </div>
          <div className="flex items-center gap-2">
            {social_sustainability_rating && (
              <Badge variant="secondary" className={`${getRatingColor(social_sustainability_rating)} border-0 font-medium`}>
                {social_sustainability_rating}
              </Badge>
            )}
            {overall_score && (
              <div className={`text-xl font-bold ${getScoreColor(overall_score)}`}>
                {overall_score.toFixed(1)}
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6 pt-0">
        {/* Performance Trend */}
        {social_performance_trend && (
          <div className="flex items-center justify-center p-3 rounded-lg bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-white/20">
            <TrendingUp className="h-4 w-4 mr-2" />
            <span className={`font-medium text-sm ${getTrendColor(social_performance_trend)}`}>
              {social_performance_trend}
            </span>
          </div>
        )}

        {/* Key Social Metrics */}
        {key_metrics && (
          <div className="grid grid-cols-2 gap-3">
            {key_metrics.avg_safety_reduction !== undefined && (
              <div className="p-4 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-medium text-muted-foreground">Safety</span>
                </div>
                <div className="text-lg font-bold text-foreground">
                  {key_metrics.avg_safety_reduction.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Risk reduction</div>
              </div>
            )}
            
            {key_metrics.avg_worker_satisfaction !== undefined && (
              <div className="p-4 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="h-4 w-4 text-pink-600" />
                  <span className="text-xs font-medium text-muted-foreground">Satisfaction</span>
                </div>
                <div className="text-lg font-bold text-foreground">
                  {key_metrics.avg_worker_satisfaction.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Worker rating</div>
              </div>
            )}
            
            {key_metrics.total_jobs_created !== undefined && (
              <div className="p-4 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-muted-foreground">Employment</span>
                </div>
                <div className="text-lg font-bold text-foreground">
                  {key_metrics.total_jobs_created.toFixed(0)}
                </div>
                <div className="text-xs text-muted-foreground">Jobs created</div>
              </div>
            )}
            
            {key_metrics.avg_skills_development !== undefined && (
              <div className="p-4 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <BrainCircuit className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-medium text-muted-foreground">Skills</span>
                </div>
                <div className="text-lg font-bold text-foreground">
                  {key_metrics.avg_skills_development.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Development</div>
              </div>
            )}
          </div>
        )}

        {/* Annual Performance Trend */}
        {annual_scores && annual_scores.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">5-Year Performance</h4>
            <div className="flex justify-between items-end h-16 px-2">
              {annual_scores.map((score, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                  <div 
                    className="w-4 bg-gradient-to-t from-blue-400 to-blue-600 rounded-t transition-all duration-500"
                    style={{ height: `${(score * 100) / 2}px` }}
                  />
                  <div className="text-xs text-muted-foreground">Y{index + 1}</div>
                </div>
              ))}
            </div>
            <div className="text-center">
              <div className={`text-sm font-medium ${getScoreColor(annual_scores[annual_scores.length - 1] * 100)}`}>
                Latest: {(annual_scores[annual_scores.length - 1] * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Key Recommendations</h4>
            <div className="space-y-2">
              {recommendations.slice(0, 3).map((recommendation, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-white/40 dark:bg-white/5 backdrop-blur-sm border border-white/20">
                  <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground">{recommendation}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}