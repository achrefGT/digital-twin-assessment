import { useState, useEffect, useCallback } from 'react'

interface Assessment {
  assessment_id: string
  status: string
  created_at: string
  updated_at?: string
  user_id?: string
  progress?: {
    completed_domains: string[]
    completion_percentage: number
    domain_scores?: Record<string, number>
    overall_score?: number
    domain_data?: Record<string, any> // Added this property
    summary_statistics?: {
      completed_domain_count: number
      average_score: number
      highest_score: number
      lowest_score: number
      score_distribution: Record<string, number>
    }
  }
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

// Enhanced persistence with progress tracking
const persistAssessmentData = (assessment: Assessment, additionalData?: any) => {
  try {
    // Store the main assessment
    localStorage.setItem(STORAGE_KEYS.CURRENT_ASSESSMENT, JSON.stringify(assessment))
    
    // Store assessment ID for WebSocket reconnection
    localStorage.setItem(STORAGE_KEYS.LAST_ASSESSMENT_ID, assessment.assessment_id)
    
    // Store any additional progress data
    if (additionalData) {
      const existingProgress = getStoredProgress(assessment.assessment_id)
      const updatedProgress = { ...existingProgress, ...additionalData }
      localStorage.setItem(
        `${STORAGE_KEYS.ASSESSMENT_PROGRESS}_${assessment.assessment_id}`, 
        JSON.stringify(updatedProgress)
      )
    }
    
    console.log('✅ Persisted assessment data:', assessment.assessment_id)
  } catch (error) {
    console.error('❌ Failed to persist assessment data:', error)
  }
}

const loadStoredAssessment = (): Assessment | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_ASSESSMENT)
    if (!stored) return null
    
    const assessment = JSON.parse(stored)
    console.log('🔥 Loaded assessment from storage:', assessment.assessment_id)
    
    // Load additional progress data if available
    const progress = getStoredProgress(assessment.assessment_id)
    if (progress && Object.keys(progress).length > 0) {
      assessment.progress = { ...assessment.progress, ...progress }
      console.log('📊 Loaded progress data:', progress)
    }
    
    return assessment
  } catch (error) {
    console.error('❌ Failed to load assessment from storage:', error)
    // Clear corrupted data
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ASSESSMENT)
    return null
  }
}

const getStoredProgress = (assessmentId: string) => {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEYS.ASSESSMENT_PROGRESS}_${assessmentId}`)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    console.error('❌ Failed to load progress data:', error)
    return {}
  }
}

const clearAssessmentData = (assessmentId?: string) => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ASSESSMENT)
    localStorage.removeItem(STORAGE_KEYS.LAST_ASSESSMENT_ID)
    
    if (assessmentId) {
      localStorage.removeItem(`${STORAGE_KEYS.ASSESSMENT_PROGRESS}_${assessmentId}`)
      localStorage.removeItem(`${STORAGE_KEYS.DOMAIN_DATA}_${assessmentId}`)
    }
    
    console.log('🗑️ Cleared assessment data for:', assessmentId || 'current')
  } catch (error) {
    console.error('❌ Failed to clear assessment data:', error)
  }
}

// NEW: Function to fetch domain scores from API
const fetchDomainScores = async (assessmentId: string): Promise<DomainScoresResponse | null> => {
  try {
    console.log('🔄 Fetching domain scores for assessment:', assessmentId)
    const response = await fetch(`http://localhost:8000/assessments/${assessmentId}/domain-scores`)
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('🔭 Assessment not found in backend')
        return null
      }
      throw new Error(`Failed to fetch domain scores: ${response.status}`)
    }
    
    const domainScores = await response.json()
    console.log('✅ Fetched domain scores:', domainScores)
    return domainScores
  } catch (error) {
    console.error('❌ Error fetching domain scores:', error)
    return null
  }
}

// NEW: Convert domain scores response to assessment format
const convertDomainScoresToAssessment = (
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
    
    // Store detailed domain data for dashboard display
    domainData[domain] = {
      scores: result.detailed_scores || {},
      score_value: result.overall_score,
      submitted_at: result.submitted_at,
      processed_at: result.processed_at,
      insights: result.insights || []
    }
  })
  
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
      summary_statistics: domainScores.summary_statistics
    }
  }
}

