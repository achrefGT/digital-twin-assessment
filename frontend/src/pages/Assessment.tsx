import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/enhanced-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Download, Eye, FileJson, FileText, CheckCircle, Activity, Sparkles, Brain, Users, Shield } from "lucide-react"
import { CreateAssessment } from "@/components/CreateAssessment"
import { PaginatedForm } from "@/components/PaginatedForm"
import { getSLCASteps } from "@/components/forms/SLCAFormSteps"
import { getLCCSteps } from "@/components/forms/LCCFormSteps"
import { getELCASteps } from "@/components/forms/ELCAFormSteps"
import UnifiedDomainSelector from "@/components/UnifiedDomainSelector"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

const domainInfo = {
  slca: { 
    title: "Social Life Cycle Assessment", 
    gradient: "from-blue-500 to-cyan-600", 
    bgColor: "bg-blue-50", 
    borderColor: "border-blue-200",
    icon: "👥",
    description: "social"
  },
  lcc: { 
    title: "Life Cycle Costing", 
    gradient: "from-purple-500 to-violet-600", 
    bgColor: "bg-purple-50", 
    borderColor: "border-purple-200",
    icon: "💰",
    description: "economic"
  },
  elca: { 
    title: "Environmental Life Cycle Assessment", 
    gradient: "from-green-500 to-emerald-600", 
    bgColor: "bg-green-50", 
    borderColor: "border-green-200",
    icon: "🌱",
    description: "environmental"
  },
  human_centricity: { 
    title: "Human Centricity Assessment", 
    gradient: "from-violet-500 to-purple-600", 
    bgColor: "bg-violet-50", 
    borderColor: "border-violet-200",
    icon: Brain,
    description: "human-centric"
  },
  sustainability: { 
    title: "Sustainability Assessment", 
    gradient: "from-emerald-500 to-green-600", 
    bgColor: "bg-emerald-50", 
    borderColor: "border-emerald-200",
    icon: Sparkles,
    description: "sustainability"
  },
  resilience: { 
    title: "Resilience Assessment", 
    gradient: "from-blue-500 to-indigo-600", 
    bgColor: "bg-blue-50", 
    borderColor: "border-blue-200",
    icon: Shield,
    description: "resilience"
  }
}

