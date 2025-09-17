import { useState } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/enhanced-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ArrowRight, FileText } from "lucide-react"
import { useAuth } from "@/auth"

interface CreateAssessmentProps {
  onAssessmentCreated: (assessment: any) => void
  domain?: string
  userId?: string
}

export const CreateAssessment = ({ onAssessmentCreated, domain, userId }: CreateAssessmentProps) => {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const { toast } = useToast()
  const [isCreating, setIsCreating] = useState(false)

  // Use existing auth system
  const { token, isAuthenticated, user } = useAuth()

  const createAssessment = async (data: any) => {
    setIsCreating(true)
    
    try {

      if (!isAuthenticated || !token) {
        throw new Error('Please log in to create an assessment')
      }
      
      const payload = {
        system_name: data.systemName,
        metadata: {
          assessment_type: domain || "full",
          version: "1.0"
        }
      }
      
      console.log('Creating assessment with payload:', payload) // For debugging
      
      // Submit to backend
      const response = await fetch('http://localhost:8000/assessments/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (response.status === 401) {
        throw new Error('Session expired. Please log in again.')
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const backendAssessment = await response.json()
      
      // Create assessment object with backend response + additional data for form
      const assessment = {
        assessment_id: backendAssessment.assessment_id || backendAssessment.id,
        user_id: backendAssessment.user_id, // Use backend user_id
        system_name: data.systemName,
        domain: domain,
        description: data.description,
        organization: data.organization,
        created_at: backendAssessment.created_at,
        metadata: backendAssessment.metadata || {
          assessment_type: domain || "full",
          version: "1.0"
        }
      }
      
      // Validate required IDs exist
      if (!assessment.assessment_id || !assessment.user_id) {
        throw new Error('Backend did not provide required IDs')
      }

      onAssessmentCreated(assessment)
      
      toast({
        title: "Assessment Created",
        description: `Assessment ${assessment.assessment_id} has been created successfully.`
      })
      
    } catch (error) {
      console.error('Error creating assessment:', error)

      toast({
        title: error.message.includes('log in') ? "Authentication Required" : "Assessment Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create assessment",
        variant: "destructive"
      })
      
      throw error // Don't create local assessment
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-eco-green rounded-full">
              <FileText className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">Create New Assessment</CardTitle>
          <CardDescription className="text-base">
            Set up your digital twin assessment to begin evaluating sustainability, performance, and resilience metrics
          </CardDescription>
          {domain && (
            <Badge className="bg-eco-green text-white mx-auto mt-2">
              {domain.toUpperCase()}
            </Badge>
          )}
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit(createAssessment)} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="systemName">Digital Twin System Name *</Label>
                <Input
                  {...register("systemName", { 
                    required: "System name is required",
                    minLength: { value: 3, message: "System name must be at least 3 characters" }
                  })}
                  placeholder="e.g., Manufacturing Digital Twin System"
                  className="mt-1"
                />
                {errors.systemName && (
                  <p className="text-sm text-destructive mt-1">{errors.systemName.message as string}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  {...register("description")}
                  placeholder="Brief description of your digital twin system"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="organization">Organization (Optional)</Label>
                <Input
                  {...register("organization")}
                  placeholder="Your organization or company name"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="bg-gradient-to-r from-eco-green/10 to-primary/10 p-6 rounded-lg border border-eco-green/20">
              <h4 className="font-semibold mb-3 text-lg">Assessment Process Overview:</h4>
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-eco-green mt-2 flex-shrink-0"></span>
                  <span>Create your assessment with a unique system identifier</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-eco-green mt-2 flex-shrink-0"></span>
                  <span>Complete multi-step evaluations across different domains</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-eco-green mt-2 flex-shrink-0"></span>
                  <span>Monitor real-time progress in the interactive dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-eco-green mt-2 flex-shrink-0"></span>
                  <span>View comprehensive results and analytics upon completion</span>
                </li>
              </ul>
            </div>

            <Button 
              type="submit" 
              variant="sustainability" 
              size="lg" 
              className="w-full"
              disabled={isCreating}
            >
              {isCreating ? (
                "Creating Assessment..."
              ) : (
                <>
                  Create Assessment & Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}