export const useAssessment = () => {
  const [currentAssessment, setCurrentAssessment] = useState<Assessment | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load assessment from localStorage on mount, with API fallback
  useEffect(() => {
    const loadAssessment = async () => {
      // First try localStorage
      const storedAssessment = loadStoredAssessment()
      
      if (storedAssessment) {
        console.log('[Assessment Hook] Loaded from localStorage:', storedAssessment.assessment_id)
        
        // Try to fetch fresh data from API to ensure we have latest scores
        const domainScores = await fetchDomainScores(storedAssessment.assessment_id)
        
        if (domainScores) {
          console.log('[Assessment Hook] Refreshed with API data')
          const refreshedAssessment = convertDomainScoresToAssessment(
            storedAssessment.assessment_id, 
            domainScores
          )
          setCurrentAssessment(refreshedAssessment)
          persistAssessmentData(refreshedAssessment)
        } else {
          // Use stored data if API fails
          console.log('[Assessment Hook] Using stored data (API unavailable)')
          setCurrentAssessment(storedAssessment)
        }
      } else {
        // Check if we have just an assessment ID (fallback)
        const lastId = localStorage.getItem(STORAGE_KEYS.LAST_ASSESSMENT_ID)
        if (lastId) {
          console.log('[Assessment Hook] Found last assessment ID, fetching from API:', lastId)
          
          const domainScores = await fetchDomainScores(lastId)
          if (domainScores) {
            const restoredAssessment = convertDomainScoresToAssessment(lastId, domainScores)
            setCurrentAssessment(restoredAssessment)
            persistAssessmentData(restoredAssessment)
          } else {
            // Create minimal assessment object as fallback
            console.log('[Assessment Hook] API unavailable, creating minimal assessment object')
            const minimalAssessment: Assessment = {
              assessment_id: lastId,
              status: 'IN_PROGRESS',
              created_at: new Date().toISOString(),
              progress: {
                completed_domains: [],
                completion_percentage: 0
              }
            }
            setCurrentAssessment(minimalAssessment)
          }
        }
      }
      setIsLoading(false)
    }

    loadAssessment()
  }, [])

  // Update assessment and persist to localStorage
  const updateAssessment = useCallback((assessment: Assessment, progressData?: any) => {
    console.log('[Assessment Hook] Updating assessment:', assessment.assessment_id)
    
    // Merge with existing progress data to avoid losing information
    const existingProgress = currentAssessment?.progress || {}
    const updatedAssessment = {
      ...assessment,
      progress: {
        ...existingProgress,
        ...assessment.progress,
        ...progressData
      }
    }
    
    setCurrentAssessment(updatedAssessment)
    persistAssessmentData(updatedAssessment, progressData)
  }, [currentAssessment])

  // Update just the progress without changing the main assessment
  const updateProgress = useCallback((progressData: any) => {
    if (!currentAssessment) {
      console.warn('[Assessment Hook] Cannot update progress - no current assessment')
      return
    }
    
    console.log('[Assessment Hook] Updating progress for:', currentAssessment.assessment_id, progressData)
    
    const updatedAssessment = {
      ...currentAssessment,
      progress: {
        ...currentAssessment.progress,
        ...progressData
      }
    }
    
    setCurrentAssessment(updatedAssessment)
    persistAssessmentData(updatedAssessment, progressData)
  }, [currentAssessment])

  // Create new assessment
  const createAssessment = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('http://localhost:8000/assessments/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: null // or get from auth context
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to create assessment: ${response.status}`)
      }

      const newAssessment = await response.json()
      console.log('[Assessment Hook] Created new assessment:', newAssessment.assessment_id)
      
      // Clear any existing assessment data before setting new one
      if (currentAssessment) {
        clearAssessmentData(currentAssessment.assessment_id)
      }
      
      // Initialize with empty progress
      const assessmentWithProgress = {
        ...newAssessment,
        progress: {
          completed_domains: [],
          completion_percentage: 0,
          domain_scores: {},
          overall_score: null
        }
      }
      
      updateAssessment(assessmentWithProgress)
      return assessmentWithProgress
    } catch (error) {
      console.error('[Assessment Hook] Error creating assessment:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [currentAssessment, updateAssessment])

  // Clear current assessment (for creating new one)
  const clearAssessment = useCallback(() => {
    console.log('[Assessment Hook] Clearing current assessment')
    if (currentAssessment) {
      clearAssessmentData(currentAssessment.assessment_id)
    }
    setCurrentAssessment(null)
  }, [currentAssessment])

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

  // NEW: Refresh assessment data from API
  const refreshAssessmentData = useCallback(async (assessmentId?: string) => {
    const targetId = assessmentId || currentAssessment?.assessment_id
    if (!targetId) {
      console.warn('[Assessment Hook] Cannot refresh - no assessment ID')
      return
    }
    
    console.log('[Assessment Hook] Refreshing assessment data:', targetId)
    const domainScores = await fetchDomainScores(targetId)
    
    if (domainScores) {
      const refreshedAssessment = convertDomainScoresToAssessment(targetId, domainScores)
      setCurrentAssessment(refreshedAssessment)
      persistAssessmentData(refreshedAssessment)
      console.log('[Assessment Hook] Successfully refreshed assessment data')
      return refreshedAssessment
    } else {
      console.warn('[Assessment Hook] Failed to refresh assessment data')
      return null
    }
  }, [currentAssessment])

  // Restore assessment by ID (enhanced with API fetch)
  const restoreAssessmentById = useCallback(async (assessmentId: string) => {
    console.log('[Assessment Hook] Attempting to restore assessment:', assessmentId)
    
    // First try the domain scores endpoint (more comprehensive)
    const domainScores = await fetchDomainScores(assessmentId)
    if (domainScores) {
      const restoredAssessment = convertDomainScoresToAssessment(assessmentId, domainScores)
      setCurrentAssessment(restoredAssessment)
      persistAssessmentData(restoredAssessment)
      return restoredAssessment
    }
    
    // Fallback: try basic assessment endpoint
    try {
      const response = await fetch(`http://localhost:8000/assessments/${assessmentId}`)
      if (response.ok) {
        const assessment = await response.json()
        console.log('[Assessment Hook] Restored assessment from basic endpoint')
        updateAssessment(assessment)
        return assessment
      }
    } catch (error) {
      console.warn('[Assessment Hook] Could not restore from backend:', error)
    }
    
    // Final fallback: create minimal assessment object
    const minimalAssessment: Assessment = {
      assessment_id: assessmentId,
      status: 'IN_PROGRESS',
      created_at: new Date().toISOString(),
      progress: getStoredProgress(assessmentId)
    }
    
    setCurrentAssessment(minimalAssessment)
    persistAssessmentData(minimalAssessment)
    return minimalAssessment
  }, [updateAssessment])

  return {
    currentAssessment,
    isLoading,
    updateAssessment,
    updateProgress,
    createAssessment,
    clearAssessment,
    ensureAssessment,
    getLastAssessmentId,
    restoreAssessmentById,
    refreshAssessmentData // NEW: expose refresh function
  }
}