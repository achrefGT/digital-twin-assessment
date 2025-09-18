import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts'
import { Brain, Shield, Sparkles, Target, TrendingUp, Award, Trophy, Star, CheckCircle, Clock } from 'lucide-react'

interface RadarScoreChartProps {
  domainScores?: Record<string, number>
  overallScore?: number
  completedDomains: string[]
  completionPercentage?: number
  totalDomains?: number
}

const CircularProgress: React.FC<{
  value: number | null | undefined
  size?: number
  strokeWidth?: number
  className?: string
}> = ({ value, size = 140, strokeWidth = 10, className = "" }) => {
  const safeValue = value ?? 0
  const percentage = Math.max(0, Math.min(100, safeValue))
  
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  const getColor = (score: number) => {
    if (score >= 85) return '#10b981' // emerald-500
    if (score >= 75) return '#84cc16' // lime-500
    if (score >= 65) return '#eab308' // yellow-500
    if (score >= 50) return '#f97316' // orange-500
    return '#ef4444' // red-500
  }

  const strokeColor = getColor(percentage)

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted stroke-current opacity-10"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          stroke={strokeColor}
          className="transition-all duration-1000 ease-out drop-shadow-sm"
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <div className="text-3xl font-bold text-foreground mb-1">
          {value !== null && value !== undefined ? value.toFixed(1) : '--'}
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide">
          Overall Score
        </div>
      </div>
    </div>
  )
}

