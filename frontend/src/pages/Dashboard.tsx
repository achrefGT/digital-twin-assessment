import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AssessmentDashboard } from '@/components/dashboard/AssessmentDashboard'
import { AssessmentsList } from '@/components/dashboard/AssessmentsList'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Plus, Activity, Sparkles, BarChart3, List, Eye, Bell } from 'lucide-react'
import { useAssessment } from '@/hooks/useAssessment'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useToast } from '@/hooks/use-toast'
import { Assessment } from '@/services/assessmentApi'
import { useLanguage } from '@/contexts/LanguageContext'

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { t } = useLanguage()
  const { 
    currentAssessment, 
    isLoading, 
    clearAssessment, 
    createAssessment,
    refreshAssessmentData,
    forceRefresh // ADDED: Import forceRefresh
  } = useAssessment()

  // WebSocket connection for real-time updates
  const { messages, connectionStatus } = useWebSocket(currentAssessment?.assessment_id || '')

  // Local state
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<Error | null>(null)
  const [showAssessmentsList, setShowAssessmentsList] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now())

  // Handle WebSocket messages for real-time updates
  useEffect(() => {
    if (!messages || messages.length === 0) return

    const latestMessage = messages[messages.length - 1]
    console.log('Dashboard: Received WebSocket message:', latestMessage.type)

    // Handle different message types that should trigger refresh
    switch (latestMessage.type) {
      case 'score_update':
      case 'assessment_completed':
        console.log('Dashboard: Score update received, refreshing data')
        refreshAssessmentData()
        forceRefresh() // ADDED: Force refresh all queries
        setLastRefreshTime(Date.now())
        
        toast({
          title: t('assessments.dataRefreshed'),
          description: latestMessage.domain 
            ? `${latestMessage.domain} ${t('common.updated')}` 
            : t('assessments.dataUpdated'),
          duration: 3000,
        })
        break
        
      case 'test_message':
        console.log('Dashboard: Test message received')
        forceRefresh() // ADDED: Force refresh on test message
        break
        
      default:
        console.log('Dashboard: Unhandled message type:', latestMessage.type)
    }
  }, [messages, refreshAssessmentData, forceRefresh, toast, t]) // ADDED forceRefresh to deps

  // Auto-refresh assessment data periodically (as backup to WebSocket)
  useEffect(() => {
    if (!currentAssessment?.assessment_id) return

    const interval = setInterval(async () => {
      // Only auto-refresh if we haven't had a recent WebSocket update
      const timeSinceLastRefresh = Date.now() - lastRefreshTime
      if (timeSinceLastRefresh > 60000) { // 1 minute
        try {
          await refreshAssessmentData()
          forceRefresh() // ADDED: Force refresh on auto-refresh
          console.log('Dashboard: Auto-refreshed assessment data (fallback)')
        } catch (error) {
          console.error('Dashboard: Auto-refresh failed:', error)
        }
      }
    }, 90000) // Check every 90 seconds

    return () => clearInterval(interval)
  }, [currentAssessment?.assessment_id, refreshAssessmentData, forceRefresh, lastRefreshTime]) // ADDED forceRefresh to deps

  // Handle URL state for assessment switching
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search)
    const switchToId = urlParams.get('switchTo')
    
    if (switchToId && currentAssessment?.assessment_id !== switchToId) {
      console.log('Dashboard: URL indicates switch to assessment:', switchToId)
    }
  }, [location.search, currentAssessment])

  // Handle create assessment - redirect to create page
  const handleCreateAssessment = async () => {
    try {
      setIsCreating(true)
      setCreateError(null)
      
      clearAssessment()
      forceRefresh() // ADDED: Force refresh after clearing
      navigate('/assessment')
      
    } catch (error) {
      console.error('Failed to navigate to create assessment:', error)
      setCreateError(error instanceof Error ? error : new Error('Failed to navigate to create assessment'))
    } finally {
      setIsCreating(false)
    }
  }

  // Handle assessment selection from list
  const handleSelectAssessment = async (assessment: Assessment) => {
    try {
      setIsSwitching(true)
      
      if (currentAssessment?.assessment_id === assessment.assessment_id) {
        setShowAssessmentsList(false)
        return
      }

      toast({
        title: t('assessments.switchingAssessment'),
        description: `${t('assessments.loadingAssessment')} ${assessment.assessment_id.slice(0, 8)}...`,
        duration: 2000,
      })

      await refreshAssessmentData(assessment.assessment_id)
      forceRefresh() // ADDED: Force refresh after switching
      
      toast({
        title: t('assessments.assessmentSwitched'),
        description: `${t('assessments.nowViewing')} ${assessment.assessment_id.slice(0, 8)}`,
        duration: 4000,
      })

      setShowAssessmentsList(false)

      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('switchTo')
      window.history.replaceState({}, '', newUrl.toString())
      
    } catch (error) {
      console.error('Failed to switch assessment:', error)
      toast({
        title: t('assessments.switchFailed'),
        description: error instanceof Error ? error.message : t('assessments.couldNotSwitch'),
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsSwitching(false)
    }
  }

  // Handle manual refresh
  const handleManualRefresh = async () => {
    if (!currentAssessment?.assessment_id) return
    
    try {
      await refreshAssessmentData()
      forceRefresh() // ADDED: Force refresh on manual refresh
      toast({
        title: t('assessments.dataRefreshed'),
        description: t('assessments.dataUpdated'),
        duration: 2000,
      })
    } catch (error) {
      toast({
        title: t('assessments.refreshFailed'), 
        description: t('assessments.couldNotRefresh'),
        variant: "destructive",
        duration: 3000,
      })
    }
  }

  // Show loading state
  if (isLoading && !currentAssessment) {
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

  // Show assessments list view
  if (showAssessmentsList || !currentAssessment) {
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
                    <List className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-l font-bold text-gray-900">{t('assessments.title')}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentAssessment && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAssessmentsList(false)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {t('dashboard.detailedView')}
                  </Button>
                )}
                <Button
                  variant="default" 
                  size="sm"
                  onClick={handleCreateAssessment}
                  disabled={isCreating}
                  className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isCreating ? t('createAssessment.creating') : t('dashboard.newAssessment')}
                </Button>
              </div>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-6 py-8">
          {createError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">
                {createError.message || t('notification.error.createFailed')}
              </p>
            </div>
          )}

          <AssessmentsList 
            onSelectAssessment={handleSelectAssessment}
            currentAssessmentId={currentAssessment?.assessment_id}
          />
        </div>
      </div>
    )
  }

  // Show main dashboard with current assessment
  return (
    <div className="min-h-screen bg-white">
      {/* Modern Header with assessment info and actions */}
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
                <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-l font-bold text-gray-900">{t('dashboard.title')}</span>
                  <span className="text-xs text-gray-500">
                    {t('assessment.create')}: {currentAssessment.assessment_id.slice(0, 8)}...
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Switch/Browse Assessments Button */}
              <Button
                variant="outline" 
                size="sm"
                onClick={() => setShowAssessmentsList(true)}
                disabled={isSwitching}
                className="flex items-center gap-2"
              >
                <List className="w-4 h-4" />
                {isSwitching ? t('dashboard.switching') : t('assessments.selectAssessment')}
              </Button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Dashboard Content */}
      <AssessmentDashboard 
        assessmentId={currentAssessment.assessment_id} 
        key={currentAssessment.assessment_id}
      />
    </div>
  )
}