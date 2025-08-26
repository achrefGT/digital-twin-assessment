import React, { useState } from "react"
import { Button } from "@/components/ui/enhanced-button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

// Step 1: Core Usability
const CoreUsabilityStep = ({ onSubmit, initialData }: any) => {
  const [responses, setResponses] = useState<any[]>(initialData?.core_usability_responses || [])

  const statements = [
    "I found the digital twin intuitive and easy to use.",
    "The system's functions feel well integrated and coherent.",
    "I would use this digital twin frequently in my work.",
    "Learning to operate the system was quick and straightforward.",
    "I feel confident and in control when using the twin.",
    "The terminology and workflows match my domain expertise.",
    "I can easily tailor views, dashboards, and alerts to my needs.",
    "I feel comfortable with how the system collects, uses, and displays my data."
  ]

  const handleRatingChange = (index: number, rating: number) => {
    const newResponses = [...responses]
    newResponses[index] = {
      statement: statements[index],
      rating: rating
    }
    setResponses(newResponses)
  }

  const handleSubmit = () => {
    // Ensure all responses are filled with default rating of 4 if not set
    const completeResponses = statements.map((statement, index) => ({
      statement,
      rating: responses[index]?.rating || 4
    }))
    onSubmit({ core_usability_responses: completeResponses })
  }

  return (
    <Card className="shadow-md">
      <CardContent className="space-y-8 pt-4">
        {statements.map((statement, index) => (
          <div key={index} className="space-y-4">
            <Label className="text-sm font-medium leading-relaxed">{statement}</Label>
            <RadioGroup
              value={responses[index]?.rating?.toString() || "4"}
              onValueChange={(value) => handleRatingChange(index, parseInt(value))}
              className="flex justify-between"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((rating) => (
                <div key={rating} className="flex flex-col items-center space-y-2">
                  <RadioGroupItem value={rating.toString()} id={`${index}-${rating}`} />
                  <Label 
                    htmlFor={`${index}-${rating}`} 
                    className="text-xs cursor-pointer"
                  >
                    {rating}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Strongly Disagree</span>
              <span>Neutral</span>
              <span>Strongly Agree</span>
            </div>
          </div>
        ))}
        
        <Button onClick={handleSubmit} className="w-full">Complete Step</Button>
      </CardContent>
    </Card>
  )
}

// Step 2: Trust & Transparency
const TrustTransparencyStep = ({ onSubmit, initialData }: any) => {
  const [responses, setResponses] = useState<any[]>(initialData?.trust_transparency_responses || [])

  const statements = [
    "I understand the origins and currency of the data shown.",
    "The system explains how it generated its insights or recommendations.",
    "I trust the accuracy and reliability of the digital twin's outputs.",
    "I feel confident making operational decisions based on the twin's insights."
  ]

  const handleRatingChange = (index: number, rating: number) => {
    const newResponses = [...responses]
    newResponses[index] = {
      statement: statements[index],
      rating: rating
    }
    setResponses(newResponses)
  }

  const handleSubmit = () => {
    // Ensure all responses are filled with default rating of 4 if not set
    const completeResponses = statements.map((statement, index) => ({
      statement,
      rating: responses[index]?.rating || 4
    }))
    onSubmit({ trust_transparency_responses: completeResponses })
  }

  return (
    <Card className="shadow-md">
      <CardContent className="space-y-8 pt-4">
        {statements.map((statement, index) => (
          <div key={index} className="space-y-4">
            <Label className="text-sm font-medium leading-relaxed">{statement}</Label>
            <RadioGroup
              value={responses[index]?.rating?.toString() || "4"}
              onValueChange={(value) => handleRatingChange(index, parseInt(value))}
              className="flex justify-between"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((rating) => (
                <div key={rating} className="flex flex-col items-center space-y-2">
                  <RadioGroupItem value={rating.toString()} id={`trust-${index}-${rating}`} />
                  <Label 
                    htmlFor={`trust-${index}-${rating}`} 
                    className="text-xs cursor-pointer"
                  >
                    {rating}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Strongly Disagree</span>
              <span>Neutral</span>
              <span>Strongly Agree</span>
            </div>
          </div>
        ))}
        
        <Button onClick={handleSubmit} className="w-full">Complete Step</Button>
      </CardContent>
    </Card>
  )
}

// Step 3: Workload & Performance  
const WorkloadPerformanceStep = ({ onSubmit, initialData }: any) => {
  const [workloadMetrics, setWorkloadMetrics] = useState({
    mental_demand: initialData?.workload_metrics?.mental_demand || 60,
    effort_required: initialData?.workload_metrics?.effort_required || 60,
    frustration_level: initialData?.workload_metrics?.frustration_level || 40
  })

  const [cybersicknessResponses, setCybersicknessResponses] = useState(
    initialData?.cybersickness_responses || [
      { symptom: "Queasiness or nausea", severity: 1 },
      { symptom: "Dizziness or off-balance feeling", severity: 1 },
      { symptom: "Eye strain or visual discomfort", severity: 1 }
    ]
  )

  const [emotionalResponse, setEmotionalResponse] = useState({
    valence: initialData?.emotional_response?.valence || 3,
    arousal: initialData?.emotional_response?.arousal || 3
  })

  const [performanceMetrics, setPerformanceMetrics] = useState({
    task_completion_time_min: initialData?.performance_metrics?.task_completion_time_min || "",
    error_rate: initialData?.performance_metrics?.error_rate || "",
    help_requests: initialData?.performance_metrics?.help_requests || ""
  })

  // Convert 0-100 scale to 1-5 scale for display
  const scaleToDisplay = (value: number) => Math.round(value / 20) || 1
  const displayToScale = (display: number) => display * 20

  const handleWorkloadChange = (metric: string, displayValue: number) => {
    setWorkloadMetrics(prev => ({ ...prev, [metric]: displayToScale(displayValue) }))
  }

  const handleCybersicknessChange = (index: number, severity: number) => {
    const newResponses = [...cybersicknessResponses]
    newResponses[index].severity = severity
    setCybersicknessResponses(newResponses)
  }

  const handleEmotionalChange = (dimension: string, value: number) => {
    setEmotionalResponse(prev => ({ ...prev, [dimension]: value }))
  }

  const handlePerformanceChange = (metric: string, value: string) => {
    setPerformanceMetrics(prev => ({ ...prev, [metric]: value }))
  }

  const handleSubmit = () => {
    const finalData = {
      workload_metrics: workloadMetrics,
      cybersickness_responses: cybersicknessResponses,
      emotional_response: emotionalResponse,
      performance_metrics: {
        task_completion_time_min: parseFloat(performanceMetrics.task_completion_time_min) || 0,
        error_rate: parseInt(performanceMetrics.error_rate) || 0,
        help_requests: parseInt(performanceMetrics.help_requests) || 0
      }
    }
    
    onSubmit(finalData)
  }

  return (
    <Card className="shadow-md">
      <CardContent className="space-y-8 pt-4">
        {/* NASA-TLX Workload Metrics */}
        <div className="space-y-6">
          <h4 className="font-medium">Workload Assessment</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Mental Demand</Label>
              <RadioGroup
                value={scaleToDisplay(workloadMetrics.mental_demand).toString()}
                onValueChange={(value) => handleWorkloadChange('mental_demand', parseInt(value))}
                className="space-y-2"
              >
                {["Low", "Moderate", "High", "Very High", "Extreme"].map((label, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={(index + 1).toString()} id={`mental-${index}`} />
                    <Label htmlFor={`mental-${index}`} className="text-sm cursor-pointer">{label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Effort Required</Label>
              <RadioGroup
                value={scaleToDisplay(workloadMetrics.effort_required).toString()}
                onValueChange={(value) => handleWorkloadChange('effort_required', parseInt(value))}
                className="space-y-2"
              >
                {["Low", "Moderate", "High", "Very High", "Extreme"].map((label, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={(index + 1).toString()} id={`effort-${index}`} />
                    <Label htmlFor={`effort-${index}`} className="text-sm cursor-pointer">{label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Frustration Level</Label>
              <RadioGroup
                value={scaleToDisplay(workloadMetrics.frustration_level).toString()}
                onValueChange={(value) => handleWorkloadChange('frustration_level', parseInt(value))}
                className="space-y-2"
              >
                {["Low", "Moderate", "High", "Very High", "Extreme"].map((label, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={(index + 1).toString()} id={`frustration-${index}`} />
                    <Label htmlFor={`frustration-${index}`} className="text-sm cursor-pointer">{label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        </div>

        {/* Cybersickness Assessment */}
        <div className="space-y-6">
          <h4 className="font-medium">Physical Symptoms</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {cybersicknessResponses.map((response, index) => (
              <div key={index} className="space-y-3">
                <Label className="text-sm font-medium">{response.symptom}</Label>
                <RadioGroup
                  value={response.severity.toString()}
                  onValueChange={(value) => handleCybersicknessChange(index, parseInt(value))}
                  className="space-y-2"
                >
                  {["None", "Slight", "Moderate", "Severe", "Very Severe"].map((label, severityIndex) => (
                    <div key={severityIndex} className="flex items-center space-x-2">
                      <RadioGroupItem value={(severityIndex + 1).toString()} id={`symptom-${index}-${severityIndex}`} />
                      <Label htmlFor={`symptom-${index}-${severityIndex}`} className="text-sm cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ))}
          </div>
        </div>

        {/* Emotional Response */}
        <div className="space-y-6">
          <h4 className="font-medium">Emotional Response</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Overall Experience</Label>
              <RadioGroup
                value={emotionalResponse.valence.toString()}
                onValueChange={(value) => handleEmotionalChange('valence', parseInt(value))}
                className="space-y-2"
              >
                {["Very Negative", "Negative", "Neutral", "Positive", "Very Positive"].map((label, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={(index + 1).toString()} id={`valence-${index}`} />
                    <Label htmlFor={`valence-${index}`} className="text-sm cursor-pointer">{label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Energy Level</Label>
              <RadioGroup
                value={emotionalResponse.arousal.toString()}
                onValueChange={(value) => handleEmotionalChange('arousal', parseInt(value))}
                className="space-y-2"
              >
                {["Very Calm", "Calm", "Neutral", "Energetic", "Very Energetic"].map((label, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={(index + 1).toString()} id={`arousal-${index}`} />
                    <Label htmlFor={`arousal-${index}`} className="text-sm cursor-pointer">{label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="space-y-6">
          <h4 className="font-medium">Performance Metrics</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="taskTime" className="text-sm font-medium">Task Completion Time (minutes)</Label>
              <Input
                id="taskTime"
                type="number"
                step="0.1"
                placeholder="15.5"
                value={performanceMetrics.task_completion_time_min}
                onChange={(e) => handlePerformanceChange('task_completion_time_min', e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="errorRate" className="text-sm font-medium">Error Rate (count)</Label>
              <Input
                id="errorRate"
                type="number"
                placeholder="2"
                value={performanceMetrics.error_rate}
                onChange={(e) => handlePerformanceChange('error_rate', e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="helpRequests" className="text-sm font-medium">Help Requests (count)</Label>
              <Input
                id="helpRequests"
                type="number"
                placeholder="1"
                value={performanceMetrics.help_requests}
                onChange={(e) => handlePerformanceChange('help_requests', e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
        </div>

        <Button onClick={handleSubmit} className="w-full">Complete Assessment</Button>
      </CardContent>
    </Card>
  )
}

// Main form component that combines all steps and generates final JSON
export const HumanCentricityForm = ({ 
  assessmentId = "assessment_123456",
  userId = "user_789", 
  systemName = "Digital Twin Manufacturing System",
  onSubmit,
  initialData = {}
}: {
  assessmentId?: string;
  userId?: string;
  systemName?: string;
  onSubmit?: (data: any) => void;
  initialData?: any;
}) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState(initialData.form_data || {})

  const steps = [
    {
      title: "Core Usability",
      description: "Evaluate basic usability and system integration",
      component: CoreUsabilityStep
    },
    {
      title: "Trust & Transparency", 
      description: "Assess trust in system outputs and transparency",
      component: TrustTransparencyStep
    },
    {
      title: "Workload & Performance",
      description: "Measure workload, cybersickness, emotions, and performance",
      component: WorkloadPerformanceStep
    }
  ]

  const handleStepSubmit = (stepData: any) => {
    const updatedFormData = { ...formData, ...stepData }
    setFormData(updatedFormData)
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Final submission - generate complete JSON
      const finalJson = {
        assessment_id: assessmentId,
        user_id: userId,
        system_name: systemName,
        domain: "human_centricity",
        form_data: updatedFormData,
        metadata: {
          session_duration_minutes: 45,
          user_experience_level: "intermediate",
          system_version: "v2.1.3",
          browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other',
          device_type: "desktop",
          submission_timestamp: new Date().toISOString(),
          assessment_structure: "sectioned",
          core_usability_count: updatedFormData.core_usability_responses?.length || 8,
          trust_transparency_count: updatedFormData.trust_transparency_responses?.length || 4
        }
      }
      
      if (onSubmit) {
        onSubmit(finalJson)
      }
      
      console.log("Final Human Centricity Assessment JSON:", JSON.stringify(finalJson, null, 2))
    }
  }

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const CurrentStepComponent = steps[currentStep].component

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2">Human Centricity Assessment</h2>
        <p className="text-muted-foreground mb-4">{systemName}</p>
        
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index <= currentStep 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {index + 1}
              </div>
              <div className="ml-2 text-sm">
                <div className="font-medium">{step.title}</div>
                <div className="text-muted-foreground">{step.description}</div>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-16 h-1 mx-4 ${
                  index < currentStep ? 'bg-primary' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <CurrentStepComponent 
          onSubmit={handleStepSubmit} 
          initialData={formData}
        />
        
        {currentStep > 0 && (
          <Button 
            variant="outline" 
            onClick={goToPreviousStep}
            className="w-full"
          >
            Previous Step
          </Button>
        )}
      </div>
    </div>
  )
}

export const getHumanCentricitySteps = () => [
  {
    title: "Core Usability",
    description: "Evaluate basic usability and system integration",
    component: <CoreUsabilityStep />
  },
  {
    title: "Trust & Transparency", 
    description: "Assess trust in system outputs and transparency",
    component: <TrustTransparencyStep />
  },
  {
    title: "Workload & Performance",
    description: "Measure workload, cybersickness, emotions, and performance",
    component: <WorkloadPerformanceStep />
  }
]