export const RadarScoreChart: React.FC<RadarScoreChartProps> = ({
  domainScores,
  overallScore,
  completedDomains,
  completionPercentage = 0,
  totalDomains = 3
}) => {
  // Transform domain scores into radar chart data
  const radarData = React.useMemo(() => {
    const domains = [
      { key: 'human_centricity', name: 'Human Centricity', shortName: 'Human Centricity', icon: Brain, color: '#3b82f6' },
      { key: 'resilience', name: 'Resilience', shortName: 'Resilience', icon: Shield, color: '#8b5cf6' },
      { key: 'sustainability', name: 'Sustainability', shortName: 'Sustainability', icon: Sparkles, color: '#10b981' }
    ]

    return domains.map(domain => ({
      domain: domain.shortName,
      fullName: domain.name,
      score: domainScores?.[domain.key] || 0,
      fullMark: 100,
      color: domain.color,
      icon: domain.icon,
      isCompleted: completedDomains.includes(domain.key)
    }))
  }, [domainScores, completedDomains])

  const getScoreRating = (score?: number) => {
    if (!score || score === 0) return { text: 'Not Started', color: 'text-slate-500', bgColor: 'bg-slate-100', iconColor: 'text-slate-400', icon: Clock }
    if (score >= 90) return { text: 'Excellent', color: 'text-emerald-600', bgColor: 'bg-emerald-50', iconColor: 'text-emerald-500', icon: Trophy }
    if (score >= 80) return { text: 'Very Good', color: 'text-green-600', bgColor: 'bg-green-50', iconColor: 'text-green-500', icon: Star }
    if (score >= 70) return { text: 'Good', color: 'text-lime-600', bgColor: 'bg-lime-50', iconColor: 'text-lime-500', icon: CheckCircle }
    if (score >= 60) return { text: 'Satisfactory', color: 'text-yellow-600', bgColor: 'bg-yellow-50', iconColor: 'text-yellow-500', icon: TrendingUp }
    if (score >= 50) return { text: 'Fair', color: 'text-orange-600', bgColor: 'bg-orange-50', iconColor: 'text-orange-500', icon: TrendingUp }
    return { text: 'Poor', color: 'text-red-600', bgColor: 'bg-red-50', iconColor: 'text-red-500', icon: TrendingUp }
  }

  const overallRating = getScoreRating(overallScore)
  const completedDomains_ = domainScores ? Object.keys(domainScores).length : 0
  const OverallRatingIcon = overallRating.icon

  return (
    <div className="space-y-8">
      {/* Main Chart and Score Container */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Radar Chart Section */}
        <div className="xl:col-span-2">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-background via-background to-muted/20">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent border-b border-border/50">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <span >
                    Performance Overview
                  </span>
                  <p className="text-sm text-muted-foreground font-normal mt-1">
                    Multi-dimensional assessment across key domains
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  {/* 
                    Key changes to make the plotted area larger while keeping wrapper size:
                      - Reduce chart margins (less whitespace).
                      - Increase outerRadius so the radar expands to fill more of the container.
                      - Increase strokeWidth and dot radius to make shapes feel larger.
                      - Increase label font sizes and tweak label offsets.
                  */}
                  <RadarChart
                    data={radarData}
                    // outerRadius in px — increase to let the polygon expand
                    outerRadius={140}
                    // tighter margins so the drawing area is larger
                    margin={{ top: 8, right: 12, bottom: 8, left: 12 }}
                  >
                    <defs>
                      <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.35} />
                      </linearGradient>
                    </defs>

                    <PolarGrid 
                      gridType="polygon" 
                      stroke="#e2e8f0" 
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                    />
                    <PolarAngleAxis
                      dataKey="domain"
                      tick={({ x, y, payload }) => {
                        // Slightly larger label font + bigger offsets so they don't collide with a bigger polygon
                        const getLabelAdjustment = (label: string) => {
                          switch (label) {
                            case 'Human Centricity': return -12; // move up more
                            case 'Sustainability': return 28;    // move down more
                            case 'Resilience': return 28;  
                            default: return 0;
                          }
                        };

                        const adjustedY = y + getLabelAdjustment(payload.value);
                        const lines = payload.value.split('\n');

                        return (
                          <g>
                            {lines.map((line, index) => (
                              <text
                                key={index}
                                x={x}
                                y={adjustedY - 3 + (index * 18)} // increased line-height for larger font
                                textAnchor="middle"
                                fontSize={16} // bumped font size
                                fill="#475569"
                                fontWeight={700}
                              >
                                {line}
                              </text>
                            ))}
                          </g>
                        );
                      }}
                    />

                    <PolarRadiusAxis 
                      angle={90} 
                      domain={[0, 100]} 
                      tick={{ 
                        fontSize: 12, 
                        fill: '#94a3b8',
                        fontWeight: 400
                      }}
                      tickCount={6}
                    />

                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke="#3b82f6"
                      fill="url(#radarGradient)"
                      fillOpacity={0.55}
                      strokeWidth={4} // thicker stroke
                      // Larger, more prominent dots
                      dot={{
                        r: 8,
                        stroke: '#ffffff',
                        strokeWidth: 3,
                        fill: '#3b82f6'
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overall Score Section */}
        <div className="xl:col-span-1">
          <div className="sticky top-8 space-y-6">
            
            {/* Main Score Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 via-background to-secondary/5">
              <CardHeader className="text-center pb-4">
                <CardTitle className="flex items-center justify-center gap-2 text-lg">
                  <Target className="w-6 h-6 text-primary" />
                  Assessment Score
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-6">
                
                {/* Circular Progress */}
                <CircularProgress 
                  value={overallScore} 
                  size={160} 
                  strokeWidth={12}
                />

                {/* Score Rating */}
                {overallScore && (
                  <div className="space-y-3">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${overallRating.bgColor}`}>
                      <OverallRatingIcon className={`w-5 h-5 ${overallRating.iconColor}`} />
                      <span className={`font-semibold text-sm ${overallRating.color}`}>
                        {overallRating.text}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Assessment Quality Rating
                    </p>
                  </div>
                )}

                {/* Completion Progress */}
                <div className="space-y-3 pt-4 border-t border-border/50">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-muted-foreground">
                      Progress
                    </span>
                    <Badge variant="outline" className="text-xs bg-primary/5">
                      {completedDomains_}/{totalDomains} domains
                    </Badge>
                  </div>
                  <Progress 
                    value={completionPercentage} 
                    className="h-2.5"
                  />
                  <p className="text-xs text-muted-foreground">
                    {completionPercentage.toFixed(0)}% Complete
                  </p>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center justify-center gap-2 pt-2">
                  {completionPercentage === 100 ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-600">Complete</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-blue-600 animate-pulse" />
                      <span className="text-sm font-medium text-blue-600">In Progress</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Domain Scores Grid */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-secondary/20 rounded-lg">
              <Award className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span>Domain Performance</span>
              <p className="text-sm text-muted-foreground font-normal mt-1">
                Individual scores across assessment domains
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {radarData.map((item, index) => {
              const rating = getScoreRating(item.score)
              const IconComponent = item.icon
              const RatingIcon = rating.icon
              
              return (
                <div 
                  key={index}
                  className="group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-background via-background to-muted/30 p-6 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
                >
                  {/* Background Gradient Overlay */}
                  <div 
                    className="absolute inset-0 opacity-5 transition-opacity group-hover:opacity-10"
                    style={{ background: `linear-gradient(135deg, ${item.color}20, ${item.color}05)` }}
                  />
                  
                  {/* Content */}
                  <div className="relative space-y-4">
                    
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-3 rounded-xl bg-white shadow-sm border border-border/30"
                          style={{ color: item.color }}
                        >
                          <IconComponent className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground text-sm">
                            {item.fullName}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            Domain Assessment
                          </p>
                        </div>
                      </div>
                      
                      {item.isCompleted && (
                        <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">
                          ✓ Complete
                        </Badge>
                      )}
                    </div>

                    {/* Score Display */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        <span 
                          className="text-3xl font-bold"
                          style={{ color: item.color }}
                        >
                          {item.score > 0 ? item.score.toFixed(1) : '--'}
                        </span>
                        <span className="text-sm text-muted-foreground font-medium">
                          /100
                        </span>
                      </div>
                      
                      {item.score > 0 && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${rating.bgColor}`}>
                          <RatingIcon className={`w-4 h-4 ${rating.iconColor}`} />
                          <span className={`text-xs font-medium ${rating.color}`}>
                            {rating.text}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <Progress 
                        value={item.score} 
                        className="h-2"
                        style={{
                          background: `${item.color}15`
                        }}
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">
                          Performance Level
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          {item.score > 0 ? `${item.score.toFixed(0)}%` : 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
