import { useState, useEffect, useCallback } from 'react'
import { useAuth } from "@/auth"
import { useQueryClient } from '@tanstack/react-query'
import useWebSocket, { WebSocketMessage } from './useWebSocket'
import { recommendationKeys } from '@/services/recommendationsApi'

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
  LAST_RECOMMENDATION_SET_ID: 'lastRecommendationSetId',
  CACHE_TIMESTAMP: 'recommendationsCacheTimestamp',
  CACHE_SOURCE: 'recommendationsCacheSource'
}

const CACHE_CONFIG = {
  TTL_MS: 60 * 60 * 1000, // 1 hour cache TTL
  PREFER_CACHE_THRESHOLD: 5 * 60 * 1000 // Prefer cache if less than 5 minutes old
}

const API_BASE_URL = 'http://localhost:8000'

// Debug logging
const debugLog = (message: string, data?: any) => {
  console.log(`[DEBUG useRecommendations] ${message}`, data || '')
}

// ==================== CACHE MANAGEMENT ====================

interface CacheMetadata {
  timestamp: number
  source: 'api' | 'websocket' | 'localStorage'
  assessmentId: string
}

// Persist recommendations with cache metadata
const persistRecommendations = (
  assessmentId: string, 
  recommendationSet: RecommendationSet,
  source: 'api' | 'websocket' = 'api'
) => {
  try {
    const key = `${STORAGE_KEYS.RECOMMENDATIONS}_${assessmentId}`
    const timestampKey = `${STORAGE_KEYS.CACHE_TIMESTAMP}_${assessmentId}`
    const sourceKey = `${STORAGE_KEYS.CACHE_SOURCE}_${assessmentId}`
    
    localStorage.setItem(key, JSON.stringify(recommendationSet))
    localStorage.setItem(timestampKey, Date.now().toString())
    localStorage.setItem(sourceKey, source)
    localStorage.setItem(STORAGE_KEYS.LAST_RECOMMENDATION_SET_ID, recommendationSet.recommendation_set_id)
    
    debugLog('✅ Persisted recommendations to cache', { 
      assessmentId, 
      count: recommendationSet.recommendations.length,
      source 
    })
    return true
  } catch (error) {
    debugLog('❌ Failed to persist recommendations', error)
    return false
  }
}

// Load recommendations with cache validation
const loadStoredRecommendations = (assessmentId: string): {
  data: RecommendationSet | null
  metadata: CacheMetadata | null
  isExpired: boolean
} => {
  try {
    const key = `${STORAGE_KEYS.RECOMMENDATIONS}_${assessmentId}`
    const timestampKey = `${STORAGE_KEYS.CACHE_TIMESTAMP}_${assessmentId}`
    const sourceKey = `${STORAGE_KEYS.CACHE_SOURCE}_${assessmentId}`
    
    const stored = localStorage.getItem(key)
    const timestamp = localStorage.getItem(timestampKey)
    const source = localStorage.getItem(sourceKey)
    
    if (!stored || !timestamp) {
      debugLog('No cached recommendations found', assessmentId)
      return { data: null, metadata: null, isExpired: true }
    }
    
    const recommendationSet = JSON.parse(stored)
    const cacheAge = Date.now() - parseInt(timestamp)
    const isExpired = cacheAge > CACHE_CONFIG.TTL_MS
    
    const metadata: CacheMetadata = {
      timestamp: parseInt(timestamp),
      source: (source as 'api' | 'websocket' | 'localStorage') || 'localStorage',
      assessmentId
    }
    
    debugLog('📦 Loaded recommendations from cache', {
      assessmentId,
      count: recommendationSet.recommendations.length,
      cacheAge: `${Math.round(cacheAge / 1000)}s`,
      isExpired,
      source: metadata.source
    })
    
    return { data: recommendationSet, metadata, isExpired }
    
  } catch (error) {
    debugLog('❌ Failed to load cached recommendations', error)
    return { data: null, metadata: null, isExpired: true }
  }
}

// Check if cache is fresh enough to use
const isCacheFresh = (metadata: CacheMetadata | null): boolean => {
  if (!metadata) return false
  const cacheAge = Date.now() - metadata.timestamp
  return cacheAge < CACHE_CONFIG.PREFER_CACHE_THRESHOLD
}

// Clear recommendations cache
const clearStoredRecommendations = (assessmentId?: string) => {
  try {
    if (assessmentId) {
      const key = `${STORAGE_KEYS.RECOMMENDATIONS}_${assessmentId}`
      const timestampKey = `${STORAGE_KEYS.CACHE_TIMESTAMP}_${assessmentId}`
      const sourceKey = `${STORAGE_KEYS.CACHE_SOURCE}_${assessmentId}`
      
      localStorage.removeItem(key)
      localStorage.removeItem(timestampKey)
      localStorage.removeItem(sourceKey)
      debugLog('🗑️ Cleared recommendations cache for assessment', assessmentId)
    } else {
      // Clear all recommendation data
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(STORAGE_KEYS.RECOMMENDATIONS) ||
            key.startsWith(STORAGE_KEYS.CACHE_TIMESTAMP) ||
            key.startsWith(STORAGE_KEYS.CACHE_SOURCE)) {
          localStorage.removeItem(key)
        }
      })
      localStorage.removeItem(STORAGE_KEYS.LAST_RECOMMENDATION_SET_ID)
      debugLog('🗑️ Cleared all recommendations cache')
    }
  } catch (error) {
    debugLog('❌ Failed to clear recommendations cache', error)
  }
}

