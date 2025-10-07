import { useState, useEffect, useCallback } from 'react'
import { useAuth } from "@/auth"
import { useQueryClient } from '@tanstack/react-query'
import { assessmentKeys } from '@/services/assessmentApi'

interface AssessmentProgress {
  completed_domains: string[]
  completion_percentage: number
  domain_scores?: Record<string, number>
  overall_score?: number
  domain_data?: Record<string, any>
  summary_statistics?: {
    completed_domain_count: number
    average_score: number
    highest_score: number
    lowest_score: number
    score_distribution: Record<string, number>
  }
  status?: string
}

interface Assessment {
  assessment_id: string
  status: string
  created_at: string
  updated_at?: string
  user_id?: string
  progress?: AssessmentProgress
  [key: string]: any
}

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

const STORAGE_KEYS = {
  CURRENT_ASSESSMENT: 'currentAssessment',
  LAST_ASSESSMENT_ID: 'lastAssessmentId',
  ASSESSMENT_PROGRESS: 'assessmentProgress',
  DOMAIN_DATA: 'domainData'
}

// Enhanced debug logging function
const debugLog = (message: string, data?: any, progressData?: Partial<AssessmentProgress>) => {
  console.log(`[DEBUG useAssessment] ${message}`, data || '')
}

// Calculate summary statistics from domain scores
const calculateSummaryStatistics = (domainScores: Record<string, number>): AssessmentProgress['summary_statistics'] => {
  const scores = Object.values(domainScores).filter(score => 
    typeof score === 'number' && !isNaN(score) && score >= 0
  )

  if (scores.length === 0) {
    return {
      completed_domain_count: 0,
      average_score: 0,
      highest_score: 0,
      lowest_score: 0,
      score_distribution: {}
    }
  }

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
  const highest = Math.max(...scores)
  const lowest = Math.min(...scores)

  // Create score distribution
  const distribution: Record<string, number> = {
    'Excellent (90-100)': 0,
    'Good (80-89)': 0,
    'Average (70-79)': 0,
    'Below Average (60-69)': 0,
    'Poor (<60)': 0
  }

  scores.forEach(score => {
    if (score >= 90) distribution['Excellent (90-100)']++
    else if (score >= 80) distribution['Good (80-89)']++
    else if (score >= 70) distribution['Average (70-79)']++
    else if (score >= 60) distribution['Below Average (60-69)']++
    else distribution['Poor (<60)']++
  })

  return {
    completed_domain_count: scores.length,
    average_score: Math.round(average * 10) / 10,
    highest_score: Math.round(highest * 10) / 10,
    lowest_score: Math.round(lowest * 10) / 10,
    score_distribution: distribution
  }
}

// Enhanced persistence with better error handling and validation
const persistAssessmentData = (assessment: Assessment, additionalData?: Partial<AssessmentProgress>) => {
  try {
    // Validate assessment has required fields
    if (!assessment.assessment_id) {
      debugLog('Cannot persist assessment without assessment_id', assessment)
      return false
    }

    debugLog('Attempting to persist assessment data', {
      assessment_id: assessment.assessment_id,
      status: assessment.status,
      hasProgress: !!assessment.progress
    })

    // Ensure we have proper summary statistics
    if (assessment.progress?.domain_scores) {
      const calculatedStats = calculateSummaryStatistics(assessment.progress.domain_scores)
      assessment.progress.summary_statistics = {
        ...calculatedStats,
        ...assessment.progress.summary_statistics // Preserve any existing stats
      }
    }

    // Store the main assessment
    localStorage.setItem(STORAGE_KEYS.CURRENT_ASSESSMENT, JSON.stringify(assessment))
    debugLog('Stored current assessment in localStorage')
    
    // Store assessment ID for WebSocket reconnection - CRITICAL step
    localStorage.setItem(STORAGE_KEYS.LAST_ASSESSMENT_ID, assessment.assessment_id)
    debugLog('Stored lastAssessmentId in localStorage', assessment.assessment_id)
    
    // Update window global for immediate access
    ;(window as any).__currentAssessmentId__ = assessment.assessment_id
    debugLog('Updated window.__currentAssessmentId__', assessment.assessment_id)
    
    // Verify the storage actually worked
    const storedId = localStorage.getItem(STORAGE_KEYS.LAST_ASSESSMENT_ID)
    if (storedId !== assessment.assessment_id) {
      debugLog('Failed to verify stored assessment ID', { expected: assessment.assessment_id, actual: storedId })
      return false
    }
    
    // Store any additional progress data
    if (additionalData) {
      const existingProgress = getStoredProgress(assessment.assessment_id)
      const updatedProgress = { ...existingProgress, ...additionalData }
      
      // Calculate stats for additional data if it has domain scores
      if (updatedProgress.domain_scores) {
        updatedProgress.summary_statistics = {
          ...calculateSummaryStatistics(updatedProgress.domain_scores),
          ...updatedProgress.summary_statistics
        }
      }
      
      localStorage.setItem(
        `${STORAGE_KEYS.ASSESSMENT_PROGRESS}_${assessment.assessment_id}`, 
        JSON.stringify(updatedProgress)
      )
      debugLog('Stored additional progress data with calculated statistics')
    }
    
    debugLog('Successfully persisted all assessment data')
    return true
  } catch (error) {
    debugLog('Failed to persist assessment data', error)
    return false
  }
}

