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

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { 
    currentAssessment, 
    isLoading, 
    clearAssessment, 
    createAssessment,
    refreshAssessmentData
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
        setLastRefreshTime(Date.now())
        
        toast({
          title: "Assessment Updated",
          description: latestMessage.domain 
            ? `${latestMessage.domain} domain updated` 
            : "Assessment data updated",
          duration: 3000,
        })
        break
        
      case 'test_message':
        console.log('Dashboard: Test message received')
        break
        
      default:
        console.log('Dashboard: Unhandled message type:', latestMessage.type)
    }
  }, [messages, refreshAssessmentData, toast])

  // Auto-refresh assessment data periodically (as backup to WebSocket)
  useEffect(() => {
    if (!currentAssessment?.assessment_id) return

    const interval = setInterval(async () => {
      // Only auto-refresh if we haven't had a recent WebSocket update
      const timeSinceLastRefresh = Date.now() - lastRefreshTime
      if (timeSinceLastRefresh > 60000) { // 1 minute
        try {
          await refreshAssessmentData()
          console.log('Dashboard: Auto-refreshed assessment data (fallback)')
        } catch (error) {
          console.error('Dashboard: Auto-refresh failed:', error)
        }
      }
    }, 90000) // Check every 90 seconds

    return () => clearInterval(interval)
  }, [currentAssessment?.assessment_id, refreshAssessmentData, lastRefreshTime])

  // Handle URL state for assessment switching
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search)
    const switchToId = urlParams.get('switchTo')
    
    if (switchToId && currentAssessment?.assessment_id !== switchToId) {
      // This will be handled by the parent component or routing logic
      console.log('Dashboard: URL indicates switch to assessment:', switchToId)
    }
  }, [location.search, currentAssessment])

  // Handle create assessment - redirect to create page
  const handleCreateAssessment = async () => {
    try {
      setIsCreating(true)
      setCreateError(null)
      
      // Clear current assessment and redirect to create page
      clearAssessment()
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
      
      // If it's the same assessment, just close the list
      if (currentAssessment?.assessment_id === assessment.assessment_id) {
        setShowAssessmentsList(false)
        return
      }

      // Show immediate feedback
      toast({
        title: "Switching Assessment",
        description: `Loading assessment ${assessment.assessment_id.slice(0, 8)}...`,
        duration: 2000,
      })

      // The actual switching logic should be handled by the useAssessment hook
      // For now, we'll refresh the data and show success
      await refreshAssessmentData(assessment.assessment_id)
      
      toast({
        title: "Assessment Switched",
        description: `Now viewing assessment ${assessment.assessment_id.slice(0, 8)}`,
        duration: 4000,
      })

      // Hide the assessments list
      setShowAssessmentsList(false)

      // Update URL without page reload
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('switchTo')
      window.history.replaceState({}, '', newUrl.toString())
      
    } catch (error) {
      console.error('Failed to switch assessment:', error)
      toast({
        title: "Switch Failed",
        description: error instanceof Error ? error.message : "Could not switch to selected assessment",
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
      toast({
        title: "Data Refreshed",
        description: "Assessment data has been updated",
        duration: 2000,
      })
    } catch (error) {
      toast({
        title: "Refresh Failed", 
        description: "Could not refresh assessment data",
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
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading Dashboard</h3>
          <p className="text-gray-600">Fetching your assessment data...</p>
        </div>
      </div>
    )
  }

  // Show assessments list view. Also render the list when there is no current assessment
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
                  <span className="text-l font-bold text-gray-900">Assessments List</span>
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
                    View Current Dashboard
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
                  {isCreating ? 'Creating...' : 'New Assessment'}
                </Button>
              </div>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-6 py-8">
          {createError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">
                {createError.message || 'Failed to create assessment'}
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
                  <span className="text-l font-bold text-gray-900">Dashboard</span>
                  <span className="text-xs text-gray-500">
                    Assessment: {currentAssessment.assessment_id.slice(0, 8)}...
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
                {isSwitching ? 'Switching...' : 'Switch Assessment'}
              </Button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Dashboard Content */}
      <AssessmentDashboard 
        assessmentId={currentAssessment.assessment_id} 
        key={currentAssessment.assessment_id} // Force re-render on assessment change
      />
    </div>
  )
}
