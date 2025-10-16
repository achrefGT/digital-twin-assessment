import { useState, useEffect, useCallback } from 'react'
import { useAuth } from "@/auth"
import { useQueryClient } from '@tanstack/react-query'
import useWebSocket, { WebSocketMessage } from './useWebSocket'

interface Recommendation {
  recommendation_id: string
  domain: string
  category: string
  title: string
  description: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  estimated_impact?: string
  implementation_effort?: string
  source: string
  criterion_id?: string
  confidence_score?: number
  status?: 'pending' | 'in_progress' | 'completed' | 'rejected'
  notes?: string
}

interface RecommendationSet {
  recommendation_set_id: string
  assessment_id: string
  user_id?: string
  recommendations: Recommendation[]
  source: string
  generation_time_ms?: number
  model_used?: string
  created_at: string
  total_recommendations: number
  priority_breakdown: {
    high: number
    medium: number
    low: number
  }
  domain_breakdown: Record<string, number>
}

const STORAGE_KEYS = {
  RECOMMENDATIONS: 'assessmentRecommendations',
  LAST_RECOMMENDATION_SET_ID: 'lastRecommendationSetId'
}

const API_BASE_URL = 'http://localhost:8000'

// Debug logging
const debugLog = (message: string, data?: any) => {
  console.log(`[DEBUG useRecommendations] ${message}`, data || '')
}

// Persist recommendations to localStorage
const persistRecommendations = (
  assessmentId: string, 
  recommendationSet: RecommendationSet
) => {
  try {
    const key = `${STORAGE_KEYS.RECOMMENDATIONS}_${assessmentId}`
    localStorage.setItem(key, JSON.stringify(recommendationSet))
    localStorage.setItem(STORAGE_KEYS.LAST_RECOMMENDATION_SET_ID, recommendationSet.recommendation_set_id)
    debugLog('✅ Persisted recommendations', { assessmentId, count: recommendationSet.recommendations.length })
    return true
  } catch (error) {
    debugLog('❌ Failed to persist recommendations', error)
    return false
  }
}

// Load recommendations from localStorage
const loadStoredRecommendations = (assessmentId: string): RecommendationSet | null => {
  try {
    const key = `${STORAGE_KEYS.RECOMMENDATIONS}_${assessmentId}`
    const stored = localStorage.getItem(key)
    
    if (!stored) {
      debugLog('No stored recommendations found', assessmentId)
      return null
    }
    
    const recommendationSet = JSON.parse(stored)
    debugLog('📦 Loaded recommendations from storage', {
      assessmentId,
      count: recommendationSet.recommendations.length,
      created_at: recommendationSet.created_at
    })
    
    return recommendationSet
  } catch (error) {
    debugLog('❌ Failed to load recommendations', error)
    return null
  }
}

// Clear recommendations from localStorage
const clearStoredRecommendations = (assessmentId?: string) => {
  try {
    if (assessmentId) {
      const key = `${STORAGE_KEYS.RECOMMENDATIONS}_${assessmentId}`
      localStorage.removeItem(key)
      debugLog('🗑️ Cleared recommendations for assessment', assessmentId)
    } else {
      // Clear all recommendation data
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(STORAGE_KEYS.RECOMMENDATIONS)) {
          localStorage.removeItem(key)
        }
      })
      localStorage.removeItem(STORAGE_KEYS.LAST_RECOMMENDATION_SET_ID)
      debugLog('🗑️ Cleared all recommendations')
    }
  } catch (error) {
    debugLog('❌ Failed to clear recommendations', error)
  }
}

// Convert WebSocket message to RecommendationSet format
const convertWebSocketToRecommendationSet = (
  message: WebSocketMessage
): RecommendationSet | null => {
  try {
    if (message.type !== 'recommendations_ready') {
      return null
    }

    const recommendations = message.recommendations || []
    
    // Calculate breakdown statistics
    const priorityBreakdown = {
      high: recommendations.filter((r: Recommendation) => r.priority === 'high').length,
      medium: recommendations.filter((r: Recommendation) => r.priority === 'medium').length,
      low: recommendations.filter((r: Recommendation) => r.priority === 'low').length
    }
    
    const domainBreakdown = recommendations.reduce((acc: Record<string, number>, r: Recommendation) => {
      acc[r.domain] = (acc[r.domain] || 0) + 1
      return acc
    }, {})

    return {
      recommendation_set_id: message.recommendation_set_id || `ws_${Date.now()}`,
      assessment_id: message.assessment_id,
      user_id: message.user_id,
      recommendations,
      source: message.source || 'websocket',
      generation_time_ms: message.generation_time_ms,
      model_used: message.model_used,
      created_at: message.timestamp || new Date().toISOString(),
      total_recommendations: recommendations.length,
      priority_breakdown: priorityBreakdown,
      domain_breakdown: domainBreakdown
    }
  } catch (error) {
    debugLog('❌ Failed to convert WebSocket message', error)
    return null
  }
}

