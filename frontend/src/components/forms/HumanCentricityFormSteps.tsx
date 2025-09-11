import React, { useState } from "react"
import { Button } from "@/components/ui/enhanced-button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, User, Shield, Activity, Brain, Heart, Zap } from "lucide-react"

// Small utilities to keep color usage consistent (avoids dynamic tailwind tokens)
const COLOR_CLASSES: Record<string, { bg: string; ring: string; text: string; accent: string }> = {
  blue: { bg: 'bg-blue-600', ring: 'ring-blue-200', text: 'text-blue-600', accent: 'border-blue-500' },
  purple: { bg: 'bg-purple-600', ring: 'ring-purple-200', text: 'text-purple-600', accent: 'border-purple-500' },
  indigo: { bg: 'bg-indigo-600', ring: 'ring-indigo-200', text: 'text-indigo-600', accent: 'border-indigo-500' },
  orange: { bg: 'bg-orange-600', ring: 'ring-orange-200', text: 'text-orange-600', accent: 'border-orange-500' },
  red: { bg: 'bg-red-600', ring: 'ring-red-200', text: 'text-red-600', accent: 'border-red-500' },
  green: { bg: 'bg-green-600', ring: 'ring-green-200', text: 'text-green-600', accent: 'border-green-500' }
}

// ------------------------------
// Step 1: Core Usability
// ------------------------------
const CoreUsabilityStep: React.FC<any> = ({ onSubmit, initialData }: any) => {
  const [responses, setResponses] = useState<any[]>(
    initialData?.core_usability_responses || new Array(8).fill(null).map(() => ({ rating: 4 }))
  )

  const statements = [
    "I found the digital twin intuitive and easy to use.",
    "The system's functions feel well integrated and coherent.",
    "I would use this digital twin frequently in my work.",
    "Learning to operate the system was quick and straightforward.",
    "I feel confident and in control when using the twin.",
    "The terminology and workflows match my domain expertise.",
    "I can easily customize views, dashboards, and alerts to my needs.",
    "I feel comfortable with how the system handles my data."
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
    const completeResponses = statements.map((statement, index) => ({
      statement: statement,
      rating: responses[index]?.rating || 4
    }))
    onSubmit({ core_usability_responses: completeResponses })
  }

  const getProgress = () => {
    const filledCount = responses.filter(r => r?.rating).length
    return (filledCount / statements.length) * 100
  }

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        {statements.map((statement, index) => (
          <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border-l-4 border-l-blue-500">
            <CardContent className="p-5">
              <div className="space-y-4">
                <Label className="text-sm font-semibold leading-relaxed text-gray-800">{statement}</Label>

                <RadioGroup
                  value={responses[index]?.rating?.toString() || "4"}
                  onValueChange={(value) => handleRatingChange(index, parseInt(value))}
                  className="flex justify-between gap-2 items-center"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((rating) => {
                    const selected = responses[index]?.rating === rating
                    return (
                      <div key={rating} className="flex flex-col items-center space-y-2">
                        <RadioGroupItem
                          value={rating.toString()}
                          id={`core-${index}-${rating}`}
                          className={
                            `w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                              selected ? 'bg-blue-600 border-transparent ring-2 ring-blue-200 text-white' : 'bg-white border-gray-200'
                            }`
                          }
                        />
                        <Label htmlFor={`core-${index}-${rating}`} className="text-xs cursor-pointer transition-colors duration-200 hover:text-blue-600">{rating}</Label>
                      </div>
                    )
                  })}
                </RadioGroup>

                <div className="flex justify-between text-xs text-gray-500 px-1">
                  <span>Strongly Disagree</span>
                  <span>Neutral</span>
                  <span>Strongly Agree</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={getProgress() < 100}
        className="w-full h-12 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
      >
        {getProgress() === 100 ? (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Complete Core Usability
          </>
        ) : (
          `Answer All Questions (${Math.round(getProgress())}%)`
        )}
      </Button>
    </div>
  )
}

// ------------------------------
// Step 2: Trust & Transparency
// ------------------------------
const TrustTransparencyStep: React.FC<any> = ({ onSubmit, initialData }: any) => {
  const [responses, setResponses] = useState<any[]>(
    initialData?.trust_transparency_responses || new Array(4).fill(null).map(() => ({ rating: 4 }))
  )

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
    const completeResponses = statements.map((statement, index) => ({
      statement: statement,
      rating: responses[index]?.rating || 4
    }))
    onSubmit({ trust_transparency_responses: completeResponses })
  }

  const getProgress = () => {
    const filledCount = responses.filter(r => r?.rating).length
    return (filledCount / statements.length) * 100
  }

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        {statements.map((statement, index) => (
          <Card key={index} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border-l-4 border-l-purple-500">
            <CardContent className="p-5">
              <div className="space-y-4">
                <Label className="text-sm font-semibold leading-relaxed text-gray-800">{statement}</Label>

                <RadioGroup
                  value={responses[index]?.rating?.toString() || "4"}
                  onValueChange={(value) => handleRatingChange(index, parseInt(value))}
                  className="flex justify-between gap-2 items-center"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((rating) => {
                    const selected = responses[index]?.rating === rating
                    return (
                      <div key={rating} className="flex flex-col items-center space-y-2">
                        <RadioGroupItem
                          value={rating.toString()}
                          id={`trust-${index}-${rating}`}
                          className={
                            `w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                              selected ? 'bg-purple-600 border-transparent ring-2 ring-purple-200 text-white' : 'bg-white border-gray-200'
                            }`
                          }
                        />
                        <Label htmlFor={`trust-${index}-${rating}`} className="text-xs cursor-pointer transition-colors duration-200 hover:text-purple-600">{rating}</Label>
                      </div>
                    )
                  })}
                </RadioGroup>

                <div className="flex justify-between text-xs text-gray-500 px-1">
                  <span>Strongly Disagree</span>
                  <span>Neutral</span>
                  <span>Strongly Agree</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={getProgress() < 100}
        className="w-full h-12 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
      >
        {getProgress() === 100 ? (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Complete Trust Assessment
          </>
        ) : (
          `Answer All Questions (${Math.round(getProgress())}%)`
        )}
      </Button>
    </div>
  )
}

// ------------------------------
// Step 3: Workload & Performance
// ------------------------------
const WorkloadPerformanceStep: React.FC<any> = ({ onSubmit, initialData }: any) => {
  const [workloadMetrics, setWorkloadMetrics] = useState({
    mental_demand: initialData?.workload_metrics?.mental_demand || 3,
    effort_required: initialData?.workload_metrics?.effort_required || 3,
    frustration_level: initialData?.workload_metrics?.frustration_level || 2
  })

  const [cybersicknessResponses, setCybersicknessResponses] = useState(
    initialData?.cybersickness_responses || [
      { symptom: "Queasiness or nausea", severity: 1 },
      { symptom: "Dizziness or off-balance feeling", severity: 1 },
      { symptom: "Eye strain or visual discomfort", severity: 2 }
    ]
  )

  const [emotionalResponse, setEmotionalResponse] = useState({
    valence: initialData?.emotional_response?.valence || 4,
    arousal: initialData?.emotional_response?.arousal || 3
  })

  const [performanceMetrics, setPerformanceMetrics] = useState({
    task_completion_time_min: initialData?.performance_metrics?.task_completion_time_min || "15.5",
    error_rate: initialData?.performance_metrics?.error_rate || "2",
    help_requests: initialData?.performance_metrics?.help_requests || "1"
  })

  const handleWorkloadChange = (metric: string, value: number) => {
    setWorkloadMetrics(prev => ({ ...prev, [metric]: value }))
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

  const isComplete = () => {
    const workloadComplete = Object.values(workloadMetrics).every(v => v > 0)
    const cybersicknessComplete = cybersicknessResponses.every(r => r.severity > 0)
    const emotionalComplete = emotionalResponse.valence > 0 && emotionalResponse.arousal > 0
    const performanceComplete = performanceMetrics.task_completion_time_min !== "" &&
      performanceMetrics.error_rate !== "" &&
      performanceMetrics.help_requests !== ""

    return workloadComplete && cybersicknessComplete && emotionalComplete && performanceComplete
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

  const workloadLabels = ["Low", "Moderate", "High", "Very High", "Extreme"]
  const severityLabels = ["None", "Slight", "Moderate", "Severe", "Very Severe"]
  const valenceLabels = ["Very Negative", "Negative", "Neutral", "Positive", "Very Positive"]
  const arousalLabels = ["Very Calm", "Calm", "Neutral", "Energetic", "Very Energetic"]

  return (
    <div className="space-y-6">

      {/* Workload Assessment */}
      <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-orange-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="w-5 h-5 text-orange-500" />
            Workload Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {[
            { key: 'mental_demand', label: 'Mental Demand' },
            { key: 'effort_required', label: 'Effort Required' },
            { key: 'frustration_level', label: 'Frustration Level' }
          ].map(({ key, label }) => (
            <div key={key} className="space-y-3">
              <Label className="text-sm font-medium text-gray-800">{label}</Label>
              <RadioGroup
                value={workloadMetrics[key as keyof typeof workloadMetrics].toString()}
                onValueChange={(value) => handleWorkloadChange(key, parseInt(value))}
                className="flex justify-between gap-2"
              >
                {workloadLabels.map((lab, index) => {
                  const selected = workloadMetrics[key as keyof typeof workloadMetrics] === index + 1
                  return (
                    <div key={index} className="flex flex-col items-center space-y-2">
                      <RadioGroupItem
                        value={(index + 1).toString()}
                        id={`${key}-${index}`}
                        className={`w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                          selected ? 'bg-orange-500 border-transparent ring-2 ring-orange-200 text-white' : 'bg-white border-gray-200'
                        }`}
                      />
                      <Label htmlFor={`${key}-${index}`} className="text-xs text-center cursor-pointer max-w-16 transition-colors duration-200 hover:text-orange-600">{lab}</Label>
                    </div>
                  )
                })}
              </RadioGroup>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Cybersickness Assessment */}
      <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-red-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-5 h-5 text-red-500" />
            Physical Symptoms
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {cybersicknessResponses.map((response, index) => (
            <div key={index} className="space-y-3">
              <Label className="text-sm font-medium text-gray-800">{response.symptom}</Label>
              <RadioGroup
                value={response.severity.toString()}
                onValueChange={(value) => handleCybersicknessChange(index, parseInt(value))}
                className="flex justify-between gap-2"
              >
                {severityLabels.map((label, severityIndex) => {
                  const selected = response.severity === severityIndex + 1
                  return (
                    <div key={severityIndex} className="flex flex-col items-center space-y-2">
                      <RadioGroupItem
                        value={(severityIndex + 1).toString()}
                        id={`symptom-${index}-${severityIndex}`}
                        className={`w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                          selected ? 'bg-red-500 border-transparent ring-2 ring-red-200 text-white' : 'bg-white border-gray-200'
                        }`}
                      />
                      <Label htmlFor={`symptom-${index}-${severityIndex}`} className="text-xs text-center cursor-pointer max-w-16 transition-colors duration-200 hover:text-red-600">{label}</Label>
                    </div>
                  )
                })}
              </RadioGroup>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Emotional Response */}
      <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Heart className="w-5 h-5 text-green-500" />
            Emotional Response
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-800">Overall Experience</Label>
            <RadioGroup
              value={emotionalResponse.valence.toString()}
              onValueChange={(value) => handleEmotionalChange('valence', parseInt(value))}
              className="flex justify-between gap-2"
            >
              {valenceLabels.map((label, index) => {
                const selected = emotionalResponse.valence === index + 1
                return (
                  <div key={index} className="flex flex-col items-center space-y-2">
                    <RadioGroupItem
                      value={(index + 1).toString()}
                      id={`valence-${index}`}
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                        selected ? 'bg-green-500 border-transparent ring-2 ring-green-200 text-white' : 'bg-white border-gray-200'
                      }`}
                    />
                    <Label htmlFor={`valence-${index}`} className="text-xs text-center cursor-pointer max-w-16 transition-colors duration-200 hover:text-green-600">{label}</Label>
                  </div>
                )
              })}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-800">Energy Level</Label>
            <RadioGroup
              value={emotionalResponse.arousal.toString()}
              onValueChange={(value) => handleEmotionalChange('arousal', parseInt(value))}
              className="flex justify-between gap-2"
            >
              {arousalLabels.map((label, index) => {
                const selected = emotionalResponse.arousal === index + 1
                return (
                  <div key={index} className="flex flex-col items-center space-y-2">
                    <RadioGroupItem
                      value={(index + 1).toString()}
                      id={`arousal-${index}`}
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                        selected ? 'bg-green-500 border-transparent ring-2 ring-green-200 text-white' : 'bg-white border-gray-200'
                      }`}
                    />
                    <Label htmlFor={`arousal-${index}`} className="text-xs text-center cursor-pointer max-w-16 transition-colors duration-200 hover:text-green-600">{label}</Label>
                  </div>
                )
              })}
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-indigo-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="w-5 h-5 text-indigo-500" />
            Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label htmlFor="taskTime" className="text-sm font-medium text-gray-800">Task Time (minutes)</Label>
            <Input
              id="taskTime"
              type="number"
              step="0.1"
              placeholder="15.5"
              value={performanceMetrics.task_completion_time_min}
              onChange={(e) => handlePerformanceChange('task_completion_time_min', e.target.value)}
              className="transition-all duration-200 focus:scale-105 focus:shadow-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="errorRate" className="text-sm font-medium text-gray-800">Error Count</Label>
            <Input
              id="errorRate"
              type="number"
              placeholder="2"
              value={performanceMetrics.error_rate}
              onChange={(e) => handlePerformanceChange('error_rate', e.target.value)}
              className="transition-all duration-200 focus:scale-105 focus:shadow-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="helpRequests" className="text-sm font-medium text-gray-800">Help Requests</Label>
            <Input
              id="helpRequests"
              type="number"
              placeholder="1"
              value={performanceMetrics.help_requests}
              onChange={(e) => handlePerformanceChange('help_requests', e.target.value)}
              className="transition-all duration-200 focus:scale-105 focus:shadow-lg"
            />
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSubmit}
        disabled={!isComplete()}
        className="w-full h-12 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white"
      >
        {isComplete() ? (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Complete Workload & Performance Assessment
          </>
        ) : (
          "Fill out all sections to continue"
        )}
      </Button>
    </div>
  )
}

// ------------------------------
// Main form component
// ------------------------------
export const HumanCentricityForm: React.FC<{
  assessmentId?: string;
  userId?: string;
  systemName?: string;
  onSubmit?: (data: any) => void;
  initialData?: any;
}> = ({
  assessmentId = "assessment_123456",
  userId = "user_789",
  systemName = "Digital Twin Manufacturing System",
  onSubmit,
  initialData = {}
}) => {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState(initialData.form_data || {})
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const steps = [
    {
      title: "Core Usability",
      description: "Evaluate basic usability and system integration",
      component: CoreUsabilityStep,
      icon: User,
      color: "blue"
    },
    {
      title: "Trust & Transparency",
      description: "Assess trust in system outputs and transparency",
      component: TrustTransparencyStep,
      icon: Shield,
      color: "purple"
    },
    {
      title: "Workload & Performance",
      description: "Measure workload, cybersickness, emotions, and performance",
      component: WorkloadPerformanceStep,
      icon: Activity,
      color: "indigo"
    }
  ]

  const handleStepSubmit = (stepData: any) => {
    const updatedFormData = { ...formData, ...stepData }
    setFormData(updatedFormData)
    setCompletedSteps(prev => new Set([...prev, currentStep]))

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Final submission
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
  const overallProgress = ((completedSteps.size) / steps.length) * 100

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-2 rounded-full border border-blue-100">
          <User className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-900">Human Centricity Assessment</span>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900">{systemName}</h1>
        <p className="text-gray-600">Comprehensive evaluation of user experience and system interaction</p>

        {/* Progress */}
        <div className="max-w-md mx-auto space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Overall Progress</span>
            <span className="font-medium">{Math.round(overallProgress)}%</span>
          </div>
          <Progress value={overallProgress} className="h-3 rounded-full transition-all duration-500 shadow-sm" />
        </div>
      </div>

      {/* Step Navigation */}
      <div className="flex items-center justify-between bg-white p-6 rounded-xl border shadow-sm">
        {steps.map((step, index) => {
          const IconComponent = step.icon
          const isCompleted = completedSteps.has(index)
          const isCurrent = index === currentStep
          const color = COLOR_CLASSES[step.color] || COLOR_CLASSES.blue

          return (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center space-y-3 transition-all duration-300 hover:scale-105">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  isCurrent
                    ? `${color.bg} text-white shadow-lg ring-4 ${color.ring}`
                    : isCompleted
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-600'
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <IconComponent className="w-5 h-5" />}
                </div>
                <div className="text-center">
                  <div className={`text-sm font-medium ${isCurrent ? color.text : isCompleted ? 'text-green-600' : 'text-gray-600'}`}>
                    {step.title}
                  </div>
                  <div className="text-xs text-gray-500 max-w-24">{step.description}</div>
                </div>
              </div>

              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Current Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep].title}</CardTitle>
          <CardDescription>{steps[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent>
          <CurrentStepComponent onSubmit={handleStepSubmit} initialData={formData} />
        </CardContent>
      </Card>

      {/* Navigation */}
      {currentStep > 0 && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={goToPreviousStep} className="px-6 py-2">
            Previous Step
          </Button>
        </div>
      )}
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