const Assessment = () => {
  const { domain } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  
  // Get assessment from localStorage to persist across domain switches
  const [assessment, setAssessment] = useState<any>(() => {
    const stored = localStorage.getItem('currentAssessment')
    return stored ? JSON.parse(stored) : null
  })
  const [formData, setFormData] = useState<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  const info = domain ? domainInfo[domain as keyof typeof domainInfo] : null

  // If no domain is specified, show assessment creation
  if (!domain) {
    return (
      <div className="min-h-screen bg-white">
        {/* Navigation Header */}
        <nav className="border-b border-gray-200 bg-white/95 backdrop-blur-sm">
          <div className="container mx-auto px-6">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/')}
                  className="-ml-2 p-2 hover:translate-x-[-4px] transition-transform duration-200 hover:bg-white"
                >
                  <ArrowLeft className="w-5 h-5 text-black" />
                </Button>
                <div className="h-6 w-px bg-gray-300" />
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-bold text-gray-900">Create Assessment</span>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-gray-50" />
          <div className="relative container mx-auto px-6 py-16">
            {!assessment ? (
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    Assessment Setup
                  </div>
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">Create New Assessment</h1>
                  <p className="text-lg text-gray-600 leading-relaxed">
                    Initialize your digital twin assessment with basic system information
                  </p>
                </div>
                <CreateAssessment 
                  onAssessmentCreated={(newAssessment) => {
                    setAssessment(newAssessment)
                    localStorage.setItem('currentAssessment', JSON.stringify(newAssessment))
                    navigate('/')
                  }}
                />
              </div>
            ) : (
              <div className="max-w-2xl mx-auto text-center">
                <Card className="border-2 border-green-200 bg-green-50">
                  <CardContent className="p-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Assessment Already Created</h2>
                    <p className="text-gray-600 mb-2">Assessment ID:</p>
                    <p className="font-mono text-sm bg-white px-3 py-2 rounded-lg border border-gray-200 mb-8">
                      {assessment.assessment_id}
                    </p>
                    <div className="space-y-4">
                      <Button 
                        size="lg"
                        onClick={() => navigate('/')}
                        className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white"
                      >
                        Continue to Domain Selection
                      </Button>
                      <Button 
                        variant="outline" 
                        size="lg"
                        className="w-full border-2 border-gray-200 hover:border-gray-300"
                        onClick={() => {
                          localStorage.removeItem('currentAssessment')
                          setAssessment(null)
                        }}
                      >
                        Create New Assessment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="max-w-md mx-auto border-2 border-red-200 bg-red-50">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Invalid Assessment Domain</h2>
            <p className="text-gray-600 mb-6">The requested assessment domain could not be found.</p>
            <Button 
              onClick={() => navigate('/')}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white"
            >
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // If no assessment exists, redirect to create one first
  if (!assessment) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Card className="max-w-md mx-auto border-2 border-yellow-200 bg-yellow-50">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No Assessment Found</h2>
            <p className="text-gray-600 mb-6">
              You need to create an assessment before completing domain-specific forms.
            </p>
            <Button 
              onClick={() => navigate('/assessment')}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white"
            >
              Create Assessment
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleAssessmentCreated = (newAssessment: any) => {
    setAssessment(newAssessment)
    localStorage.setItem('currentAssessment', JSON.stringify(newAssessment))
  }

  const handleFormSubmit = async (data: any) => {
    setIsSubmitting(true)
    
    // Get browser and device information
    const userAgent = navigator.userAgent
    const getBrowserName = (userAgent: string) => {
      if (userAgent.includes('Chrome')) return 'Chrome'
      if (userAgent.includes('Firefox')) return 'Firefox'
      if (userAgent.includes('Safari')) return 'Safari'
      if (userAgent.includes('Edge')) return 'Edge'
      return 'Unknown'
    }
    
    const getDeviceType = (userAgent: string) => {
      if (/Mobile|Android|iPhone|iPad/.test(userAgent)) return 'mobile'
      if (/Tablet|iPad/.test(userAgent)) return 'tablet'
      return 'desktop'
    }

    const assessmentData = {
      assessment_id: assessment.assessment_id,
      user_id: assessment.user_id,
      system_name: assessment.system_name,
      domain: domain,
      form_data: data,
      metadata: {
        ...assessment.metadata,
        session_duration_minutes: 30,
        user_experience_level: "advanced",
        system_version: "v2.1.3",
        browser: getBrowserName(userAgent),
        device_type: getDeviceType(userAgent),
        submission_timestamp: new Date().toISOString(),
        assessment_methodology: `comprehensive_${domain}_assessment`,
        domain: domain
      }
    }

    console.log('=== Assessment Form Submission Debug ===')
    console.log('Domain:', domain)
    console.log('Assessment ID:', assessment.assessment_id)
    console.log('Payload:', assessmentData)
    
    try {
      console.log('Submitting to backend:', `http://localhost:8000/assessments/${assessment.assessment_id}/submit`)
      
      // Submit to backend (same endpoint as ELCAForm)
      const response = await fetch(`http://localhost:8000/assessments/${assessment.assessment_id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assessmentData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log('Backend response:', result)
      
      // Update local state with backend response
      setFormData(result)
      setIsCompleted(true)
      
      toast({
        title: "Assessment Submitted Successfully", 
        description: `Your ${domain?.toUpperCase()} assessment has been processed. You can now view the results in the dashboard.`
      })
      
    } catch (error) {
      console.error('Backend submission failed:', error)
      
      // Fallback: keep local data
      setFormData(assessmentData)
      setIsCompleted(true)
      
      toast({
        title: "Assessment Saved Locally",
        description: error instanceof Error ? 
          `Backend unavailable: ${error.message}. Assessment data saved locally.` : 
          "Backend unavailable. Assessment data saved locally.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getFormSteps = () => {
    switch (domain) {
      case 'slca':
        return getSLCASteps()
      case 'lcc':
        return getLCCSteps()
      case 'elca':
        return getELCASteps()
      default:
        return []
    }
  }

  // Check if this is a unified domain selector assessment type
  const isUnifiedDomain = ['human_centricity', 'sustainability', 'resilience'].includes(domain as string)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50">
      {/* Navigation Header */}
      <nav className="border-b border-gray-200 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/')}
                className="-ml-2 p-2 hover:translate-x-[-4px] transition-transform duration-200 hover:bg-white"
              >
                <ArrowLeft className="w-5 h-5 text-black" />
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-3">
                <span className="text-2xl"><info.icon /></span>
                <span className="text-lg font-semibold text-gray-900">{info.title}</span>
              </div>
            </div>
            <Badge className={`${info.bgColor} ${info.borderColor} border text-gray-700 font-medium px-3 py-1`}>
              {domain?.toUpperCase()}
            </Badge>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-8">
        {isSubmitting ? (
          <div className="max-w-2xl mx-auto">
            <Card className="border-2 border-blue-200 shadow-xl bg-white">
              <CardContent className="text-center py-16">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-8 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">Processing Assessment</h3>
                <p className="text-gray-600 text-lg">Submitting your assessment data to the backend system...</p>
                <div className="mt-8">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{width: '75%'}}></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-3">Almost done...</p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : isUnifiedDomain ? (
          // Use UnifiedDomainSelector for the three assessment types
          <UnifiedDomainSelector
            assessmentType={domain as 'sustainability' | 'resilience' | 'human_centricity'}
            assessmentInfo={assessment}
            onComplete={(finalSubmission: any) => {
              // Handle the submission from UnifiedDomainSelector
              const payload = finalSubmission?.form_data ?? finalSubmission
              handleFormSubmit(payload)
            }}
          />
        ) : (
          // Use PaginatedForm for traditional assessment types (SLCA, LCC, ELCA)
          <div className="max-w-4xl mx-auto">
            <Card className={`border-2 ${info.borderColor} shadow-xl bg-white`}>
              <CardHeader className={`bg-gradient-to-r ${info.bgColor} border-b border-gray-200`}>
                <CardTitle className="flex items-center gap-4 text-2xl text-gray-900">
                  <div className={`p-4 rounded-xl bg-gradient-to-br ${info.gradient} shadow-lg`}>
                    <span className="text-2xl"><info.icon /></span>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{info.title}</div>
                    <div className="text-sm font-normal text-gray-600 mt-1">
                      Complete this comprehensive assessment
                    </div>
                  </div>
                </CardTitle>
                <CardDescription className="text-base mt-4">
                  Evaluate your digital twin system across {info.description} parameters with detailed analysis and recommendations.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <PaginatedForm
                  steps={getFormSteps()}
                  onComplete={handleFormSubmit}
                  assessmentInfo={assessment}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Success State - Show Results if Available */}
        {isCompleted && (
          <div className="max-w-4xl mx-auto mt-8">
            <Card className="border-2 border-green-200 shadow-2xl bg-white overflow-hidden">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold mb-2">Assessment Completed!</h2>
                    <p className="text-green-100 text-lg">
                      Your {info.title.toLowerCase()} has been successfully processed
                    </p>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-8">
                <div className="space-y-6">
                  {/* Assessment Summary */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                          <span className="text-xl"><info.icon /></span>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-lg">{info.title}</p>
                          <p className="text-sm text-gray-600 font-mono bg-white px-3 py-1 rounded-lg border border-gray-200 mt-2">
                            ID: {assessment.assessment_id}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={`${info.bgColor} ${info.borderColor} border text-gray-700 font-semibold text-sm px-4 py-2`}>
                          {domain?.toUpperCase()}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date().toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      onClick={() => navigate('/dashboard')}
                      size="lg"
                      className="flex items-center justify-center gap-3 h-16 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
                    >
                      <Activity className="w-6 h-6" />
                      <div className="text-left">
                        <div className="font-bold">View Dashboard</div>
                        <div className="text-xs opacity-90">Analyze results</div>
                      </div>
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => navigate('/')}
                      size="lg"
                      className="flex items-center justify-center gap-3 h-16 border-2 border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl transition-all duration-300 transform hover:scale-[1.02]"
                    >
                      <ArrowLeft className="w-6 h-6" />
                      <div className="text-left">
                        <div className="font-bold">Back to Domains</div>
                        <div className="text-xs opacity-70">Start new assessment</div>
                      </div>
                    </Button>
                  </div>

                  {/* Additional Actions */}
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-center text-sm text-gray-500 mb-4">
                      Next steps: Review your results in the dashboard or start a new assessment for comprehensive analysis
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

export default Assessment