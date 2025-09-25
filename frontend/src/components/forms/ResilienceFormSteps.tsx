import React from "react"
import { Button } from "@/components/ui/enhanced-button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useScenarios } from "@/hooks/useScenarios"

interface ScenarioAssessment {
  likelihood: string
  impact: string
}

interface StepProps {
  onSubmit: (data: any) => void
  initialData?: any
}

interface StepDefinition {
  title: string
  description: string
  component: React.ComponentType<StepProps>
}

// Generic domain step component that works with dynamic scenarios
const DomainStep: React.FC<StepProps & { domain: string }> = ({ 
  onSubmit, 
  initialData, 
  domain 
}) => {
  const { scenarios, isLoading, error } = useScenarios()
  const [assessments, setAssessments] = React.useState<Record<string, ScenarioAssessment>>(
    initialData?.assessments?.[domain]?.scenarios || {}
  )

  // Get scenarios for this domain
  const domainScenarios = scenarios?.scenarios[domain] || []

  const updateAssessment = (scenario: string, field: keyof ScenarioAssessment, value: any) => {
    setAssessments(prev => ({
      ...prev,
      [scenario]: {
        likelihood: "",
        impact: "",
        ...prev[scenario],
        [field]: value
      }
    }))
  }

  const isComplete = domainScenarios.length > 0 && domainScenarios.every(scenario => 
    assessments[scenario]?.likelihood && assessments[scenario]?.impact
  )

  const handleSubmit = () => {
    const finalData = { 
      assessments: {
        ...initialData?.assessments,
        [domain]: { 
          scenarios: assessments,
          custom_scenarios: {}
        }
      }
    }
    onSubmit(finalData)
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-4 p-4 border rounded-lg">
              <Skeleton className="h-4 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load scenarios for {domain}. Please try refreshing the page.
            Error: {error.message}
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} variant="eco" className="w-full" disabled>
          Cannot Continue - Scenarios Not Available
        </Button>
      </div>
    )
  }

  // Show no scenarios state
  if (domainScenarios.length === 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            No scenarios are currently configured for {domain}. Please contact your administrator.
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} variant="eco" className="w-full" disabled>
          No Scenarios Available
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Display domain description if available */}
      {scenarios?.domain_descriptions[domain] && (
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            {scenarios.domain_descriptions[domain]}
          </p>
        </div>
      )}

      {domainScenarios.map(scenario => (
        <div key={scenario} className="space-y-4 p-4 border rounded-lg">
          <Label className="text-sm font-medium leading-relaxed">{scenario}</Label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Likelihood</Label>
              <Select 
                value={assessments[scenario]?.likelihood || ""} 
                onValueChange={(value) => updateAssessment(scenario, 'likelihood', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select likelihood" />
                </SelectTrigger>
                <SelectContent>
                  {["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"].map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground">Impact</Label>
              <Select 
                value={assessments[scenario]?.impact || ""} 
                onValueChange={(value) => updateAssessment(scenario, 'impact', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select impact" />
                </SelectTrigger>
                <SelectContent>
                  {["Negligible", "Minor", "Moderate", "Major", "Catastrophic"].map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}
      
      <Button onClick={handleSubmit} variant="eco" className="w-full" disabled={!isComplete}>
        {domain === 'PHM' ? 'Complete Assessment' : 'Next Step'}
      </Button>
    </div>
  )
}

// Individual domain components that use the generic DomainStep
const RobustnessStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Robustness" />
)

const RedundancyStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Redundancy" />
)

const AdaptabilityStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Adaptability" />
)

const RapidityStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Rapidity" />
)

const PHMStep: React.FC<StepProps> = ({ onSubmit, initialData }) => {
  const { scenarios, isLoading, error } = useScenarios()
  const [assessments, setAssessments] = React.useState<Record<string, ScenarioAssessment>>(
    initialData?.assessments?.PHM?.scenarios || {}
  )

  const domainScenarios = scenarios?.scenarios.PHM || []

  const updateAssessment = (scenario: string, field: keyof ScenarioAssessment, value: any) => {
    setAssessments(prev => ({
      ...prev,
      [scenario]: {
        likelihood: "",
        impact: "",
        ...prev[scenario],
        [field]: value
      }
    }))
  }

  const isComplete = domainScenarios.length > 0 && domainScenarios.every(scenario => 
    assessments[scenario]?.likelihood && assessments[scenario]?.impact
  )

  const handleSubmit = () => {
    // Calculate total scenarios across all domains
    const allAssessments = {
      ...initialData?.assessments,
      PHM: { 
        scenarios: assessments,
        custom_scenarios: {}
      }
    }
    
    let totalScenarios = 0
    Object.values(allAssessments).forEach((domain: any) => {
      if (domain?.scenarios) {
        totalScenarios += Object.keys(domain.scenarios).length
      }
    })

    const finalData = { 
      assessments: allAssessments,
      metadata: {
        assessment_type: "resilience",
        version: "2.0",
        total_scenarios: totalScenarios,
        selected_domain_count: Object.keys(allAssessments).length,
        scenario_configuration_version: scenarios?.version || "unknown"
      }
    }
    onSubmit(finalData)
  }

  // Handle loading and error states (same as DomainStep)
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-4 p-4 border rounded-lg">
              <Skeleton className="h-4 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load scenarios for PHM. Please try refreshing the page.
            Error: {error.message}
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} variant="eco" className="w-full" disabled>
          Cannot Complete - Scenarios Not Available
        </Button>
      </div>
    )
  }

  if (domainScenarios.length === 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            No scenarios are currently configured for PHM. Please contact your administrator.
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} variant="eco" className="w-full" disabled>
          No Scenarios Available
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Display domain description */}
      {scenarios?.domain_descriptions.PHM && (
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            {scenarios.domain_descriptions.PHM}
          </p>
        </div>
      )}

      {domainScenarios.map(scenario => (
        <div key={scenario} className="space-y-4 p-4 border rounded-lg">
          <Label className="text-sm font-medium leading-relaxed">{scenario}</Label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Likelihood</Label>
              <Select 
                value={assessments[scenario]?.likelihood || ""} 
                onValueChange={(value) => updateAssessment(scenario, 'likelihood', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select likelihood" />
                </SelectTrigger>
                <SelectContent>
                  {["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"].map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground">Impact</Label>
              <Select 
                value={assessments[scenario]?.impact || ""} 
                onValueChange={(value) => updateAssessment(scenario, 'impact', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select impact" />
                </SelectTrigger>
                <SelectContent>
                  {["Negligible", "Minor", "Moderate", "Major", "Catastrophic"].map(option => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}
      
      <Button onClick={handleSubmit} variant="eco" className="w-full" disabled={!isComplete}>
        Complete Assessment
      </Button>
    </div>
  )
}

// Dynamic step generation based on available domains
export const getResilienceSteps = (): StepDefinition[] => {
  // This could be made even more dynamic by calling useScenarios here,
  // but for now we'll use the standard domains
  return [
    {
      title: "Robustness",
      description: "Evaluate system robustness under unexpected conditions",
      component: RobustnessStep
    },
    {
      title: "Redundancy", 
      description: "Assess backup systems and failover mechanisms",
      component: RedundancyStep
    },
    {
      title: "Adaptability",
      description: "Evaluate adaptability to changing conditions",
      component: AdaptabilityStep
    },
    {
      title: "Rapidity",
      description: "Assess speed of response and recovery",
      component: RapidityStep
    },
    {
      title: "PHM",
      description: "Evaluate prognostics and health management",
      component: PHMStep
    }
  ]
}

// Alternative: Fully dynamic step generation (use this if you want completely dynamic steps)
export const getDynamicResilienceSteps = (availableDomains: Array<{domain: string, description: string}>): StepDefinition[] => {
  return availableDomains.map((domain, index) => ({
    title: domain.domain,
    description: domain.description,
    component: (props: StepProps) => (
      <DomainStep 
        {...props} 
        domain={domain.domain}
      />
    )
  }))
}