import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { DollarSign, TrendingUp, Clock, Target, Award } from 'lucide-react'

interface LCCPanelProps {
  data?: {
    scores?: {
      npv?: number
      irr?: number
      payback_period?: number
      roi?: number
      economic_sustainability_score?: number
      sustainability_rating?: string
      benefit_cost_ratio?: number
      score_components?: {
        financial_viability?: number
        dt_readiness?: number
        implementation_maturity?: number
      }
    }
  }
}

export const LCCPanel: React.FC<LCCPanelProps> = ({ data }) => {
  if (!data?.scores) {
    return (
      <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50/50 to-indigo-50/30 dark:from-purple-950/20 dark:to-indigo-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-lg font-medium">
            <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <DollarSign className="h-4 w-4 text-purple-600" />
            </div>
            Life Cycle Cost
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted/30 mb-4">
              <DollarSign className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">Awaiting economic assessment</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { 
    npv, 
    irr, 
    payback_period, 
    roi,
    economic_sustainability_score,
    sustainability_rating,
    benefit_cost_ratio,
    score_components 
  } = data.scores

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value)
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  const getRatingColor = (rating: string) => {
    const colors = {
      'excellent': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'good': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'fair': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      'poor': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }
    return colors[rating?.toLowerCase()] || 'bg-muted text-muted-foreground'
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-500'
  }

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50/50 to-indigo-50/30 dark:from-purple-950/20 dark:to-indigo-950/10">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <DollarSign className="h-4 w-4 text-purple-600" />
            </div>
            <span className="text-lg font-medium">Life Cycle Cost</span>
          </div>
          <div className="flex items-center gap-2">
            {sustainability_rating && (
              <Badge variant="secondary" className={`${getRatingColor(sustainability_rating)} border-0 font-medium`}>
                {sustainability_rating}
              </Badge>
            )}
            {economic_sustainability_score && (
              <div className={`text-xl font-bold ${getScoreColor(economic_sustainability_score)}`}>
                {economic_sustainability_score.toFixed(1)}
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6 pt-0">
        {/* Key Financial Metrics */}
        <div className="grid grid-cols-2 gap-3">
          {npv && (
            <div className="p-4 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-muted-foreground">NPV</span>
              </div>
              <div className="text-lg font-bold text-foreground">
                {formatCurrency(npv)}
              </div>
            </div>
          )}
          
          {irr && (
            <div className="p-4 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-muted-foreground">IRR</span>
              </div>
              <div className="text-lg font-bold text-foreground">
                {formatPercentage(irr)}
              </div>
            </div>
          )}
          
          {payback_period && (
            <div className="p-4 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-medium text-muted-foreground">Payback</span>
              </div>
              <div className="text-lg font-bold text-foreground">
                {payback_period} yr
              </div>
            </div>
          )}
          
          {roi && (
            <div className="p-4 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm border border-white/20">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-orange-600" />
                <span className="text-xs font-medium text-muted-foreground">ROI</span>
              </div>
              <div className="text-lg font-bold text-foreground">
                {roi.toFixed(1)}x
              </div>
            </div>
          )}
        </div>

        {/* Benefit Cost Ratio Highlight */}
        {benefit_cost_ratio && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-100/60 to-indigo-100/60 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200/50 dark:border-purple-800/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="text-sm font-medium">Benefit-Cost Ratio</div>
                  <div className="text-xs text-muted-foreground">Return per dollar invested</div>
                </div>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {benefit_cost_ratio.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Score Components */}
        {score_components && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Assessment Breakdown</h4>
            <div className="space-y-2">
              {score_components.financial_viability && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium">Financial Viability</span>
                  <div className="flex items-center gap-3">
                    <div className="w-20">
                      <Progress 
                        value={score_components.financial_viability} 
                        className="h-1.5 bg-muted/30" 
                      />
                    </div>
                    <span className={`text-sm font-bold w-10 text-right ${getScoreColor(score_components.financial_viability)}`}>
                      {score_components.financial_viability.toFixed(0)}
                    </span>
                  </div>
                </div>
              )}
              
              {score_components.dt_readiness && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium">Digital Twin Readiness</span>
                  <div className="flex items-center gap-3">
                    <div className="w-20">
                      <Progress 
                        value={score_components.dt_readiness} 
                        className="h-1.5 bg-muted/30" 
                      />
                    </div>
                    <span className={`text-sm font-bold w-10 text-right ${getScoreColor(score_components.dt_readiness)}`}>
                      {score_components.dt_readiness.toFixed(0)}
                    </span>
                  </div>
                </div>
              )}
              
              {score_components.implementation_maturity && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium">Implementation Maturity</span>
                  <div className="flex items-center gap-3">
                    <div className="w-20">
                      <Progress 
                        value={score_components.implementation_maturity} 
                        className="h-1.5 bg-muted/30" 
                      />
                    </div>
                    <span className={`text-sm font-bold w-10 text-right ${getScoreColor(score_components.implementation_maturity)}`}>
                      {score_components.implementation_maturity.toFixed(0)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}