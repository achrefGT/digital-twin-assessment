// Corrected ResilienceFormSteps.tsx with proper data preservation

import React from "react"
import { Button } from "@/components/ui/enhanced-button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const RobustnessStep = ({ onSubmit, initialData }: any) => {
  const [assessments, setAssessments] = React.useState<Record<string, { likelihood: string, impact: string }>>(
    initialData?.assessments?.Robustness?.scenarios || {}
  )

  const scenarios = [
    "Core model parameter drifts or becomes invalid",
    "Input data exceeds expected ranges", 
    "Critical compute module crashes under load",
    "Required external service becomes unavailable"
  ]

  const updateAssessment = (scenario: string, field: 'likelihood' | 'impact', value: string) => {
    setAssessments(prev => ({
      ...prev,
      [scenario]: {
        ...prev[scenario],
        [field]: value
      }
    }))
  }

  const handleSubmit = () => {
    console.log('DEBUG: Robustness step submitting:', { assessments })
    console.log('DEBUG: Existing data being preserved:', initialData?.assessments)
    const finalData = { 
      assessments: {
        ...initialData?.assessments, // ✅ FIXED: Now preserves existing data
        Robustness: { scenarios: assessments }
      }
    }
    console.log('DEBUG: Final merged data:', finalData)
    onSubmit(finalData)
  }

  return (
    <div className="space-y-6">
      
      {scenarios.map(scenario => (
        <div key={scenario} className="space-y-3 p-4 border rounded-lg">
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
      
      <Button onClick={handleSubmit} variant="eco" className="w-full">Next Step</Button>
    </div>
  )
}

const RedundancyStep = ({ onSubmit, initialData }: any) => {
  const [assessments, setAssessments] = React.useState<Record<string, { likelihood: string, impact: string }>>(
    initialData?.assessments?.Redundancy?.scenarios || {}
  )

  const scenarios = [
    "Primary data channel fails",
    "Backup resources are offline when needed", 
    "Multiple parallel processes stall simultaneously",
    "Failover logic does not trigger as designed"
  ]

  const updateAssessment = (scenario: string, field: 'likelihood' | 'impact', value: string) => {
    setAssessments(prev => ({
      ...prev,
      [scenario]: {
        ...prev[scenario],
        [field]: value
      }
    }))
  }

  const handleSubmit = () => {
    console.log('DEBUG: Redundancy step submitting:', { 
      Redundancy: { scenarios: assessments },
      existing: initialData?.assessments 
    })
    const finalData = { 
      assessments: {
        ...initialData?.assessments,
        Redundancy: { scenarios: assessments }
      }
    }
    console.log('DEBUG: Redundancy final merged data:', finalData)
    onSubmit(finalData)
  }

  return (
    <div className="space-y-6">
      
      {scenarios.map(scenario => (
        <div key={scenario} className="space-y-3 p-4 border rounded-lg">
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
      
      <Button onClick={handleSubmit} variant="eco" className="w-full">Next Step</Button>
    </div>
  )
}

const AdaptabilityStep = ({ onSubmit, initialData }: any) => {
  const [assessments, setAssessments] = React.useState<Record<string, { likelihood: string, impact: string }>>(
    initialData?.assessments?.Adaptability?.scenarios || {}
  )

  const scenarios = [
    "System must incorporate a new asset type on-the-fly",
    "An unforeseen failure mode emerges",
    "Configuration parameters change unexpectedly",
    "Operational conditions shift beyond original design"
  ]

  const updateAssessment = (scenario: string, field: 'likelihood' | 'impact', value: string) => {
    setAssessments(prev => ({
      ...prev,
      [scenario]: {
        ...prev[scenario],
        [field]: value
      }
    }))
  }

  const handleSubmit = () => {
    console.log('DEBUG: Adaptability step submitting:', { 
      Adaptability: { scenarios: assessments },
      existing: initialData?.assessments 
    })
    const finalData = { 
      assessments: {
        ...initialData?.assessments,
        Adaptability: { scenarios: assessments }
      }
    }
    console.log('DEBUG: Adaptability final merged data:', finalData)
    onSubmit(finalData)
  }

  return (
    <div className="space-y-6">
      
      {scenarios.map(scenario => (
        <div key={scenario} className="space-y-3 p-4 border rounded-lg">
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
      
      <Button onClick={handleSubmit} variant="eco" className="w-full">Next Step</Button>
    </div>
  )
}

const RapidityStep = ({ onSubmit, initialData }: any) => {
  const [assessments, setAssessments] = React.useState<Record<string, { likelihood: string, impact: string }>>(
    initialData?.assessments?.Rapidity?.scenarios || {}
  )

  const scenarios = [
    "Anomaly detection delayed beyond alert threshold",
    "Recovery routines restart slower than required",
    "Operator notifications delayed by system lag",
    "Corrective actions cannot be executed in time"
  ]

  const updateAssessment = (scenario: string, field: 'likelihood' | 'impact', value: string) => {
    setAssessments(prev => ({
      ...prev,
      [scenario]: {
        ...prev[scenario],
        [field]: value
      }
    }))
  }

  const handleSubmit = () => {
    console.log('DEBUG: Rapidity step submitting:', { 
      Rapidity: { scenarios: assessments },
      existing: initialData?.assessments 
    })
    const finalData = { 
      assessments: {
        ...initialData?.assessments,
        Rapidity: { scenarios: assessments }
      }
    }
    console.log('DEBUG: Rapidity final merged data:', finalData)
    onSubmit(finalData)
  }

  return (
    <div className="space-y-6">
      
      {scenarios.map(scenario => (
        <div key={scenario} className="space-y-3 p-4 border rounded-lg">
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
      
      <Button onClick={handleSubmit} variant="eco" className="w-full">Next Step</Button>
    </div>
  )
}

const PHMStep = ({ onSubmit, initialData }: any) => {
  const [assessments, setAssessments] = React.useState<Record<string, { likelihood: string, impact: string }>>(
    initialData?.assessments?.PHM?.scenarios || {}
  )

  const scenarios = [
    "Failure-prediction accuracy degrades significantly",
    "Remaining-useful-life estimates deviate widely", 
    "Maintenance recommendations cannot reach operators",
    "Health-monitoring data streams are interrupted"
  ]

  const updateAssessment = (scenario: string, field: 'likelihood' | 'impact', value: string) => {
    setAssessments(prev => ({
      ...prev,
      [scenario]: {
        ...prev[scenario],
        [field]: value
      }
    }))
  }

  const handleSubmit = () => {
    const finalData = { 
      assessments: {
        ...initialData?.assessments,
        PHM: { scenarios: assessments }
      }
    }
    console.log('DEBUG: PHM final step submitting complete assessment data:', finalData)
    console.log('DEBUG: Final assessment domains:', Object.keys(finalData.assessments))
    onSubmit(finalData)
  }

  return (
    <div className="space-y-6">
      
      {scenarios.map(scenario => (
        <div key={scenario} className="space-y-3 p-4 border rounded-lg">
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
      
      <Button onClick={handleSubmit} variant="eco" className="w-full">Complete Assessment</Button>
    </div>
  )
}

export const getResilienceSteps = () => [
  {
    title: "Robustness",
    description: "Evaluate system robustness under unexpected conditions",
    component: <RobustnessStep />
  },
  {
    title: "Redundancy", 
    description: "Assess backup systems and failover mechanisms",
    component: <RedundancyStep />
  },
  {
    title: "Adaptability",
    description: "Evaluate adaptability to changing conditions",
    component: <AdaptabilityStep />
  },
  {
    title: "Rapidity",
    description: "Assess speed of response and recovery",
    component: <RapidityStep />
  },
  {
    title: "PHM",
    description: "Evaluate prognostics and health management",
    component: <PHMStep />
  }
]