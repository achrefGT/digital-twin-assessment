import React from "react"
import { Button } from "@/components/ui/enhanced-button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, ChevronRight, Sparkles } from "lucide-react"
import { PaginatedForm } from "./PaginatedForm"

// Step getter function map
const stepGetters = {
  sustainability: () => import("./forms/SustainabilityFormSteps").then(m => m.getSustainabilitySteps()),
  resilience: () => import("./forms/ResilienceFormSteps").then(m => m.getResilienceSteps()),
  human_centricity: () => import("./forms/HumanCentricityFormSteps").then(m => m.getHumanCentricitySteps()),
} as const

// Assessment type configuration
const assessmentConfig = {
  sustainability: {
    title: "Sustainability Assessment",
    description: "Choose which sustainability domains you want to include in this assessment.",
    primaryColor: "bg-emerald-500",
    primaryColorHover: "bg-emerald-600",
    accentColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    textColor: "text-emerald-700",
    icon: "🌱"
  },
  resilience: {
    title: "Resilience Assessment", 
    description: "Choose which resilience domains you want to include in this assessment.",
    primaryColor: "bg-blue-500",
    primaryColorHover: "bg-blue-600", 
    accentColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
    icon: "🛡️"
  },
  human_centricity: {
    title: "Human Centricity Assessment",
    description: "Choose which human centricity domains you want to include in this assessment.", 
    primaryColor: "bg-violet-500",
    primaryColorHover: "bg-violet-600",
    accentColor: "bg-violet-50", 
    borderColor: "border-violet-200",
    textColor: "text-violet-700",
    icon: "👥"
  }
} as const

type AssessmentType = keyof typeof assessmentConfig

interface UnifiedDomainSelectorProps {
  assessmentType: AssessmentType
  assessmentInfo: any
  onComplete: (submission: any) => void
}

export default function UnifiedDomainSelector({ 
  assessmentType, 
  assessmentInfo, 
  onComplete 
}: UnifiedDomainSelectorProps) {
  const [allSteps, setAllSteps] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedDomains, setSelectedDomains] = React.useState<Set<string>>(new Set())
  const [started, setStarted] = React.useState(false)
  
  const config = assessmentConfig[assessmentType]

  // Load steps dynamically
  React.useEffect(() => {
    const loadSteps = async () => {
      setLoading(true)
      try {
        const steps = await stepGetters[assessmentType]()
        setAllSteps(steps)
        // Default: all selected
        setSelectedDomains(new Set(steps.map(s => s.title)))
      } catch (error) {
        console.error('Failed to load steps:', error)
        setAllSteps([])
      } finally {
        setLoading(false)
      }
    }
    
    loadSteps()
  }, [assessmentType])

  const domainTitles = allSteps.map(s => s.title)

  const toggleDomain = (title: string) => {
    setSelectedDomains(prev => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  const selectAll = () => setSelectedDomains(new Set(domainTitles))
  const clearAll = () => setSelectedDomains(new Set())

  const startAssessment = () => {
    if (selectedDomains.size === 0) return
    setStarted(true)
  }

  // Build the steps array for PaginatedForm
  const stepsToUse = React.useMemo(() => {
    return allSteps
      .filter(step => selectedDomains.has(step.title))
      .map(step => ({
        title: step.title,
        description: step.description,
        component: React.createElement(step.component as any, {})
      }))
  }, [allSteps, selectedDomains])

  // Show PaginatedForm when started
  if (started) {
    return (
      <PaginatedForm
        steps={stepsToUse}
        assessmentInfo={assessmentInfo}
        onComplete={onComplete}
      />
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          <span className="text-sm text-gray-600">Loading domains...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${config.accentColor} ${config.borderColor} border-2`}>
          <span className="text-2xl">{config.icon}</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{config.title}</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Select the specific domains you'd like to focus on for a personalized assessment experience.
          </p>
        </div>
      </div>

      {/* Main Selection Card */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-gray-50 to-gray-100">
        <CardHeader className="pb-6">
          <div className="flex items-center space-x-3">
            <Sparkles className={`w-5 h-5 ${config.textColor}`} />
            <CardTitle className="text-xl">Choose Your Domains</CardTitle>
          </div>
          <CardDescription className="text-base">
            {config.description}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Domain Selection Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {domainTitles.map(title => {
              const isSelected = selectedDomains.has(title)
              return (
                <div
                  key={title}
                  onClick={() => toggleDomain(title)}
                  className={`relative group cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 hover:shadow-md ${
                    isSelected 
                      ? `${config.primaryColor} border-transparent text-white shadow-lg` 
                      : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm leading-relaxed pr-2">{title}</span>
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected 
                        ? 'bg-white border-white' 
                        : 'border-gray-300 group-hover:border-gray-400'
                    }`}>
                      {isSelected && <Check className={`w-3 h-3 ${config.textColor}`} />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline" 
                onClick={selectAll}
                className="text-sm"
                disabled={selectedDomains.size === domainTitles.length}
              >
                Select All ({domainTitles.length})
              </Button>
              <Button 
                variant="ghost" 
                onClick={clearAll}
                className="text-sm text-gray-500 hover:text-gray-700"
                disabled={selectedDomains.size === 0}
              >
                Clear Selection
              </Button>
            </div>
            
            <div className="text-sm text-gray-500">
              {selectedDomains.size} of {domainTitles.length} selected
            </div>
          </div>

          {/* Start Assessment Button */}
          <div className="pt-4">
            <Button
              onClick={startAssessment}
              disabled={selectedDomains.size === 0}
              className={`w-full py-6 text-base font-semibold rounded-xl transition-all duration-200 ${config.primaryColor} hover:${config.primaryColorHover} disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl`}
            >
              <div className="flex items-center justify-center space-x-3">
                <span>
                  Start Assessment
                  {selectedDomains.size > 0 && (
                    <span className="ml-2">
                      ({selectedDomains.size} domain{selectedDomains.size !== 1 ? 's' : ''})
                    </span>
                  )}
                </span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </Button>
            
            {selectedDomains.size === 0 && (
              <p className="text-center text-sm text-gray-500 mt-3">
                Please select at least one domain to continue
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress Indicator */}
      {selectedDomains.size > 0 && (
        <div className={`text-center p-4 rounded-xl ${config.accentColor} ${config.borderColor} border`}>
          <p className={`text-sm font-medium ${config.textColor}`}>
            Your assessment will include {selectedDomains.size} domain{selectedDomains.size !== 1 ? 's' : ''} with approximately{' '}
            {selectedDomains.size * 3}-{selectedDomains.size * 5} questions
          </p>
        </div>
      )}
    </div>
  )
}