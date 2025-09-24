import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Target, 
  Award, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SummaryStatistics {
  completed_domain_count: number
  average_score: number
  highest_score: number
  lowest_score: number
  score_distribution: Record<string, number>
}

interface AssessmentProgress {
  completed_domains: string[]
  completion_percentage: number
  domain_scores?: Record<string, number>
  overall_score?: number
  summary_statistics?: SummaryStatistics
  status?: string
}

interface SummaryStatsProps {
  progress: AssessmentProgress
  totalDomains?: number
  className?: string
}

export const SummaryStatsDisplay: React.FC<SummaryStatsProps> = ({
  progress,
  totalDomains = 8, // Default total domains
  className
}) => {
  const {
    completed_domains = [],
    completion_percentage = 0,
    domain_scores = {},
    overall_score,
    summary_statistics,
    status = 'PENDING'
  } = progress

  // Calculate actual statistics from available data if summary_statistics is missing or empty
  const calculateStats = (): SummaryStatistics => {
    const scores = Object.values(domain_scores).filter(score => typeof score === 'number' && !isNaN(score))
    
    if (scores.length === 0) {
      return {
        completed_domain_count: completed_domains.length,
        average_score: 0,
        highest_score: 0,
        lowest_score: 0,
        score_distribution: {}
      }
    }

    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const highest = Math.max(...scores)
    const lowest = Math.min(...scores)

    // Create score distribution
    const distribution: Record<string, number> = {
      'Excellent (90-100)': 0,
      'Good (80-89)': 0,
      'Average (70-79)': 0,
      'Below Average (60-69)': 0,
      'Poor (<60)': 0
    }

    scores.forEach(score => {
      if (score >= 90) distribution['Excellent (90-100)']++
      else if (score >= 80) distribution['Good (80-89)']++
      else if (score >= 70) distribution['Average (70-79)']++
      else if (score >= 60) distribution['Below Average (60-69)']++
      else distribution['Poor (<60)']++
    })

    return {
      completed_domain_count: completed_domains.length,
      average_score: Math.round(average * 10) / 10, // Round to 1 decimal
      highest_score: Math.round(highest * 10) / 10,
      lowest_score: Math.round(lowest * 10) / 10,
      score_distribution: distribution
    }
  }

  const stats = summary_statistics || calculateStats()
  const isCompleted = status === 'COMPLETED'
  const isInProgress = completed_domains.length > 0 && !isCompleted
  const hasNoData = completed_domains.length === 0 && completion_percentage === 0

  // Get completion status styling
  const getCompletionColor = (percentage: number) => {
    if (percentage >= 100) return 'text-emerald-600'
    if (percentage >= 75) return 'text-blue-600'
    if (percentage >= 50) return 'text-orange-600'
    if (percentage >= 25) return 'text-yellow-600'
    return 'text-gray-500'
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600'
    if (score >= 80) return 'text-blue-600'
    if (score >= 70) return 'text-orange-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatScore = (score: number) => {
    return score === 0 ? '—' : score.toFixed(1)
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Main Progress Card */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Assessment Progress
            </CardTitle>
            <Badge 
              variant={isCompleted ? "default" : isInProgress ? "secondary" : "outline"}
              className={cn(
                "font-medium",
                isCompleted && "bg-emerald-500 text-white",
                isInProgress && "bg-blue-500 text-white"
              )}
            >
              {isCompleted ? (
                <><CheckCircle2 className="w-3 h-3 mr-1" />Completed</>
              ) : isInProgress ? (
                <><Clock className="w-3 h-3 mr-1" />In Progress</>
              ) : (
                "Not Started"
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">
                  Domains Completed: {stats.completed_domain_count} of {totalDomains}
                </span>
                <span className={cn("font-bold", getCompletionColor(completion_percentage))}>
                  {completion_percentage.toFixed(0)}%
                </span>
              </div>
              <Progress 
                value={completion_percentage} 
                className="h-3 bg-gray-100"
              />
            </div>
            
            {hasNoData && (
              <div className="text-center py-4 text-gray-500">
                <Target className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">Complete your first domain to see progress statistics</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      {(isInProgress || isCompleted) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Average Score */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-600">Average Score</span>
              </div>
              <div className="mt-2">
                <span className={cn("text-2xl font-bold", getScoreColor(stats.average_score))}>
                  {formatScore(stats.average_score)}
                </span>
                {stats.average_score > 0 && (
                  <span className="text-xs text-gray-500 ml-1">/ 100</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Highest Score */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-gray-600">Highest Score</span>
              </div>
              <div className="mt-2">
                <span className={cn("text-2xl font-bold", getScoreColor(stats.highest_score))}>
                  {formatScore(stats.highest_score)}
                </span>
                {stats.highest_score > 0 && (
                  <span className="text-xs text-gray-500 ml-1">/ 100</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lowest Score */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <TrendingDown className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-gray-600">Lowest Score</span>
              </div>
              <div className="mt-2">
                <span className={cn("text-2xl font-bold", getScoreColor(stats.lowest_score))}>
                  {formatScore(stats.lowest_score)}
                </span>
                {stats.lowest_score > 0 && (
                  <span className="text-xs text-gray-500 ml-1">/ 100</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Overall Score */}
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Award className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-600">Overall Score</span>
              </div>
              <div className="mt-2">
                <span className={cn("text-2xl font-bold", getScoreColor(overall_score || 0))}>
                  {overall_score ? formatScore(overall_score) : '—'}
                </span>
                {overall_score && (
                  <span className="text-xs text-gray-500 ml-1">/ 100</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Score Distribution */}
      {isCompleted && stats.score_distribution && Object.values(stats.score_distribution).some(count => count > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" />
              Score Distribution
            </CardTitle>
            <CardDescription>
              Breakdown of domain scores across performance ranges
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.score_distribution).map(([range, count]) => (
                <div key={range} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{range}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">{count}</span>
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${stats.completed_domain_count > 0 ? (count / stats.completed_domain_count) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {hasNoData && (
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="pt-12 pb-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Assessment Data Yet</h3>
              <p className="text-gray-500 mb-4 max-w-sm mx-auto">
                Complete your first domain assessment to start seeing detailed statistics and progress tracking.
              </p>
              <div className="flex justify-center space-x-4 text-sm text-gray-400">
                <div className="flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  <span>Progress Tracking</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  <span>Score Analytics</span>
                </div>
                <div className="flex items-center gap-1">
                  <Award className="w-4 h-4" />
                  <span>Performance Insights</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}