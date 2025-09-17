import { useState, useEffect, useCallback } from 'react'
import { useAuth } from "@/auth"

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
  status?: string // Added status to progress interface
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

// Enhanced persistence with progress tracking
const persistAssessmentData = (assessment: Assessment, additionalData?: Partial<AssessmentProgress>) => {
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

const getStoredProgress = (assessmentId: string): Partial<AssessmentProgress> => {
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

export const useAssessment = () => {
  const [currentAssessment, setCurrentAssessment] = useState<Assessment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { token, isAuthenticated, user } = useAuth()

  // FIXED: Function to fetch domain scores with authentication
  const fetchDomainScores = useCallback(async (assessmentId: string): Promise<DomainScoresResponse | null> => {
    try {
      console.log('📄 Fetching domain scores for assessment:', assessmentId)
      
      // Include authentication headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      
      if (isAuthenticated && token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      // FIXED: Consistent endpoint URL with trailing slash
      const response = await fetch(`http://localhost:8000/assessments/${assessmentId}/domain-scores/`, {
        headers
      })
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('🔭 Assessment not found in backend')
          return null
        }
        if (response.status === 401) {
          console.warn('🔒 Authentication required for domain scores')
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
  }, [token, isAuthenticated])

  // FIXED: Convert domain scores response to assessment format
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
  }, [])

  // FIXED: Load assessment from localStorage on mount, with API fallback
  useEffect(() => {
    const loadAssessment = async () => {
      setIsLoading(true)
      
      // Check if we have a stored assessment ID
      const storedId = localStorage.getItem('lastAssessmentId')
      
      if (storedId && isAuthenticated && token) {
        try {
          console.log('🔄 Loading assessment from backend:', storedId)
          
          // FIXED: Always try to get the most comprehensive data first
          const domainScores = await fetchDomainScores(storedId)
          
          if (domainScores) {
            const assessment = convertDomainScoresToAssessment(storedId, domainScores)
            setCurrentAssessment(assessment)
            persistAssessmentData(assessment)
            console.log('✅ Loaded assessment with domain scores from backend')
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
                ...backendAssessment.progress,
                ...getStoredProgress(storedId)
              }
            }
            
            setCurrentAssessment(assessment)
            persistAssessmentData(assessment)
            console.log('✅ Loaded basic assessment from backend')
            setIsLoading(false)
            return
          }
        } catch (error) {
          console.warn('⚠️ Failed to load from backend:', error)
        }
      }
      
      // If backend fails or no auth, try localStorage as fallback
      const storedAssessment = loadStoredAssessment()
      if (storedAssessment) {
        setCurrentAssessment(storedAssessment)
        console.log('📦 Using cached assessment:', storedAssessment.assessment_id)
      }
      
      setIsLoading(false)
    }

    loadAssessment()
  }, [token, isAuthenticated, fetchDomainScores, convertDomainScoresToAssessment])

  // Update assessment and persist to localStorage
  const updateAssessment = useCallback((assessment: Assessment, progressData?: Partial<AssessmentProgress>) => {
    console.log('[Assessment Hook] Updating assessment:', assessment.assessment_id)
    
    // FIXED: Ensure we don't lose domain data during updates
    const existingProgress: Partial<AssessmentProgress> = currentAssessment?.progress ?? {}
    const updatedAssessment = {
      ...assessment,
      progress: {
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
    }
    
    setCurrentAssessment(updatedAssessment)
    persistAssessmentData(updatedAssessment, progressData)
  }, [currentAssessment])

  // Update just the progress without changing the main assessment
  const updateProgress = useCallback((progressData: Partial<AssessmentProgress>) => {
    if (!currentAssessment) {
      console.warn('[Assessment Hook] Cannot update progress - no current assessment')
      return
    }
    
    console.log('[Assessment Hook] Updating progress for:', currentAssessment.assessment_id, progressData)
    
    const updatedAssessment = {
      ...currentAssessment,
      progress: {
        ...currentAssessment.progress,
        ...progressData,
        // FIXED: Preserve domain data during progress updates
        domain_data: {
          ...(currentAssessment.progress?.domain_data || {}),
          ...(progressData?.domain_data || {})
        }
      }
    }
    
    setCurrentAssessment(updatedAssessment)
    persistAssessmentData(updatedAssessment, progressData)
  }, [currentAssessment])

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
          domain_data: {} // FIXED: Initialize domain_data
        }
      }
      
      setCurrentAssessment(assessment)
      localStorage.setItem('lastAssessmentId', assessment.assessment_id)
      persistAssessmentData(assessment)
      
      console.log('✅ Created new assessment:', assessment.assessment_id)
      return assessment
      
    } catch (error) {
      console.error('❌ Error creating assessment:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [token, isAuthenticated])

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

  // FIXED: Refresh assessment data from API with proper error handling
  const refreshAssessmentData = useCallback(async (assessmentId?: string) => {
    const targetId = assessmentId || currentAssessment?.assessment_id
    if (!targetId) {
      console.warn('❌ Cannot refresh - no assessment ID')
      return null
    }
    
    if (!isAuthenticated || !token) {
      console.warn('🔒 Cannot refresh - not authenticated')
      return null
    }
    
    try {
      console.log('🔄 Refreshing assessment data:', targetId)
      
      // FIXED: Use the helper function with proper auth
      const domainScores = await fetchDomainScores(targetId)
      
      if (domainScores) {
        const refreshedAssessment = convertDomainScoresToAssessment(targetId, domainScores)
        setCurrentAssessment(refreshedAssessment)
        persistAssessmentData(refreshedAssessment)
        console.log('✅ Successfully refreshed assessment data')
        return refreshedAssessment
      } else {
        console.warn('⚠️ Failed to refresh assessment data')
        return null
      }
      
    } catch (error) {
      console.error('❌ Error refreshing assessment data:', error)
      return null
    }
  }, [currentAssessment, token, isAuthenticated, fetchDomainScores, convertDomainScoresToAssessment])

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
        console.log('[Assessment Hook] Restored assessment from basic endpoint')
        updateAssessment(assessment)
        return assessment
      }
    } catch (error) {
      console.warn('[Assessment Hook] Could not restore from backend:', error)
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
        ...storedProgress
      }
    }
    
    setCurrentAssessment(minimalAssessment)
    persistAssessmentData(minimalAssessment)
    return minimalAssessment
  }, [updateAssessment, fetchDomainScores, convertDomainScoresToAssessment, token, isAuthenticated])

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
    refreshAssessmentData
  }
}