export const useRecommendations = (assessmentId?: string) => {
  const [recommendations, setRecommendations] = useState<RecommendationSet | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { token, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  // 🔥 CRITICAL FIX: Connect to WebSocket for real-time recommendations
  const { messages, isConnected } = useWebSocket(assessmentId || '', !!assessmentId)

  // Fetch recommendations from API
  const fetchRecommendations = useCallback(async (
    targetAssessmentId: string,
    latestOnly: boolean = true
  ): Promise<RecommendationSet | null> => {
    try {
      debugLog('🌐 Fetching recommendations from API', targetAssessmentId)
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      
      if (isAuthenticated && token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(
        `${API_BASE_URL}/api/recommendations/assessment/${targetAssessmentId}?latest_only=${latestOnly}`,
        { headers }
      )
      
      if (!response.ok) {
        if (response.status === 404) {
          debugLog('⚠️ No recommendations found in backend', targetAssessmentId)
          return null
        }
        throw new Error(`Failed to fetch recommendations: ${response.status}`)
      }
      
      const data = await response.json()
      debugLog('✅ Fetched recommendations from API', {
        assessmentId: targetAssessmentId,
        count: data.recommendations?.length || 0
      })
      
      return data
    } catch (err) {
      debugLog('❌ Error fetching recommendations', err)
      throw err
    }
  }, [token, isAuthenticated])

  // 🔥 CRITICAL FIX: Listen to WebSocket messages for real-time recommendations
  useEffect(() => {
    if (!assessmentId || !messages || messages.length === 0) {
      return
    }

    // Process the latest message
    const latestMessage = messages[messages.length - 1]
    
    debugLog('📨 Processing WebSocket message', {
      type: latestMessage.type,
      hasRecommendations: !!latestMessage.recommendations
    })

    // Handle recommendations_ready message
    if (latestMessage.type === 'recommendations_ready') {
      debugLog('🎯 Received recommendations via WebSocket', {
        count: latestMessage.recommendations?.length || 0,
        source: latestMessage.source
      })

      const recommendationSet = convertWebSocketToRecommendationSet(latestMessage)
      
      if (recommendationSet) {
        setRecommendations(recommendationSet)
        persistRecommendations(assessmentId, recommendationSet)
        setError(null)
        
        debugLog('✅ Recommendations received and persisted', {
          count: recommendationSet.recommendations.length,
          assessment_id: recommendationSet.assessment_id
        })
      }
    }
  }, [messages, assessmentId])

  // Load recommendations on mount (from cache or API)
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!assessmentId) {
        debugLog('⚠️ No assessment ID provided')
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // Step 1: Try to load from localStorage first (instant)
        const cachedData = loadStoredRecommendations(assessmentId)
        if (cachedData) {
          setRecommendations(cachedData)
          debugLog('📦 Loaded recommendations from cache (instant)')
          setIsLoading(false)
          
          // Still try to fetch fresh data in background if authenticated
          if (isAuthenticated && token) {
            try {
              const apiData = await fetchRecommendations(assessmentId)
              if (apiData && apiData.created_at > cachedData.created_at) {
                debugLog('🔄 Updating with fresher API data')
                setRecommendations(apiData)
                persistRecommendations(assessmentId, apiData)
              }
            } catch (apiError) {
              debugLog('⚠️ Background API fetch failed, using cache', apiError)
              // Cache is good enough, ignore API error
            }
          }
          
          return
        }

        // Step 2: No cache, fetch from API if authenticated
        if (isAuthenticated && token) {
          try {
            const apiData = await fetchRecommendations(assessmentId)
            
            if (apiData) {
              setRecommendations(apiData)
              persistRecommendations(assessmentId, apiData)
              debugLog('✅ Loaded recommendations from API')
              setIsLoading(false)
              return
            }
          } catch (apiError) {
            debugLog('⚠️ API fetch failed', apiError)
            // Fall through to waiting for WebSocket
          }
        }

        // Step 3: No cache, no API data - wait for WebSocket
        debugLog('⏳ Waiting for recommendations via WebSocket...', {
          isConnected,
          assessmentId
        })
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load recommendations'
        setError(errorMessage)
        debugLog('❌ Error loading recommendations', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadRecommendations()
  }, [assessmentId, token, isAuthenticated, fetchRecommendations, isConnected])

  // Update recommendations (from WebSocket or manual refresh)
  const updateRecommendations = useCallback((newRecommendationSet: RecommendationSet) => {
    debugLog('🔄 Updating recommendations', {
      assessmentId: newRecommendationSet.assessment_id,
      count: newRecommendationSet.recommendations.length
    })
    
    setRecommendations(newRecommendationSet)
    persistRecommendations(newRecommendationSet.assessment_id, newRecommendationSet)
    setError(null)
  }, [])

  // Refresh recommendations from API
  const refreshRecommendations = useCallback(async () => {
    if (!assessmentId) {
      debugLog('❌ Cannot refresh - no assessment ID')
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      debugLog('🔄 Refreshing recommendations', assessmentId)
      const data = await fetchRecommendations(assessmentId)
      
      if (data) {
        setRecommendations(data)
        persistRecommendations(assessmentId, data)
        debugLog('✅ Successfully refreshed recommendations')
        return data
      } else {
        debugLog('⚠️ No recommendations available after refresh')
        return null
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh recommendations'
      setError(errorMessage)
      debugLog('❌ Error refreshing recommendations', err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [assessmentId, fetchRecommendations])

  // Update recommendation status
  const updateRecommendationStatus = useCallback(async (
    recommendationId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'rejected',
    notes?: string
  ) => {
    if (!isAuthenticated || !token) {
      throw new Error('Authentication required')
    }

    try {
      debugLog('🔄 Updating recommendation status', { recommendationId, status })
      
      const response = await fetch(
        `${API_BASE_URL}/recommendations/${recommendationId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status, notes })
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.status}`)
      }

      const updatedRecommendation = await response.json()
      
      // Update local state
      if (recommendations) {
        const updatedSet = {
          ...recommendations,
          recommendations: recommendations.recommendations.map(rec =>
            rec.recommendation_id === recommendationId
              ? { ...rec, status, notes }
              : rec
          )
        }
        updateRecommendations(updatedSet)
      }

      debugLog('✅ Successfully updated recommendation status')
      return updatedRecommendation
    } catch (err) {
      debugLog('❌ Error updating recommendation status', err)
      throw err
    }
  }, [token, isAuthenticated, recommendations, updateRecommendations])

  // Add recommendation rating
  const addRecommendationRating = useCallback(async (
    recommendationId: string,
    rating: number,
    feedback?: string
  ) => {
    if (!isAuthenticated || !token) {
      throw new Error('Authentication required')
    }

    try {
      debugLog('⭐ Adding recommendation rating', { recommendationId, rating })
      
      const response = await fetch(
        `${API_BASE_URL}/recommendations/${recommendationId}/rating`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ rating, feedback })
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to add rating: ${response.status}`)
      }

      const result = await response.json()
      debugLog('✅ Successfully added recommendation rating')
      return result
    } catch (err) {
      debugLog('❌ Error adding recommendation rating', err)
      throw err
    }
  }, [token, isAuthenticated])

  // Clear recommendations
  const clearRecommendations = useCallback(() => {
    debugLog('🗑️ Clearing recommendations', assessmentId)
    setRecommendations(null)
    setError(null)
    if (assessmentId) {
      clearStoredRecommendations(assessmentId)
    }
  }, [assessmentId])

  // Get recommendations by domain
  const getRecommendationsByDomain = useCallback((domain: string) => {
    if (!recommendations) return []
    return recommendations.recommendations.filter(rec => rec.domain === domain)
  }, [recommendations])

  // Get recommendations by priority
  const getRecommendationsByPriority = useCallback((priority: 'high' | 'medium' | 'low') => {
    if (!recommendations) return []
    return recommendations.recommendations.filter(rec => rec.priority === priority)
  }, [recommendations])

  // Get high priority recommendations
  const getHighPriorityRecommendations = useCallback(() => {
    return getRecommendationsByPriority('high')
  }, [getRecommendationsByPriority])

  return {
    // State
    recommendations,
    isLoading,
    error,
    hasRecommendations: recommendations !== null && recommendations.recommendations.length > 0,
    isWebSocketConnected: isConnected,
    
    // Actions
    updateRecommendations,
    refreshRecommendations,
    clearRecommendations,
    updateRecommendationStatus,
    addRecommendationRating,
    
    // Getters
    getRecommendationsByDomain,
    getRecommendationsByPriority,
    getHighPriorityRecommendations
  }
}