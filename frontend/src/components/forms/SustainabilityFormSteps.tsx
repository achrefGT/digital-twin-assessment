import React from "react"
import { Button } from "@/components/ui/enhanced-button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Leaf, DollarSign, Users, AlertCircle } from "lucide-react"
import { useSustainability } from "@/hooks/useSustainability"

interface StepProps {
  onSubmit: (data: any) => void
  initialData?: any
}

interface StepDefinition {
  title: string
  description: string
  component: React.ComponentType<StepProps>
}

// Generic domain step component that works with dynamic criteria
const DomainStep: React.FC<StepProps & { domain: string }> = ({ 
  onSubmit, 
  initialData, 
  domain 
}) => {
  const { scenarios, isLoading, error } = useSustainability()
  
  // State now stores numeric level indices (0-5) instead of enum strings
  const [assessments, setAssessments] = React.useState<Record<string, number>>(() => {
    const initialValues: Record<string, number> = {}
    if (initialData?.assessments?.[domain]) {
      const domainData = initialData.assessments[domain]
      Object.entries(domainData).forEach(([key, value]) => {
        if (typeof value === 'number') {
          initialValues[key] = value
        }
      })
    }
    return initialValues
  })

  const domainData = scenarios?.scenarios[domain]
  const domainCriteria = domainData?.criteria || {}

  const updateAssessment = (criterionKey: string, levelIndex: number) => {
    // Simply store the numeric level index
    setAssessments(prev => ({
      ...prev,
      [criterionKey]: levelIndex
    }))
  }

  const isComplete = Object.keys(domainCriteria).length > 0 && 
    Object.keys(domainCriteria).every(key => assessments[key] !== undefined)

  const handleSubmit = () => {
    // No conversion needed - assessments already contains numeric indices
    const finalData = { 
      assessments: {
        ...initialData?.assessments,
        [domain]: assessments
      }
    }
    onSubmit(finalData)
  }

  // Domain-specific styling helpers
  const getDomainIcon = (domain: string) => {
    switch (domain) {
      case 'environmental': return <Leaf className="w-5 h-5 text-white" />
      case 'economic': return <DollarSign className="w-5 h-5 text-white" />
      case 'social': return <Users className="w-5 h-5 text-white" />
      default: return <AlertCircle className="w-5 h-5 text-white" />
    }
  }

  const getDomainColors = (domain: string) => {
    switch (domain) {
      case 'environmental': return 'from-green-500 to-emerald-600'
      case 'economic': return 'from-purple-500 to-violet-600'
      case 'social': return 'from-blue-500 to-cyan-600'
      default: return 'from-gray-500 to-gray-600'
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="space-y-3 p-4 border rounded-lg">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load criteria for {domain}. Please try refreshing the page.
            {error.message && ` Error: ${error.message}`}
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} variant="eco" className="w-full" disabled>
          Cannot Continue - Criteria Not Available
        </Button>
      </div>
    )
  }

  // No criteria configured
  if (Object.keys(domainCriteria).length === 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No criteria are currently configured for {domain}. Please contact your administrator.
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} variant="eco" className="w-full" disabled>
          No Criteria Available
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Domain Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 bg-gradient-to-br ${getDomainColors(domain)} rounded-lg flex items-center justify-center`}>
          {getDomainIcon(domain)}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 capitalize">{domain} Impact</h3>
          <p className="text-sm text-gray-600">{domainData?.description || `Assess ${domain} sustainability criteria`}</p>
        </div>
      </div>

      {/* Criteria List */}
      <div className="space-y-4">
        {Object.entries(domainCriteria).map(([criterionKey, criterion]) => {
          const currentLevel = assessments[criterionKey]
          const levelCount = criterion.levels?.length || 0
          
          return (
            <div key={criterionKey} className="space-y-3 p-4 border rounded-lg hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <Label className="text-sm font-medium text-gray-900">
                    {criterion.name}
                  </Label>
                  {criterion.description && (
                    <p className="text-xs text-gray-500 mt-1">{criterion.description}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 ml-2">
                  {currentLevel !== undefined ? `${currentLevel + 1}/${levelCount}` : `0/${levelCount}`}
                </span>
              </div>
              
              <Select 
                value={currentLevel !== undefined ? currentLevel.toString() : ""} 
                onValueChange={(value) => updateAssessment(criterionKey, parseInt(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select level..." />
                </SelectTrigger>
                <SelectContent>
                  {criterion.levels.map((level, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-mono">L{index}</span>
                        <span>{level}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
      
      {/* Progress indicator */}
      <div className="text-sm text-gray-500 text-center">
        {Object.keys(assessments).length} of {Object.keys(domainCriteria).length} criteria completed
      </div>
      
      <Button 
        onClick={handleSubmit} 
        variant="eco" 
        className="w-full" 
        disabled={!isComplete}
      >
        {domain === 'social' ? 'Complete Assessment' : 'Next Step'}
      </Button>
    </div>
  )
}

// Individual domain components
const EnvironmentalStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="environmental" />
)

const EconomicStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="economic" />
)

const SocialStep: React.FC<StepProps> = ({ onSubmit, initialData }) => {
  const { scenarios, isLoading, error } = useSustainability()
  
  const [assessments, setAssessments] = React.useState<Record<string, number>>(() => {
    const initialValues: Record<string, number> = {}
    if (initialData?.assessments?.social) {
      const domainData = initialData.assessments.social
      Object.entries(domainData).forEach(([key, value]) => {
        if (typeof value === 'number') {
          initialValues[key] = value
        }
      })
    }
    return initialValues
  })

  const domainData = scenarios?.scenarios.social
  const domainCriteria = domainData?.criteria || {}

  const updateAssessment = (criterionKey: string, levelIndex: number) => {
    setAssessments(prev => ({
      ...prev,
      [criterionKey]: levelIndex
    }))
  }

  const isComplete = Object.keys(domainCriteria).length > 0 && 
    Object.keys(domainCriteria).every(key => assessments[key] !== undefined)

  const handleSubmit = () => {
    const allAssessments = {
      ...initialData?.assessments,
      social: assessments
    }
    
    // Calculate metadata
    let totalCriteria = 0
    Object.values(allAssessments).forEach((domain: any) => {
      if (domain && typeof domain === 'object') {
        totalCriteria += Object.keys(domain).length
      }
    })

    const finalData = { 
      assessments: allAssessments,
      metadata: {
        assessment_type: "sustainability",
        version: "2.0",
        total_criteria: totalCriteria,
        selected_domain_count: Object.keys(allAssessments).length,
        criteria_configuration_version: "2.0"
      }
    }
    onSubmit(finalData)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-3 p-4 border rounded-lg">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load criteria for social domain. Please try refreshing the page.
            {error.message && ` Error: ${error.message}`}
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} variant="eco" className="w-full" disabled>
          Cannot Complete - Criteria Not Available
        </Button>
      </div>
    )
  }

  // No criteria configured
  if (Object.keys(domainCriteria).length === 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No criteria are currently configured for social domain. Please contact your administrator.
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} variant="eco" className="w-full" disabled>
          No Criteria Available
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Domain Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Social Impact</h3>
          <p className="text-sm text-gray-600">{domainData?.description || "Assess social sustainability criteria"}</p>
        </div>
      </div>

      {/* Criteria List */}
      <div className="space-y-4">
        {Object.entries(domainCriteria).map(([criterionKey, criterion]) => {
          const currentLevel = assessments[criterionKey]
          const levelCount = criterion.levels?.length || 0
          
          return (
            <div key={criterionKey} className="space-y-3 p-4 border rounded-lg hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <Label className="text-sm font-medium text-gray-900">
                    {criterion.name}
                  </Label>
                  {criterion.description && (
                    <p className="text-xs text-gray-500 mt-1">{criterion.description}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 ml-2">
                  {currentLevel !== undefined ? `${currentLevel + 1}/${levelCount}` : `0/${levelCount}`}
                </span>
              </div>
              
              <Select 
                value={currentLevel !== undefined ? currentLevel.toString() : ""} 
                onValueChange={(value) => updateAssessment(criterionKey, parseInt(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select level..." />
                </SelectTrigger>
                <SelectContent>
                  {criterion.levels.map((level, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-mono">L{index}</span>
                        <span>{level}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
      
      {/* Progress indicator */}
      <div className="text-sm text-gray-500 text-center">
        {Object.keys(assessments).length} of {Object.keys(domainCriteria).length} criteria completed
      </div>
      
      <Button 
        onClick={handleSubmit} 
        variant="eco" 
        className="w-full" 
        disabled={!isComplete}
      >
        Complete Assessment
      </Button>
    </div>
  )
}

// Static step generation for backward compatibility
export const getSustainabilitySteps = (): StepDefinition[] => {
  return [
    {
      title: "Environmental",
      description: "Evaluate environmental monitoring and impact tracking capabilities",
      component: EnvironmentalStep 
    },
    {
      title: "Economic", 
      description: "Assess economic performance and cost-benefit analysis",
      component: EconomicStep
    },
    {
      title: "Social",
      description: "Evaluate social impact and community benefits",
      component: SocialStep
    }
  ]
}

// Dynamic step generation based on available domains
export const getDynamicSustainabilitySteps = (
  availableDomains: Array<{domain: string, description: string}>
): StepDefinition[] => {
  return availableDomains.map((domainInfo) => ({
    title: domainInfo.domain.charAt(0).toUpperCase() + domainInfo.domain.slice(1),
    description: domainInfo.description,
    component: (props: StepProps) => (
      <DomainStep {...props} domain={domainInfo.domain} />
    )
  }))
}