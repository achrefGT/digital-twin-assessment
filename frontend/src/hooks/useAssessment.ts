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
  }
  [key: string]: any
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
    console.log('📥 Loaded assessment from storage:', assessment.assessment_id)
    
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

export const useAssessment = () => {
  const [currentAssessment, setCurrentAssessment] = useState<Assessment | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load assessment from localStorage on mount
  useEffect(() => {
    const loadAssessment = () => {
      const assessment = loadStoredAssessment()
      if (assessment) {
        console.log('[Assessment Hook] Loaded from localStorage:', assessment.assessment_id)
        setCurrentAssessment(assessment)
      } else {
        console.log('[Assessment Hook] No assessment in localStorage')
        
        // Check if we have just an assessment ID (fallback)
        const lastId = localStorage.getItem(STORAGE_KEYS.LAST_ASSESSMENT_ID)
        if (lastId) {
          console.log('[Assessment Hook] Found last assessment ID, creating minimal assessment object')
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

  // Restore assessment by ID (if we have the ID but lost the object)
  const restoreAssessmentById = useCallback(async (assessmentId: string) => {
    console.log('[Assessment Hook] Attempting to restore assessment:', assessmentId)
    
    try {
      // Try to fetch from backend first
      const response = await fetch(`http://localhost:8000/assessments/${assessmentId}`)
      if (response.ok) {
        const assessment = await response.json()
        console.log('[Assessment Hook] Restored assessment from backend')
        updateAssessment(assessment)
        return assessment
      }
    } catch (error) {
      console.warn('[Assessment Hook] Could not restore from backend:', error)
    }
    
    // Fallback: create minimal assessment object
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
    restoreAssessmentById
  }
}