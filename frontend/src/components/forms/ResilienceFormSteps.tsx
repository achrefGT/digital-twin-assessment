import React from "react"
import { Button } from "@/components/ui/enhanced-button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

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

const RobustnessStep = ({ onSubmit, initialData }: StepProps) => {
  const [assessments, setAssessments] = React.useState<Record<string, ScenarioAssessment>>(
    initialData?.assessments?.Robustness?.scenarios || {}
  )

  const scenarios = [
    "Core model parameter drifts or becomes invalid",
    "Input data exceeds expected ranges", 
    "Critical compute module crashes under load",
    "Required external service becomes unavailable"
  ]

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

  const isComplete = scenarios.every(scenario => 
    assessments[scenario]?.likelihood && assessments[scenario]?.impact
  )

  const handleSubmit = () => {
    const finalData = { 
      assessments: {
        ...initialData?.assessments,
        Robustness: { 
          scenarios: assessments,
          custom_scenarios: {}
        }
      }
    }
    onSubmit(finalData)
  }

  return (
    <div className="space-y-6">
      {scenarios.map(scenario => (
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
        Next Step
      </Button>
    </div>
  )
}

const RedundancyStep = ({ onSubmit, initialData }: StepProps) => {
  const [assessments, setAssessments] = React.useState<Record<string, ScenarioAssessment>>(
    initialData?.assessments?.Redundancy?.scenarios || {}
  )

  const scenarios = [
    "Primary data channel fails",
    "Backup resources are offline when needed", 
    "Multiple parallel processes stall simultaneously",
    "Failover logic does not trigger as designed"
  ]

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

  const isComplete = scenarios.every(scenario => 
    assessments[scenario]?.likelihood && assessments[scenario]?.impact
  )

  const handleSubmit = () => {
    const finalData = { 
      assessments: {
        ...initialData?.assessments,
        Redundancy: { 
          scenarios: assessments,
          custom_scenarios: {}
        }
      }
    }
    onSubmit(finalData)
  }

  return (
    <div className="space-y-6">
      {scenarios.map(scenario => (
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
        Next Step
      </Button>
    </div>
  )
}

const AdaptabilityStep = ({ onSubmit, initialData }: StepProps) => {
  const [assessments, setAssessments] = React.useState<Record<string, ScenarioAssessment>>(
    initialData?.assessments?.Adaptability?.scenarios || {}
  )

  const scenarios = [
    "System must incorporate a new asset type on-the-fly",
    "An unforeseen failure mode emerges",
    "Configuration parameters change unexpectedly",
    "Operational conditions shift beyond original design"
  ]

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

  const isComplete = scenarios.every(scenario => 
    assessments[scenario]?.likelihood && assessments[scenario]?.impact
  )

  const handleSubmit = () => {
    const finalData = { 
      assessments: {
        ...initialData?.assessments,
        Adaptability: { 
          scenarios: assessments,
          custom_scenarios: {}
        }
      }
    }
    onSubmit(finalData)
  }

  return (
    <div className="space-y-6">
      {scenarios.map(scenario => (
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
        Next Step
      </Button>
    </div>
  )
}

const RapidityStep = ({ onSubmit, initialData }: StepProps) => {
  const [assessments, setAssessments] = React.useState<Record<string, ScenarioAssessment>>(
    initialData?.assessments?.Rapidity?.scenarios || {}
  )

  const scenarios = [
    "Anomaly detection delayed beyond alert threshold",
    "Recovery routines restart slower than required",
    "Operator notifications delayed by system lag",
    "Corrective actions cannot be executed in time"
  ]

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

  const isComplete = scenarios.every(scenario => 
    assessments[scenario]?.likelihood && assessments[scenario]?.impact
  )

  const handleSubmit = () => {
    const finalData = { 
      assessments: {
        ...initialData?.assessments,
        Rapidity: { 
          scenarios: assessments,
          custom_scenarios: {}
        }
      }
    }
    onSubmit(finalData)
  }

  return (
    <div className="space-y-6">
      {scenarios.map(scenario => (
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
        Next Step
      </Button>
    </div>
  )
}

const PHMStep = ({ onSubmit, initialData }: StepProps) => {
  const [assessments, setAssessments] = React.useState<Record<string, ScenarioAssessment>>(
    initialData?.assessments?.PHM?.scenarios || {}
  )

  const scenarios = [
    "Failure-prediction accuracy degrades significantly",
    "Remaining-useful-life estimates deviate widely", 
    "Maintenance recommendations cannot reach operators",
    "Health-monitoring data streams are interrupted"
  ]

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

  const isComplete = scenarios.every(scenario => 
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
        selected_domain_count: Object.keys(allAssessments).length
      }
    }
    onSubmit(finalData)
  }

  return (
    <div className="space-y-6">
      {scenarios.map(scenario => (
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

export const getResilienceSteps = (): StepDefinition[] => [
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