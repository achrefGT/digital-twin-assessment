import React, { useState } from "react"
import { Button } from "@/components/ui/enhanced-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ArrowRight, CheckCircle } from "lucide-react"

interface PaginatedFormProps {
  steps: {
    title: string
    description: string
    component: React.ReactNode
  }[]
  onComplete: (allData: any) => void
  assessmentInfo: any
}

export const PaginatedForm = ({ steps, onComplete, assessmentInfo }: PaginatedFormProps) => {
  
  if (!steps || steps.length === 0) return <div className="text-center p-12">No steps available.</div>

  const [currentStep, setCurrentStep] = useState(0)
  const [stepData, setStepData] = useState<Record<number, any>>({})
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  // Track accumulated assessment data across all steps
  const [accumulatedAssessments, setAccumulatedAssessments] = useState<any>({})

  const progress = ((currentStep + 1) / steps.length) * 100

  const handleStepComplete = (data: any) => {
    console.log('🔥 PaginatedForm: Received data from step', currentStep, ':', data)
    
    // Store the step data
    const updatedStepData = {
      ...stepData,
      [currentStep]: data
    }
    setStepData(updatedStepData)

    // CRITICAL: Calculate the final accumulated assessments INCLUDING this step's data
    const finalAccumulatedAssessments = data.assessments 
      ? { ...accumulatedAssessments, ...data.assessments }
      : accumulatedAssessments

    // Update state for next step (if any)
    setAccumulatedAssessments(finalAccumulatedAssessments)
    console.log('📊 PaginatedForm: Final accumulated assessments (including current step):', finalAccumulatedAssessments)
    
    setCompletedSteps(prev => new Set([...prev, currentStep]))

    if (currentStep < steps.length - 1) {
      // Move to next step
      setCurrentStep(currentStep + 1)
    } else {
      // Final step completed - prepare final data
      console.log('🏁 Final step completed. Preparing final data...')
      console.log('🔍 All step data:', updatedStepData)
      
      // Merge all non-assessment data from all steps
      const allStepData = Object.values(updatedStepData).reduce((acc, curr) => {
        const { assessments, ...otherData } = curr as any
        return { ...acc, ...otherData }
      }, {})
      
      // CRITICAL: Use the finalAccumulatedAssessments that includes the current step
      const finalData = {
        ...allStepData,
        assessments: finalAccumulatedAssessments, // ← Use the updated version, not the stale state
        // Include metadata if present in the final step
        ...(data.metadata && { metadata: data.metadata })
      }
      
      console.log('✅ PaginatedForm: Final complete data:', finalData)
      console.log('✅ PaginatedForm: Final assessment domains:', Object.keys(finalData.assessments || {}))
      console.log('✅ PaginatedForm: Assessment domains count:', Object.keys(finalData.assessments || {}).length)
      
      onComplete(finalData)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const canGoNext = completedSteps.has(currentStep)

  return (
    <div className="space-y-6">
      {/* Progress Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
            
            {/* Step indicators */}
            <div className="flex justify-between text-xs">
              {steps.map((step, index) => (
                <div key={index} className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mb-1 ${
                    index === currentStep 
                      ? 'border-eco-green bg-eco-green text-white' 
                      : completedSteps.has(index)
                      ? 'border-eco-green bg-eco-green text-white'
                      : 'border-muted-foreground'
                  }`}>
                    {completedSteps.has(index) ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <span className={`text-center ${index === currentStep ? 'text-eco-green font-medium' : 'text-muted-foreground'}`}>
                    {step.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep].title}</CardTitle>
          <CardDescription>{steps[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {React.cloneElement(steps[currentStep].component as React.ReactElement, {
            onSubmit: handleStepComplete,
            initialData: {
              // Pass accumulated assessments to each step
              assessments: accumulatedAssessments,
              // Also include current step data for form restoration
              ...stepData[currentStep]
            },
            allStepData: stepData,
            assessmentInfo
          })}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        
        {currentStep < steps.length - 1 && (
          <Button
            variant="eco"
            onClick={handleNext}
            disabled={!canGoNext}
          >
            Next Step
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  )
}