import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { ArrowLeft, BarChart3, List, Plus, RefreshCw } from 'lucide-react'
import { AssessmentDashboard } from '@/components/dashboard/AssessmentDashboard'
import { useAssessment } from '@/hooks/useAssessment'
import { useAuth } from '@/auth'
import { assessmentKeys } from '@/services/assessmentApi'
import { useLanguage } from '@/contexts/LanguageContext'

// Types matching the backend response
interface DomainScoresResponse {
  assessment_id: string
  overall_assessment: {
    status: string
    completion_percentage: number
    completed_domains: string[]
    pending_domains: string[]
    overall_score?: number
    created_at: string
    updated_at: string
    completed_at?: string
  }
  domain_results: Record<string, any>
  summary_statistics?: {
    completed_domain_count: number
    average_score: number
    highest_score: number
    lowest_score: number
    score_distribution: Record<string, number>
  }
}

export default function AssessmentDashboardPage() {
  const navigate = useNavigate()
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const { currentAssessment, isLoading: assessmentLoading, clearAssessment, switchToAssessment } = useAssessment()
  const { token, isAuthenticated } = useAuth()
  const { t } = useLanguage()
  
  const [isSwitching, setIsSwitching] = useState(false)

  // Fetch domain scores for the specific assessment ID
  const { 
    data: domainScoresData, 
    isLoading: domainScoresLoading, 
    error: domainScoresError,
    refetch: refetchDomainScores 
  } = useQuery({
    queryKey: assessmentKeys.domainScores(assessmentId!),
    queryFn: async (): Promise<DomainScoresResponse> => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      
      if (isAuthenticated && token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`http://localhost:8000/assessments/${assessmentId}/domain-scores/`, {
        headers
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch assessment: ${response.status}`)
      }
      
      return response.json()
    },
    enabled: !!assessmentId && !!token,
    retry: 2,
    staleTime: 30000,
    refetchOnWindowFocus: true
  })

  // Handle making this assessment active
  const handleMakeActive = async () => {
    if (!domainScoresData || !assessmentId) return
    
    try {
      setIsSwitching(true)
      
      // Create assessment object from the fetched data
      const assessmentToSwitch = {
        assessment_id: assessmentId,
        status: domainScoresData.overall_assessment.status,
        created_at: domainScoresData.overall_assessment.created_at,
        updated_at: domainScoresData.overall_assessment.updated_at,
        completed_at: domainScoresData.overall_assessment.completed_at,
        progress: {
          completed_domains: domainScoresData.overall_assessment.completed_domains,
          completion_percentage: domainScoresData.overall_assessment.completion_percentage,
          domain_scores: extractDomainScores(domainScoresData.domain_results),
          overall_score: domainScoresData.overall_assessment.overall_score,
          domain_data: extractDomainData(domainScoresData.domain_results),
          summary_statistics: domainScoresData.summary_statistics
        }
      }
      
      await switchToAssessment(assessmentToSwitch)
      
      console.log('Assessment switched successfully')
    } catch (error) {
      console.error('Failed to switch assessment:', error)
    } finally {
      setIsSwitching(false)
    }
  }

  // Helper functions to extract data
  const extractDomainScores = (domainResults: Record<string, any>): Record<string, number> => {
    const scores: Record<string, number> = {}
    Object.entries(domainResults).forEach(([domain, result]) => {
      if (result.overall_score !== undefined) {
        scores[domain] = result.overall_score
      }
    })
    return scores
  }

  const extractDomainData = (domainResults: Record<string, any>): Record<string, any> => {
    const data: Record<string, any> = {}
    Object.entries(domainResults).forEach(([domain, result]) => {
      data[domain] = {
        scores: result.detailed_scores || {},
        score_value: result.overall_score,
        submitted_at: result.submitted_at,
        processed_at: result.processed_at,
        insights: result.insights || []
      }
    })
    return data
  }

  // Loading state
  const isLoading = assessmentLoading || domainScoresLoading
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('dashboard.loadingDashboard')}</h3>
          <p className="text-gray-600">{t('dashboard.fetchingData')}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (domainScoresError || !domainScoresData) {
    return (
      <div className="min-h-screen bg-white">
        {/* Navigation Header */}
        <nav className="border-b border-gray-200 bg-white/95 backdrop-blur-sm">
          <div className="container mx-auto px-6">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/assessments')}
                  className="-ml-2 p-2 hover:translate-x-[-4px] transition-transform duration-200 hover:bg-white"
                >
                  <ArrowLeft className="w-5 h-5 text-black" />
                </Button>
                <div className="h-6 w-px bg-gray-300" />
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-orange-600 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-bold text-gray-900">{t('dashboard.title')}</span>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-gray-50" />
          <div className="relative container mx-auto px-6 py-16">
            <div className="max-w-2xl mx-auto text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-6">
                {t('dashboard.assessmentNotFound')}
              </h1>
              <p className="text-xl text-gray-600 mb-12 leading-relaxed">
                {assessmentId 
                  ? `${t('assessment.create')} ${assessmentId.slice(0, 8)} ${t('dashboard.couldNotLoad')}`
                  : t('dashboard.noAssessmentSelected')
                }
              </p>
              
              <div className="flex justify-center gap-4">
                <Button 
                  onClick={() => refetchDomainScores()}
                  variant="outline"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('dashboard.tryAgain')}
                </Button>
                <Button 
                  onClick={() => navigate('/assessments')}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <List className="w-4 h-4 mr-2" />
                  {t('dashboard.viewAllAssessments')}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    clearAssessment()
                    navigate('/assessment')
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('dashboard.createNewAssessment')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isCurrentAssessment = currentAssessment?.assessment_id === assessmentId

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header */}
      <nav className="border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/assessments')}
                className="-ml-2 p-2 hover:translate-x-[-4px] transition-transform duration-200 hover:bg-white"
              >
                <ArrowLeft className="w-5 h-5 text-black" />
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-bold text-gray-900">{t('dashboard.title')}</span>
                  <span className="text-xs text-gray-500">
                    {t('assessment.create')}: {assessmentId?.slice(0, 8)}...
                    {isCurrentAssessment && <span className="ml-2 text-blue-600 font-medium">({t('dashboard.active')})</span>}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {!isCurrentAssessment && (
                <Button
                  variant="outline" 
                  size="sm"
                  onClick={handleMakeActive}
                  disabled={isSwitching}
                >
                  {isSwitching ? t('dashboard.switching') : t('dashboard.makeActive')}
                </Button>
              )}
              <Button
                variant="outline" 
                size="sm"
                onClick={() => navigate('/assessments')}
              >
                <List className="w-4 h-4 mr-2" />
                {t('assessments.allAssessments')}
              </Button>
              <Button
                variant="outline" 
                size="sm"
                onClick={() => {
                  clearAssessment()
                  navigate('/assessment')
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('dashboard.newAssessment')}
              </Button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Dashboard Content - Pass the assessmentId directly to AssessmentDashboard */}
      <AssessmentDashboard assessmentId={assessmentId!} />
    </div>
  )
}