// ==================== WEBSOCKET CONVERSION ====================

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

// ==================== MAIN HOOK ====================

export const useRecommendations = (assessmentId?: string) => {
  const [recommendations, setRecommendations] = useState<RecommendationSet | null>(null)
  const [cacheMetadata, setCacheMetadata] = useState<CacheMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { token, isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  // 🔥 Connect to WebSocket for real-time recommendations
  const { messages, isConnected } = useWebSocket(assessmentId || '', !!assessmentId)

  // Invalidate React Query cache
  const invalidateQueries = useCallback(() => {
    if (!assessmentId) return
    
    debugLog('🔄 Invalidating React Query cache', assessmentId)
    queryClient.invalidateQueries({ 
      queryKey: recommendationKeys.byAssessment(assessmentId) 
    })
    queryClient.invalidateQueries({ 
      queryKey: recommendationKeys.all 
    })
  }, [assessmentId, queryClient])

  // Fetch recommendations from API with Redis caching
  const fetchRecommendations = useCallback(async (
    targetAssessmentId: string,
    latestOnly: boolean = true,
    bypassCache: boolean = false
  ): Promise<RecommendationSet | null> => {
    try {
      debugLog('🌐 Fetching recommendations from API', { 
        targetAssessmentId, 
        bypassCache 
      })
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      
      if (isAuthenticated && token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      // Add cache bypass parameter
      const url = new URL(
        `${API_BASE_URL}/api/recommendations/assessment/${targetAssessmentId}`
      )
      url.searchParams.set('latest_only', latestOnly.toString())
      if (bypassCache) {
        url.searchParams.set('bypass_cache', 'true')
      }
      
      const response = await fetch(url.toString(), { headers })
      
      if (!response.ok) {
        if (response.status === 404) {
          debugLog('⚠️ No recommendations found in backend', targetAssessmentId)
          return null
        }
        throw new Error(`Failed to fetch recommendations: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Check if data came from Redis cache
      const cacheHit = response.headers.get('X-Cache-Hit') === 'true'
      debugLog('✅ Fetched recommendations from API', {
        assessmentId: targetAssessmentId,
        count: data.recommendations?.length || 0,
        cacheHit
      })
      
      return data
    } catch (err) {
      debugLog('❌ Error fetching recommendations', err)
      throw err
    }
  }, [token, isAuthenticated])

  // 🔥 Listen to WebSocket messages for real-time recommendations
  useEffect(() => {
    if (!assessmentId || !messages || messages.length === 0) {
      return
    }

    const latestMessage = messages[messages.length - 1]
    
    debugLog('📨 Processing WebSocket message', {
      type: latestMessage.type,
      hasRecommendations: !!latestMessage.recommendations
    })

    if (latestMessage.type === 'recommendations_ready') {
      debugLog('🎯 Received recommendations via WebSocket', {
        count: latestMessage.recommendations?.length || 0,
        source: latestMessage.source
      })

      const recommendationSet = convertWebSocketToRecommendationSet(latestMessage)
      
      if (recommendationSet) {
        setRecommendations(recommendationSet)
        persistRecommendations(assessmentId, recommendationSet, 'websocket')
        setCacheMetadata({
          timestamp: Date.now(),
          source: 'websocket',
          assessmentId
        })
        setError(null)
        invalidateQueries()
        
        debugLog('✅ Recommendations received and cached from WebSocket', {
          count: recommendationSet.recommendations.length,
          assessment_id: recommendationSet.assessment_id
        })
      }
    }
  }, [messages, assessmentId, invalidateQueries])

  // Load recommendations on mount (Cache-First Strategy)
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!assessmentId) {
        debugLog('⚠️ No assessment ID provided')
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // Step 1: Check localStorage cache first (instant)
        const { data: cachedData, metadata, isExpired } = loadStoredRecommendations(assessmentId)
        
        if (cachedData && !isExpired) {
          // Cache hit - use immediately
          setRecommendations(cachedData)
          setCacheMetadata(metadata)
          debugLog('⚡ Using fresh cache (instant)', {
            cacheAge: `${Math.round((Date.now() - (metadata?.timestamp || 0)) / 1000)}s`
          })
          setIsLoading(false)
          
          // Still fetch fresh data in background if authenticated
          if (isAuthenticated && token && !isCacheFresh(metadata)) {
            debugLog('🔄 Refreshing cache in background')
            try {
              const apiData = await fetchRecommendations(assessmentId)
              if (apiData && apiData.created_at > cachedData.created_at) {
                debugLog('📝 Updating with fresher API data')
                setRecommendations(apiData)
                persistRecommendations(assessmentId, apiData, 'api')
                setCacheMetadata({
                  timestamp: Date.now(),
                  source: 'api',
                  assessmentId
                })
                invalidateQueries()
              }
            } catch (apiError) {
              debugLog('⚠️ Background refresh failed, cache still valid', apiError)
            }
          }
          
          return
        }
        
        if (cachedData && isExpired) {
          // Expired cache - use as stale-while-revalidate
          setRecommendations(cachedData)
          setCacheMetadata(metadata)
          debugLog('⏰ Using expired cache while revalidating')
        }

        // Step 2: Fetch from API if authenticated (goes through Redis cache)
        if (isAuthenticated && token) {
          try {
            const apiData = await fetchRecommendations(assessmentId)
            
            if (apiData) {
              setRecommendations(apiData)
              persistRecommendations(assessmentId, apiData, 'api')
              setCacheMetadata({
                timestamp: Date.now(),
                source: 'api',
                assessmentId
              })
              invalidateQueries()
              debugLog('✅ Loaded recommendations from API (via Redis)')
              setIsLoading(false)
              return
            }
          } catch (apiError) {
            debugLog('⚠️ API fetch failed', apiError)
            // If we have stale cache, keep using it
            if (cachedData) {
              debugLog('📦 Falling back to stale cache')
              setError('Using cached data (unable to refresh)')
              setIsLoading(false)
              return
            }
          }
        }

        // Step 3: No cache, no API data - wait for WebSocket
        if (!cachedData) {
          debugLog('⏳ Waiting for recommendations via WebSocket...', {
            isConnected,
            assessmentId
          })
        }
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load recommendations'
        setError(errorMessage)
        debugLog('❌ Error loading recommendations', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadRecommendations()
  }, [assessmentId, token, isAuthenticated, fetchRecommendations, isConnected, invalidateQueries])

  // Update recommendations
  const updateRecommendations = useCallback((
    newRecommendationSet: RecommendationSet,
    source: 'api' | 'websocket' | 'localStorage' = 'api'
  ) => {
    debugLog('📝 Updating recommendations', {
      assessmentId: newRecommendationSet.assessment_id,
      count: newRecommendationSet.recommendations.length,
      source
    })
    
    setRecommendations(newRecommendationSet)
    persistRecommendations(newRecommendationSet.assessment_id, newRecommendationSet, source === 'localStorage' ? 'api' : source)
    setCacheMetadata({
      timestamp: Date.now(),
      source,
      assessmentId: newRecommendationSet.assessment_id
    })
    setError(null)
    invalidateQueries()
  }, [invalidateQueries])

  // Refresh recommendations from API (bypass cache)
  const refreshRecommendations = useCallback(async (bypassCache: boolean = false) => {
    if (!assessmentId) {
      debugLog('❌ Cannot refresh - no assessment ID')
      return null
    }

    setIsLoading(true)
    setError(null)

    try {
      debugLog('🔄 Refreshing recommendations', { assessmentId, bypassCache })
      const data = await fetchRecommendations(assessmentId, true, bypassCache)
      
      if (data) {
        setRecommendations(data)
        persistRecommendations(assessmentId, data, 'api')
        setCacheMetadata({
          timestamp: Date.now(),
          source: 'api',
          assessmentId
        })
        invalidateQueries()
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
  }, [assessmentId, fetchRecommendations, invalidateQueries])

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
      debugLog('📝 Updating recommendation status', { recommendationId, status })
      
      const response = await fetch(
        `${API_BASE_URL}/api/recommendations/${recommendationId}/status`,
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
      
      // Update local state and cache
      if (recommendations) {
        const updatedSet = {
          ...recommendations,
          recommendations: recommendations.recommendations.map(rec =>
            rec.recommendation_id === recommendationId
              ? { ...rec, status, notes }
              : rec
          )
        }
        updateRecommendations(updatedSet, cacheMetadata?.source || 'api')
      }

      debugLog('✅ Successfully updated recommendation status')
      return updatedRecommendation
    } catch (err) {
      debugLog('❌ Error updating recommendation status', err)
      throw err
    }
  }, [token, isAuthenticated, recommendations, updateRecommendations, cacheMetadata])

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
        `${API_BASE_URL}/api/recommendations/${recommendationId}/rating`,
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

  // Clear recommendations and cache
  const clearRecommendations = useCallback(() => {
    debugLog('🗑️ Clearing recommendations', assessmentId)
    setRecommendations(null)
    setCacheMetadata(null)
    setError(null)
    if (assessmentId) {
      clearStoredRecommendations(assessmentId)
    }
    invalidateQueries()
  }, [assessmentId, invalidateQueries])

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
    cacheMetadata,
    isCacheFresh: cacheMetadata ? isCacheFresh(cacheMetadata) : false,
    
    // Actions
    updateRecommendations,
    refreshRecommendations,
    clearRecommendations,
    updateRecommendationStatus,
    addRecommendationRating,
    
    // Getters
    getRecommendationsByDomain,
    getRecommendationsByPriority,
    getHighPriorityRecommendations,
    
    // Force refresh bypassing all caches
    forceRefresh: () => refreshRecommendations(true)
  }
}