const loadStoredAssessment = (): Assessment | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_ASSESSMENT)
    if (!stored) {
      debugLog('No stored assessment found in localStorage')
      return null
    }
    
    const assessment = JSON.parse(stored)
    debugLog('Loaded assessment from storage', {
      assessment_id: assessment.assessment_id,
      status: assessment.status
    })
    
    // Validate the loaded assessment
    if (!assessment.assessment_id) {
      debugLog('Loaded assessment missing assessment_id, clearing corrupted data')
      localStorage.removeItem(STORAGE_KEYS.CURRENT_ASSESSMENT)
      return null
    }
    
    // Load additional progress data if available
    const progress = getStoredProgress(assessment.assessment_id)
    if (progress && Object.keys(progress).length > 0) {
      assessment.progress = { ...assessment.progress, ...progress }
      debugLog('Loaded progress data', progress)
    }
    
    // Ensure we have proper summary statistics
    if (assessment.progress?.domain_scores && !assessment.progress?.summary_statistics) {
      assessment.progress.summary_statistics = calculateSummaryStatistics(assessment.progress.domain_scores)
      debugLog('Calculated missing summary statistics on load')
    }
    
    // Restore window global
    ;(window as any).__currentAssessmentId__ = assessment.assessment_id
    
    return assessment
  } catch (error) {
    debugLog('Failed to load assessment from storage', error)
    // Clear corrupted data
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ASSESSMENT)
    return null
  }
}

