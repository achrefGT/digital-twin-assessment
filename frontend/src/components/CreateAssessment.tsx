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
import { useQueryClient } from '@tanstack/react-query'
import { assessmentKeys } from '@/services/assessmentApi'

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
  
  // Add query client for auto-refresh
  const queryClient = useQueryClient()

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
      
      console.log('[CreateAssessment] Creating assessment with payload:', payload)
      
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
      console.log('[CreateAssessment] Backend response:', backendAssessment)
      
      // Create assessment object with backend response + additional data for form
      const assessment = {
        assessment_id: backendAssessment.assessment_id || backendAssessment.id,
        user_id: backendAssessment.user_id, // Use backend user_id
        system_name: data.systemName,
        domain: domain,
        description: data.description,
        organization: data.organization,
        created_at: backendAssessment.created_at,
        status: backendAssessment.status || 'IN_PROGRESS',
        metadata: backendAssessment.metadata || {
          assessment_type: domain || "full",
          version: "1.0"
        },
        progress: {
          completed_domains: backendAssessment.completed_domains || [],
          completion_percentage: backendAssessment.completion_percentage || 0,
          domain_scores: backendAssessment.domain_scores || {},
          domain_data: backendAssessment.domain_data || {},
          summary_statistics: backendAssessment.summary_statistics || {
            completed_domain_count: 0,
            average_score: 0,
            highest_score: 0,
            lowest_score: 0,
            score_distribution: {}
          }
        }
      }
      
      // Validate required IDs exist
      if (!assessment.assessment_id || !assessment.user_id) {
        throw new Error('Backend did not provide required IDs')
      }

      console.log('[CreateAssessment] Final assessment object:', assessment)

      // CRITICAL FIX: Store both keys that the system expects
      try {
        localStorage.setItem('currentAssessment', JSON.stringify(assessment))
        localStorage.setItem('lastAssessmentId', assessment.assessment_id)
        console.log('[CreateAssessment] ✅ Stored assessment in localStorage with both keys')
        console.log('[CreateAssessment] ✅ Verification - lastAssessmentId:', localStorage.getItem('lastAssessmentId'))
      } catch (storageError) {
        console.error('[CreateAssessment] ❌ Failed to store in localStorage:', storageError)
      }

      // CRITICAL: Invalidate all assessment-related queries for auto-refresh
      console.log('[CreateAssessment] Invalidating assessment queries for auto-refresh')
      queryClient.invalidateQueries({ queryKey: assessmentKeys.userAssessments() })
      queryClient.invalidateQueries({ queryKey: assessmentKeys.detail(assessment.assessment_id) })
      queryClient.invalidateQueries({ queryKey: assessmentKeys.domainScores(assessment.assessment_id) })
      
      // Also invalidate the general assessments query
      queryClient.invalidateQueries({ queryKey: ['assessments'] })

      // Call the callback to update parent component state
      onAssessmentCreated(assessment)
      
      toast({
        title: "Assessment Created Successfully",
        description: `Assessment "${data.systemName}" has been created and is ready for completion.`,
        duration: 5000
      })
      
    } catch (error) {
      console.error('[CreateAssessment] Error creating assessment:', error)

      toast({
        title: error.message.includes('log in') ? "Authentication Required" : "Assessment Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create assessment",
        variant: "destructive",
        duration: 7000
      })
      
      throw error // Don't create local assessment
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50/50">
        <CardHeader className="text-center pb-8">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-gradient-to-br from-eco-green to-eco-green/80 rounded-2xl shadow-lg">
              <FileText className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Create New Assessment
          </CardTitle>
          <CardDescription className="text-lg text-gray-600 mt-2 max-w-lg mx-auto">
            Set up your digital twin assessment to begin evaluating sustainability, performance, and resilience metrics
          </CardDescription>
          {domain && (
            <Badge className="bg-gradient-to-r from-eco-green to-eco-green/80 text-white mx-auto mt-4 px-4 py-1 text-sm font-semibold shadow-md">
              {domain.toUpperCase()} DOMAIN
            </Badge>
          )}
        </CardHeader>
        
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSubmit(createAssessment)} className="space-y-6">
            <div className="space-y-6">
              <div>
                <Label htmlFor="systemName" className="text-sm font-semibold text-gray-700">
                  Digital Twin System Name *
                </Label>
                <Input
                  {...register("systemName", { 
                    required: "System name is required",
                    minLength: { value: 3, message: "System name must be at least 3 characters" }
                  })}
                  placeholder="e.g., Manufacturing Digital Twin System"
                  className="mt-2 h-12 text-base border-gray-200 focus:border-eco-green focus:ring-eco-green/20"
                />
                {errors.systemName && (
                  <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-600"></span>
                    {errors.systemName.message as string}
                  </p>
                )}
              </div>
              
              <div>
                <Label htmlFor="description" className="text-sm font-semibold text-gray-700">
                  Description (Optional)
                </Label>
                <Input
                  {...register("description")}
                  placeholder="Brief description of your digital twin system"
                  className="mt-2 h-12 text-base border-gray-200 focus:border-eco-green focus:ring-eco-green/20"
                />
              </div>
              
              <div>
                <Label htmlFor="organization" className="text-sm font-semibold text-gray-700">
                  Organization (Optional)
                </Label>
                <Input
                  {...register("organization")}
                  placeholder="Your organization or company name"
                  className="mt-2 h-12 text-base border-gray-200 focus:border-eco-green focus:ring-eco-green/20"
                />
              </div>
            </div>

            <div className="bg-gradient-to-r from-eco-green/5 via-primary/5 to-eco-green/5 p-6 rounded-xl border border-eco-green/10 shadow-sm">
              <h4 className="font-bold mb-4 text-lg text-gray-800 flex items-center gap-2">
                Assessment Process Overview
              </h4>
              <ul className="text-sm space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-eco-green/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <span className="w-2 h-2 rounded-full bg-eco-green"></span>
                  </span>
                  <span>Create your assessment with a unique system identifier</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-eco-green/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <span className="w-2 h-2 rounded-full bg-eco-green"></span>
                  </span>
                  <span>Complete multi-step evaluations across different domains</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-eco-green/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <span className="w-2 h-2 rounded-full bg-eco-green"></span>
                  </span>
                  <span>Monitor real-time progress in the interactive dashboard</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-eco-green/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <span className="w-2 h-2 rounded-full bg-eco-green"></span>
                  </span>
                  <span>View comprehensive results and analytics upon completion</span>
                </li>
              </ul>
            </div>

            <Button 
              type="submit" 
              variant="sustainability" 
              size="lg" 
              className="w-full h-14 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]"
              disabled={isCreating}
            >
              {isCreating ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Creating Assessment...
                </div>
              ) : (
                <>
                  Create Assessment & Continue
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}