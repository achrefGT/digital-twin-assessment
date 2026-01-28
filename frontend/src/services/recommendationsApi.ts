import { QueryClient } from '@tanstack/react-query'

// ==================== INTERFACES ====================

export interface Recommendation {
  recommendation_id: string
  domain: string
  category: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  estimated_impact?: string
  implementation_effort?: string
  source: string
  criterion_id?: string
  confidence_score?: number
  status?: 'pending' | 'in_progress' | 'completed' | 'rejected'
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface RecommendationSet {
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

export interface RecommendationStatusUpdate {
  status: 'pending' | 'in_progress' | 'completed' | 'rejected'
  notes?: string
}

export interface RecommendationRating {
  rating: number
  feedback?: string
}

const API_BASE_URL = 'http://localhost:8000'

// ==================== API SERVICE ====================

export class RecommendationsAPI {
  private static getHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    return headers
  }

  /**
   * Fetch recommendations for a specific assessment
   * This endpoint uses Redis cache-aside pattern on the backend
   */
  static async fetchByAssessment(
    assessmentId: string,
    token?: string,
    latestOnly: boolean = true,
    bypassCache: boolean = false
  ): Promise<RecommendationSet> {
    const url = new URL(
      `${API_BASE_URL}/api/recommendations/assessment/${assessmentId}`
    )
    url.searchParams.set('latest_only', latestOnly.toString())
    
    // Allow forcing cache bypass for admin testing
    if (bypassCache) {
      url.searchParams.set('bypass_cache', 'true')
    }
    
    const response = await fetch(url.toString(), { 
      headers: this.getHeaders(token) 
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Recommendations not found')
      }
      if (response.status === 401) {
        throw new Error('Authentication required')
      }
      throw new Error(`Failed to fetch recommendations: ${response.status}`)
    }
    
    const data = await response.json()
    
    // Log cache hit information for debugging
    const cacheHit = response.headers.get('X-Cache-Hit')
    const cacheSource = response.headers.get('X-Cache-Source')
    if (cacheHit === 'true') {
      console.log(`✅ Cache hit from ${cacheSource || 'unknown'}`)
    } else {
      console.log(`❌ Cache miss - fetched from source`)
    }
    
    return data
  }

  /**
   * Fetch all recommendation sets for current user
   */
  static async fetchUserRecommendations(
    token: string,
    limit: number = 10
  ): Promise<RecommendationSet[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/recommendations/my/recommendations?limit=${limit}`,
      { headers: this.getHeaders(token) }
    )
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required')
      }
      throw new Error(`Failed to fetch user recommendations: ${response.status}`)
    }
    
    return response.json()
  }

  /**
   * Fetch specific recommendation set by ID
   */
  static async fetchById(
    recommendationSetId: string,
    token?: string
  ): Promise<RecommendationSet> {
    const response = await fetch(
      `${API_BASE_URL}/api/recommendations/${recommendationSetId}`,
      { headers: this.getHeaders(token) }
    )
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Recommendation set not found')
      }
      if (response.status === 401) {
        throw new Error('Authentication required')
      }
      throw new Error(`Failed to fetch recommendation set: ${response.status}`)
    }
    
    return response.json()
  }

  /**
   * Update recommendation status
   * This invalidates the cache on the backend
   */
  static async updateStatus(
    recommendationId: string,
    statusUpdate: RecommendationStatusUpdate,
    token: string
  ): Promise<Recommendation> {
    const response = await fetch(
      `${API_BASE_URL}/api/recommendations/${recommendationId}/status`,
      {
        method: 'PATCH',
        headers: this.getHeaders(token),
        body: JSON.stringify(statusUpdate)
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Recommendation not found')
      }
      if (response.status === 401) {
        throw new Error('Session expired. Please log in again.')
      }
      throw new Error(`Failed to update recommendation status: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Add recommendation rating
   */
  static async addRating(
    recommendationId: string,
    rating: RecommendationRating,
    token: string
  ): Promise<any> {
    const response = await fetch(
      `${API_BASE_URL}/api/recommendations/${recommendationId}/rating`,
      {
        method: 'POST',
        headers: this.getHeaders(token),
        body: JSON.stringify(rating)
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Recommendation not found')
      }
      if (response.status === 401) {
        throw new Error('Session expired. Please log in again.')
      }
      throw new Error(`Failed to add rating: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Invalidate recommendation cache (admin only)
   */
  static async invalidateCache(
    assessmentId: string,
    token: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${API_BASE_URL}/api/recommendations/cache/assessment/${assessmentId}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(token)
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to invalidate cache: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get cache statistics (admin only)
   */
  static async getCacheStats(token: string): Promise<any> {
    const response = await fetch(
      `${API_BASE_URL}/api/recommendations/cache/statistics`,
      { headers: this.getHeaders(token) }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch cache stats: ${response.status}`)
    }

    return response.json()
  }
}

// ==================== QUERY KEYS ====================

export const recommendationKeys = {
  all: ['recommendations'] as const,
  lists: () => [...recommendationKeys.all, 'list'] as const,
  list: (filters: string) => [...recommendationKeys.lists(), { filters }] as const,
  details: () => [...recommendationKeys.all, 'detail'] as const,
  detail: (id: string) => [...recommendationKeys.details(), id] as const,
  byAssessment: (assessmentId: string) => [...recommendationKeys.all, 'assessment', assessmentId] as const,
  userRecommendations: (userId?: string) => [...recommendationKeys.all, 'user', userId] as const,
}

// ==================== REACT QUERY FUNCTIONS ====================

export const recommendationQueries = {
  byAssessment: (
    assessmentId: string, 
    token?: string, 
    latestOnly: boolean = true,
    bypassCache: boolean = false
  ) => ({
    queryKey: recommendationKeys.byAssessment(assessmentId),
    queryFn: () => RecommendationsAPI.fetchByAssessment(assessmentId, token, latestOnly, bypassCache),
    staleTime: 0, // Always check for updates (relies on cache-aside pattern)
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!assessmentId,
    refetchOnMount: true,
    refetchOnWindowFocus: false, // Rely on cache for performance
    retry: (failureCount, error: any) => {
      // Don't retry if not found or unauthorized
      if (error?.message?.includes('not found') || 
          error?.message?.includes('Authentication required')) {
        return false
      }
      return failureCount < 2
    }
  }),

  userRecommendations: (token: string, limit: number = 10) => ({
    queryKey: recommendationKeys.userRecommendations(),
    queryFn: () => RecommendationsAPI.fetchUserRecommendations(token, limit),
    staleTime: 0, // Always check cache
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!token,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  }),

  byId: (recommendationSetId: string, token?: string) => ({
    queryKey: recommendationKeys.detail(recommendationSetId),
    queryFn: () => RecommendationsAPI.fetchById(recommendationSetId, token),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!recommendationSetId,
  })
}

// ==================== REACT QUERY MUTATIONS ====================

export const recommendationMutations = {
  updateStatus: (token: string, queryClient: QueryClient) => ({
    mutationFn: ({ 
      recommendationId, 
      statusUpdate 
    }: { 
      recommendationId: string
      statusUpdate: RecommendationStatusUpdate
    }) => RecommendationsAPI.updateStatus(recommendationId, statusUpdate, token),
    
    onSuccess: (_data: any, variables: any) => {
      // Invalidate relevant queries to trigger refetch
      queryClient.invalidateQueries({ 
        queryKey: recommendationKeys.all 
      })
      
      console.log('✅ Invalidated recommendation queries after status update')
    }
  }),

  addRating: (token: string, queryClient: QueryClient) => ({
    mutationFn: ({ 
      recommendationId, 
      rating 
    }: { 
      recommendationId: string
      rating: RecommendationRating
    }) => RecommendationsAPI.addRating(recommendationId, rating, token),
    
    onSuccess: () => {
      // Invalidate recommendation queries
      queryClient.invalidateQueries({ 
        queryKey: recommendationKeys.all 
      })
      
      console.log('✅ Invalidated recommendation queries after rating')
    }
  }),

  invalidateCache: (token: string, queryClient: QueryClient) => ({
    mutationFn: (assessmentId: string) => 
      RecommendationsAPI.invalidateCache(assessmentId, token),
    
    onSuccess: (_data: any, assessmentId: string) => {
      // Invalidate React Query cache
      queryClient.invalidateQueries({ 
        queryKey: recommendationKeys.byAssessment(assessmentId) 
      })
      
      // Also clear localStorage cache
      try {
        const key = `assessmentRecommendations_${assessmentId}`
        const timestampKey = `recommendationsCacheTimestamp_${assessmentId}`
        const sourceKey = `recommendationsCacheSource_${assessmentId}`
        
        localStorage.removeItem(key)
        localStorage.removeItem(timestampKey)
        localStorage.removeItem(sourceKey)
        
        console.log('✅ Invalidated all caches for assessment', assessmentId)
      } catch (error) {
        console.warn('Failed to clear localStorage cache', error)
      }
    }
  })
}

// ==================== UTILITY FUNCTIONS ====================

export const RecommendationUtils = {
  /**
   * Group recommendations by domain
   */
  groupByDomain: (recommendations: Recommendation[]): Record<string, Recommendation[]> => {
    return recommendations.reduce((acc, rec) => {
      if (!acc[rec.domain]) {
        acc[rec.domain] = []
      }
      acc[rec.domain].push(rec)
      return acc
    }, {} as Record<string, Recommendation[]>)
  },

  /**
   * Group recommendations by priority
   */
  groupByPriority: (recommendations: Recommendation[]): Record<string, Recommendation[]> => {
    return recommendations.reduce((acc, rec) => {
      if (!acc[rec.priority]) {
        acc[rec.priority] = []
      }
      acc[rec.priority].push(rec)
      return acc
    }, {} as Record<string, Recommendation[]>)
  },

  /**
   * Filter recommendations by status
   */
  filterByStatus: (
    recommendations: Recommendation[], 
    status: 'pending' | 'in_progress' | 'completed' | 'rejected'
  ): Recommendation[] => {
    return recommendations.filter(rec => rec.status === status)
  },

  /**
   * Get high priority recommendations
   */
  getHighPriority: (recommendations: Recommendation[]): Recommendation[] => {
    return recommendations.filter(rec => rec.priority === 'high')
  },

  /**
   * Calculate completion percentage
   */
  getCompletionPercentage: (recommendations: Recommendation[]): number => {
    if (recommendations.length === 0) return 0
    const completed = recommendations.filter(rec => rec.status === 'completed').length
    return Math.round((completed / recommendations.length) * 100)
  },

  /**
   * Get summary statistics
   */
  getSummaryStats: (recommendations: Recommendation[]) => {
    const total = recommendations.length
    const byStatus = {
      pending: recommendations.filter(r => r.status === 'pending').length,
      in_progress: recommendations.filter(r => r.status === 'in_progress').length,
      completed: recommendations.filter(r => r.status === 'completed').length,
      rejected: recommendations.filter(r => r.status === 'rejected').length
    }
    const byPriority = {
      high: recommendations.filter(r => r.priority === 'high').length,
      medium: recommendations.filter(r => r.priority === 'medium').length,
      low: recommendations.filter(r => r.priority === 'low').length
    }

    return {
      total,
      byStatus,
      byPriority,
      completionPercentage: RecommendationUtils.getCompletionPercentage(recommendations)
    }
  },

  /**
   * Sort recommendations by priority
   */
  sortByPriority: (recommendations: Recommendation[]): Recommendation[] => {
    const priorityOrder = { high: 1, medium: 2, low: 3 }
    return [...recommendations].sort((a, b) => 
      priorityOrder[a.priority] - priorityOrder[b.priority]
    )
  },

  /**
   * Format recommendation for display
   */
  formatRecommendation: (rec: Recommendation) => {
    return {
      id: rec.recommendation_id,
      title: rec.title,
      description: rec.description,
      priority: rec.priority,
      domain: rec.domain.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      category: rec.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      status: rec.status || 'pending',
      impact: rec.estimated_impact,
      effort: rec.implementation_effort,
      confidence: rec.confidence_score ? `${Math.round(rec.confidence_score * 100)}%` : null
    }
  }
}