const getStoredProgress = (assessmentId: string): Partial<AssessmentProgress> => {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEYS.ASSESSMENT_PROGRESS}_${assessmentId}`)
    const progress = stored ? JSON.parse(stored) : {}
    
    // Ensure we calculate statistics if we have domain scores but no statistics
    if (progress.domain_scores && !progress.summary_statistics) {
      progress.summary_statistics = calculateSummaryStatistics(progress.domain_scores)
    }
    
    return progress
  } catch (error) {
    debugLog('Failed to load progress data', error)
    return {}
  }
}

const clearAssessmentData = (assessmentId?: string) => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ASSESSMENT)
    localStorage.removeItem(STORAGE_KEYS.LAST_ASSESSMENT_ID)
    ;(window as any).__currentAssessmentId__ = null
    
    if (assessmentId) {
      localStorage.removeItem(`${STORAGE_KEYS.ASSESSMENT_PROGRESS}_${assessmentId}`)
      localStorage.removeItem(`${STORAGE_KEYS.DOMAIN_DATA}_${assessmentId}`)
    }
    
    debugLog('Cleared assessment data for:', assessmentId || 'current')
  } catch (error) {
    debugLog('Failed to clear assessment data', error)
  }
}

export const useAssessment = () => {
  const [currentAssessment, setCurrentAssessment] = useState<Assessment | null>(null)
  const [assessmentSnapshot, setAssessmentSnapshot] = useState<Assessment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { token, isAuthenticated, user } = useAuth()
  const queryClient = useQueryClient()

  // Function to invalidate assessment-related queries (for auto-refresh)
  const invalidateAssessmentQueries = useCallback(() => {
    debugLog('Invalidating assessment queries for auto-refresh')
    queryClient.invalidateQueries({ queryKey: assessmentKeys.userAssessments() })
    queryClient.invalidateQueries({ queryKey: ['assessments'] })
    
    if (currentAssessment) {
      queryClient.invalidateQueries({ queryKey: assessmentKeys.detail(currentAssessment.assessment_id) })
      queryClient.invalidateQueries({ queryKey: assessmentKeys.domainScores(currentAssessment.assessment_id) })
    }
  }, [queryClient, currentAssessment])

  // Function to fetch domain scores with authentication
  const fetchDomainScores = useCallback(async (assessmentId: string): Promise<DomainScoresResponse | null> => {
    try {
      debugLog('Fetching domain scores for assessment:', assessmentId)
      
      // Include authentication headers
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
        if (response.status === 404) {
          debugLog('Assessment not found in backend')
          return null
        }
        if (response.status === 401) {
          debugLog('Authentication required for domain scores')
          return null
        }
        throw new Error(`Failed to fetch domain scores: ${response.status}`)
      }
      
      const domainScores = await response.json()
      debugLog('Fetched domain scores:', domainScores)
      return domainScores
    } catch (error) {
      debugLog('Error fetching domain scores', error)
      return null
    }
  }, [token, isAuthenticated])

  // Convert domain scores response to assessment format
  const convertDomainScoresToAssessment = useCallback((
    assessmentId: string, 
    domainScores: DomainScoresResponse
  ): Assessment => {
    // Extract domain scores from domain_results
    const extractedDomainScores: Record<string, number> = {}
    const domainData: Record<string, any> = {}
    
    Object.entries(domainScores.domain_results).forEach(([domain, result]) => {
      if (result.overall_score !== undefined) {
        extractedDomainScores[domain] = result.overall_score
      }
      
      // CRITICAL: Store ALL domain data including detailed_metrics
      domainData[domain] = {
        scores: result.detailed_scores || result.domain_scores || {},
        score_value: result.overall_score,
        submitted_at: result.submitted_at,
        processed_at: result.processed_at,
        insights: result.insights || [],
        
        // Preserve detailed_metrics and all other backend data
        detailed_metrics: result.detailed_metrics,
        domain_scores: result.domain_scores,
        dimension_scores: result.dimension_scores,
        overall_score: result.overall_score,
        
        // Keep everything else from the backend
        ...result
      }
    })
    
    // Calculate or use provided summary statistics
    const summaryStats = domainScores.summary_statistics || 
      calculateSummaryStatistics(extractedDomainScores)
    
    return {
      assessment_id: assessmentId,
      status: domainScores.overall_assessment.status,
      created_at: domainScores.overall_assessment.created_at,
      updated_at: domainScores.overall_assessment.updated_at,
      completed_at: domainScores.overall_assessment.completed_at,
      progress: {
        completed_domains: domainScores.overall_assessment.completed_domains,
        completion_percentage: domainScores.overall_assessment.completion_percentage,
        domain_scores: extractedDomainScores,
        overall_score: domainScores.overall_assessment.overall_score,
        domain_data: domainData,
        summary_statistics: summaryStats
      }
    }
  }, [])

  // Load assessment from localStorage on mount, with API fallback
  useEffect(() => {
    const loadAssessment = async () => {
      setIsLoading(true)
      
      debugLog('useAssessment initialization', {
        isAuthenticated,
        hasToken: !!token
      })
      
      // First, try to get stored assessment ID
      const storedId = localStorage.getItem(STORAGE_KEYS.LAST_ASSESSMENT_ID)
      debugLog('Retrieved stored assessment ID:', storedId)
      
      if (storedId && isAuthenticated && token) {
        try {
          debugLog('Loading assessment from backend:', storedId)
          
          // Try to get the most comprehensive data first
          const domainScores = await fetchDomainScores(storedId)
          
          if (domainScores) {
            const assessment = convertDomainScoresToAssessment(storedId, domainScores)
            setCurrentAssessment(assessment)
            persistAssessmentData(assessment)
            debugLog('Loaded assessment with domain scores from backend')
            setIsLoading(false)
            return
          }
          
          // Fallback to basic assessment endpoint
          const response = await fetch(`http://localhost:8000/assessments/${storedId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (response.ok) {
            const backendAssessment = await response.json()
            
            const assessment = {
              ...backendAssessment,
              progress: {
                completed_domains: [],
                completion_percentage: 0,
                domain_scores: {},
                domain_data: {},
                summary_statistics: calculateSummaryStatistics({}),
                ...backendAssessment.progress,
                ...getStoredProgress(storedId)
              }
            }
            
            setCurrentAssessment(assessment)
            persistAssessmentData(assessment)
            debugLog('Loaded basic assessment from backend')
            setIsLoading(false)
            return
          }
        } catch (error) {
          debugLog('Failed to load from backend', error)
        }
      }
      
      // If backend fails or no auth, try localStorage as fallback
      const storedAssessment = loadStoredAssessment()
      if (storedAssessment) {
        setCurrentAssessment(storedAssessment)
        debugLog('Using cached assessment:', storedAssessment.assessment_id)
      } else {
        debugLog('No assessment found in cache or backend')
      }
      
      setIsLoading(false)
    }

    loadAssessment()
  }, [token, isAuthenticated, fetchDomainScores, convertDomainScoresToAssessment])

  // Update assessment and persist to localStorage
  const updateAssessment = useCallback((assessment: Assessment, progressData?: Partial<AssessmentProgress>) => {
    debugLog('Updating assessment:', assessment.assessment_id)
    
    // Ensure we don't lose domain data during updates
    const existingProgress: Partial<AssessmentProgress> = currentAssessment?.progress ?? {}
    const mergedProgressData = {
      ...existingProgress,
      ...assessment.progress,
      ...progressData,
      // Preserve existing domain data if not being updated
      domain_data: {
        ...(existingProgress.domain_data || {}),
        ...(assessment.progress?.domain_data || {}),
        ...(progressData?.domain_data || {})
      }
    }
    
    // Calculate summary statistics if we have domain scores
    if (mergedProgressData.domain_scores) {
      mergedProgressData.summary_statistics = {
        ...calculateSummaryStatistics(mergedProgressData.domain_scores),
        ...mergedProgressData.summary_statistics // Preserve any backend-provided stats
      }
    }
    
    const updatedAssessment = {
      ...assessment,
      progress: mergedProgressData
    }
    
    setCurrentAssessment(updatedAssessment)
    persistAssessmentData(updatedAssessment, progressData)
    
    // Trigger auto-refresh of queries
    invalidateAssessmentQueries()
  }, [currentAssessment, invalidateAssessmentQueries])

  // Update just the progress without changing the main assessment
  const updateProgress = useCallback((progressData: Partial<AssessmentProgress>) => {
    if (!currentAssessment) {
      debugLog('Cannot update progress - no current assessment')
      return
    }
    
    debugLog('Updating progress for:', currentAssessment.assessment_id, progressData)
    
    const mergedProgress = {
      ...currentAssessment.progress,
      ...progressData,
      // Preserve domain data during progress updates
      domain_data: {
        ...(currentAssessment.progress?.domain_data || {}),
        ...(progressData?.domain_data || {})
      }
    }
    
    // Calculate summary statistics if we have domain scores
    if (mergedProgress.domain_scores) {
      mergedProgress.summary_statistics = {
        ...calculateSummaryStatistics(mergedProgress.domain_scores),
        ...mergedProgress.summary_statistics // Preserve any backend-provided stats
      }
    }
    
    const updatedAssessment = {
      ...currentAssessment,
      progress: mergedProgress
    }
    
    setCurrentAssessment(updatedAssessment)
    persistAssessmentData(updatedAssessment, progressData)
    
    // Trigger auto-refresh of queries
    invalidateAssessmentQueries()
  }, [currentAssessment, invalidateAssessmentQueries])

  // Create new assessment
  const createAssessment = useCallback(async () => {
    setIsLoading(true)
    try {
      if (!isAuthenticated || !token) {
        throw new Error('Authentication required to create assessment')
      }

      const response = await fetch('http://localhost:8000/assessments/', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({})
      })

      if (response.status === 401) {
        throw new Error('Session expired. Please log in again.')
      }

      if (!response.ok) {
        throw new Error(`Failed to create assessment: ${response.status}`)
      }

      const backendAssessment = await response.json()
      
      if (!backendAssessment.assessment_id) {
        throw new Error('Backend did not return assessment_id')
      }
      
      const assessment = {
        ...backendAssessment,
        progress: {
          completed_domains: [],
          completion_percentage: 0,
          domain_scores: {},
          overall_score: null,
          domain_data: {},
          summary_statistics: calculateSummaryStatistics({})
        }
      }
      
      setCurrentAssessment(assessment)
      persistAssessmentData(assessment)
      
      // Trigger auto-refresh to update lists
      invalidateAssessmentQueries()
      
      debugLog('Created new assessment:', assessment.assessment_id)
      return assessment
      
    } catch (error) {
      debugLog('Error creating assessment', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [token, isAuthenticated, invalidateAssessmentQueries])

  // Clear current assessment (for creating new one)
  const clearAssessment = useCallback(() => {
    debugLog('Clearing current assessment')
    if (currentAssessment) {
      clearAssessmentData(currentAssessment.assessment_id)
    }
    setCurrentAssessment(null)
    
    // Trigger auto-refresh to update lists
    invalidateAssessmentQueries()
  }, [currentAssessment, invalidateAssessmentQueries])

  // Get or create assessment
  const ensureAssessment = useCallback(async () => {
    if (!currentAssessment) {
      return await createAssessment()
    }
    return currentAssessment
  }, [currentAssessment, createAssessment])

  // Get last assessment ID (for WebSocket reconnection)
  const getLastAssessmentId = useCallback(() => {
    return localStorage.getItem(STORAGE_KEYS.LAST_ASSESSMENT_ID)
  }, [])

  // Refresh assessment data from API with proper error handling
  const refreshAssessmentData = useCallback(async (assessmentId?: string) => {
    const targetId = assessmentId || currentAssessment?.assessment_id
    if (!targetId) {
      debugLog('Cannot refresh - no assessment ID')
      return null
    }
    
    if (!isAuthenticated || !token) {
      debugLog('Cannot refresh - not authenticated')
      return null
    }
    
    try {
      debugLog('Refreshing assessment data:', targetId)
      
      const domainScores = await fetchDomainScores(targetId)
      
      if (domainScores) {
        const refreshedAssessment = convertDomainScoresToAssessment(targetId, domainScores)
        setCurrentAssessment(refreshedAssessment)
        persistAssessmentData(refreshedAssessment)
        
        // Trigger auto-refresh of queries
        invalidateAssessmentQueries()
        
        debugLog('Successfully refreshed assessment data')
        return refreshedAssessment
      } else {
        debugLog('Failed to refresh assessment data')
        return null
      }
      
    } catch (error) {
      debugLog('Error refreshing assessment data', error)
      return null
    }
  }, [currentAssessment, token, isAuthenticated, fetchDomainScores, convertDomainScoresToAssessment, invalidateAssessmentQueries])

  // Restore assessment by ID (enhanced with API fetch)
  const restoreAssessmentById = useCallback(async (assessmentId: string) => {
    debugLog('Attempting to restore assessment:', assessmentId)
    
    // First try the domain scores endpoint (more comprehensive)
    const domainScores = await fetchDomainScores(assessmentId)
    if (domainScores) {
      const restoredAssessment = convertDomainScoresToAssessment(assessmentId, domainScores)
      setCurrentAssessment(restoredAssessment)
      persistAssessmentData(restoredAssessment)
      
      // Trigger auto-refresh of queries
      invalidateAssessmentQueries()
      
      return restoredAssessment
    }
    
    // Fallback: try basic assessment endpoint
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      
      if (isAuthenticated && token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`http://localhost:8000/assessments/${assessmentId}`, {
        headers
      })
      
      if (response.ok) {
        const assessment = await response.json()
        debugLog('Restored assessment from basic endpoint')
        updateAssessment(assessment)
        return assessment
      }
    } catch (error) {
      debugLog('Could not restore from backend', error)
    }
    
    // Final fallback: create minimal assessment object
    const storedProgress = getStoredProgress(assessmentId)
    const minimalAssessment: Assessment = {
      assessment_id: assessmentId,
      status: 'IN_PROGRESS',
      created_at: new Date().toISOString(),
      progress: {
        completed_domains: [],
        completion_percentage: 0,
        domain_data: {},
        summary_statistics: calculateSummaryStatistics({}),
        ...storedProgress
      }
    }
    
    setCurrentAssessment(minimalAssessment)
    persistAssessmentData(minimalAssessment)
    
    // Trigger auto-refresh of queries
    invalidateAssessmentQueries()
    
    return minimalAssessment
  }, [updateAssessment, fetchDomainScores, convertDomainScoresToAssessment, token, isAuthenticated, invalidateAssessmentQueries])

  // Debug logging for state changes
  useEffect(() => {
    debugLog('Assessment state changed', {
      hasAssessment: !!currentAssessment,
      assessmentId: currentAssessment?.assessment_id,
      status: currentAssessment?.status,
      completedDomains: currentAssessment?.progress?.completed_domains?.length || 0,
      hasStats: !!currentAssessment?.progress?.summary_statistics,
      isLoading
    })
  }, [currentAssessment, isLoading])

  const switchToAssessment = useCallback(async (assessment: Assessment) => {
    debugLog('Switching to assessment:', assessment.assessment_id)
    
    try {
      // Clear current assessment data first
      if (currentAssessment) {
        clearAssessmentData(currentAssessment.assessment_id)
      }
      
      // Try to fetch fresh data from API if authenticated
      if (isAuthenticated && token) {
        const domainScores = await fetchDomainScores(assessment.assessment_id)
        
        if (domainScores) {
          const freshAssessment = convertDomainScoresToAssessment(assessment.assessment_id, domainScores)
          setCurrentAssessment(freshAssessment)
          persistAssessmentData(freshAssessment)
          
          // Trigger auto-refresh of queries
          invalidateAssessmentQueries()
          
          debugLog('Switched to assessment with fresh domain scores')
          return freshAssessment
        }
      }
      
      // Fallback to the provided assessment data
      const storedProgress = getStoredProgress(assessment.assessment_id)
      const switchedAssessment = {
        ...assessment,
        progress: {
          completed_domains: [],
          completion_percentage: 0,
          domain_scores: {},
          domain_data: {},
          summary_statistics: calculateSummaryStatistics({}),
          ...assessment.progress,
          ...storedProgress
        }
      }
      
      setCurrentAssessment(switchedAssessment)
      persistAssessmentData(switchedAssessment)
      
      // Trigger auto-refresh of queries
      invalidateAssessmentQueries()
      
      debugLog('Switched to assessment with cached data')
      return switchedAssessment
      
    } catch (error) {
      debugLog('Error switching assessment', error)
      throw error
    }
  }, [currentAssessment, isAuthenticated, token, fetchDomainScores, convertDomainScoresToAssessment, invalidateAssessmentQueries])

  // Create a snapshot before optimistic updates
  const createSnapshot = useCallback(() => {
    if (currentAssessment) {
      setAssessmentSnapshot(JSON.parse(JSON.stringify(currentAssessment)))
      debugLog('Created assessment snapshot', currentAssessment.assessment_id)
    }
  }, [currentAssessment])

  // Rollback to snapshot
  const rollbackToSnapshot = useCallback(() => {
    if (assessmentSnapshot) {
      setCurrentAssessment(assessmentSnapshot)
      persistAssessmentData(assessmentSnapshot)
      debugLog('Rolled back to snapshot', assessmentSnapshot.assessment_id)
      
      // Clear snapshot after rollback
      setAssessmentSnapshot(null)
      return true
    }
    debugLog('No snapshot available for rollback')
    return false
  }, [assessmentSnapshot])

  // Clear snapshot (call after successful update)
  const clearSnapshot = useCallback(() => {
    setAssessmentSnapshot(null)
  }, [])

  // Modified updateProgress with snapshot support
  const updateProgressWithSnapshot = useCallback((
    progressData: Partial<AssessmentProgress>,
    createSnapshotFirst: boolean = false
  ) => {
    if (!currentAssessment) {
      debugLog('Cannot update progress - no current assessment')
      return
    }
    
    if (createSnapshotFirst) {
      createSnapshot()
    }
    
    debugLog('Updating progress for:', currentAssessment.assessment_id, progressData)
    
    const mergedProgress = {
      ...currentAssessment.progress,
      ...progressData,
      domain_data: {
        ...(currentAssessment.progress?.domain_data || {}),
        ...(progressData?.domain_data || {})
      }
    }
    
    if (mergedProgress.domain_scores) {
      mergedProgress.summary_statistics = {
        ...calculateSummaryStatistics(mergedProgress.domain_scores),
        ...mergedProgress.summary_statistics
      }
    }
    
    const updatedAssessment = {
      ...currentAssessment,
      progress: mergedProgress
    }
    
    setCurrentAssessment(updatedAssessment)
    persistAssessmentData(updatedAssessment, progressData)
    invalidateAssessmentQueries()
  }, [currentAssessment, invalidateAssessmentQueries, createSnapshot])

  return {
    currentAssessment,
    isLoading,
    updateAssessment,
    updateProgress,
    updateProgressWithSnapshot,
    createSnapshot,
    rollbackToSnapshot,
    clearSnapshot,
    createAssessment,
    clearAssessment,
    ensureAssessment,
    getLastAssessmentId,
    restoreAssessmentById,
    refreshAssessmentData,
    switchToAssessment  
  }
}