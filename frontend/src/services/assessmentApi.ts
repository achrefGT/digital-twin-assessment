import { QueryClient } from '@tanstack/react-query'

// services/assessmentApi.ts
export interface AssessmentProgress {
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

export interface Assessment {
  assessment_id: string
  status: string
  created_at: string
  updated_at?: string
  completed_at?: string
  user_id?: string
  progress?: AssessmentProgress
  [key: string]: any
}

export interface DomainScoresResponse {
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

export interface DomainSubmission {
  domain: string
  responses: Record<string, any>
}

const API_BASE_URL = 'http://localhost:8000'

// Assessment API service class
export class AssessmentAPI {
  private static getHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    return headers
  }

  static async createAssessment(token: string): Promise<Assessment> {
    const response = await fetch(`${API_BASE_URL}/assessments/`, {
      method: 'POST',
      headers: this.getHeaders(token),
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
    
    return {
      ...backendAssessment,
      progress: {
        completed_domains: [],
        completion_percentage: 0,
        domain_scores: {},
        overall_score: null,
        domain_data: {}
      }
    }
  }

  static async fetchAssessment(assessmentId: string, token?: string): Promise<Assessment> {
    const response = await fetch(`${API_BASE_URL}/assessments/${assessmentId}`, {
      headers: this.getHeaders(token)
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Assessment not found')
      }
      if (response.status === 401) {
        throw new Error('Authentication required')
      }
      throw new Error(`Failed to fetch assessment: ${response.status}`)
    }
    
    return response.json()
  }

  // NEW: Fetch user assessments from the backend
  static async fetchUserAssessments(token: string, limit: number = 10): Promise<Assessment[]> {
    const response = await fetch(`${API_BASE_URL}/assessments/my/assessments?limit=${limit}`, {
      headers: this.getHeaders(token)
    })
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication required')
      }
      if (response.status === 403) {
        throw new Error('Access denied')
      }
      throw new Error(`Failed to fetch user assessments: ${response.status}`)
    }
    
    const assessments = await response.json()
    
    // Enhance assessments with progress data
    return assessments.map((assessment: any) => ({
      ...assessment,
      progress: {
        completed_domains: this.extractCompletedDomains(assessment),
        completion_percentage: this.calculateCompletionPercentage(assessment),
        domain_scores: assessment.domain_scores || {},
        overall_score: assessment.overall_score,
        domain_data: assessment.domain_data || {},
        ...assessment.progress
      }
    }))
  }

  static async fetchDomainScores(assessmentId: string, token?: string): Promise<DomainScoresResponse> {
    const response = await fetch(`${API_BASE_URL}/assessments/${assessmentId}/domain-scores/`, {
      headers: this.getHeaders(token)
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Domain scores not found')
      }
      if (response.status === 401) {
        throw new Error('Authentication required')
      }
      throw new Error(`Failed to fetch domain scores: ${response.status}`)
    }
    
    return response.json()
  }

  static async submitDomain(
    assessmentId: string, 
    domain: string, 
    responses: Record<string, any>, 
    token: string
  ): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/assessments/${assessmentId}/submit`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({
        domain,
        form_data: responses
      })
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Session expired. Please log in again.')
      }
      throw new Error(`Failed to submit domain: ${response.status}`)
    }

    return response.json()
  }

  static async deleteAssessment(assessmentId: string, token: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/assessments/${assessmentId}`, {
      method: 'DELETE',
      headers: this.getHeaders(token)
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Session expired. Please log in again.')
      }
      throw new Error(`Failed to delete assessment: ${response.status}`)
    }
  }

  // Helper methods for processing assessment data
  private static extractCompletedDomains(assessment: any): string[] {
    const domains = []
    if (assessment.resilience_submitted) domains.push('resilience')
    if (assessment.sustainability_submitted) domains.push('sustainability') 
    if (assessment.human_centricity_submitted) domains.push('human_centricity')
    return domains
  }

  private static calculateCompletionPercentage(assessment: any): number {
    const totalDomains = 3
    const completedDomains = this.extractCompletedDomains(assessment)
    return (completedDomains.length / totalDomains) * 100
  }

  // Utility function to convert domain scores to assessment format
  static convertDomainScoresToAssessment(
    assessmentId: string, 
    domainScores: DomainScoresResponse
  ): Assessment {
    const extractedDomainScores: Record<string, number> = {}
    const domainData: Record<string, any> = {}
    
    Object.entries(domainScores.domain_results).forEach(([domain, result]) => {
      if (result.overall_score !== undefined) {
        extractedDomainScores[domain] = result.overall_score
      }
      
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
}

// Query keys for React Query
export const assessmentKeys = {
  all: ['assessments'] as const,
  lists: () => [...assessmentKeys.all, 'list'] as const,
  list: (filters: string) => [...assessmentKeys.lists(), { filters }] as const,
  details: () => [...assessmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...assessmentKeys.details(), id] as const,
  domainScores: (id: string) => [...assessmentKeys.detail(id), 'domain-scores'] as const,
  currentAssessmentId: () => ['current-assessment-id'] as const,
  userAssessments: (userId?: string) => [...assessmentKeys.all, 'user', userId] as const,
}

// React Query query functions
export const assessmentQueries = {
  detail: (assessmentId: string, token?: string) => ({
    queryKey: assessmentKeys.detail(assessmentId),
    queryFn: () => AssessmentAPI.fetchAssessment(assessmentId, token),
    staleTime: 30 * 1000, // 30 seconds
  }),

  userAssessments: (token: string, limit: number = 10) => ({
    queryKey: assessmentKeys.userAssessments(),
    queryFn: () => AssessmentAPI.fetchUserAssessments(token, limit),
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!token,
  }),

  domainScores: (assessmentId: string, token?: string) => ({
    queryKey: assessmentKeys.domainScores(assessmentId),
    queryFn: () => AssessmentAPI.fetchDomainScores(assessmentId, token),
    staleTime: 30 * 1000, // 30 seconds
  }),

  // Combined query that tries domain scores first, falls back to basic assessment
  detailWithScores: (assessmentId: string, token?: string) => ({
    queryKey: assessmentKeys.detail(assessmentId),
    queryFn: async () => {
      try {
        const domainScores = await AssessmentAPI.fetchDomainScores(assessmentId, token)
        return AssessmentAPI.convertDomainScoresToAssessment(assessmentId, domainScores)
      } catch (domainError) {
        console.warn('Failed to fetch domain scores, falling back to basic assessment:', domainError)
        return AssessmentAPI.fetchAssessment(assessmentId, token)
      }
    },
    staleTime: 30 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('Authentication required') || 
          error?.message?.includes('not found')) {
        return false
      }
      return failureCount < 2
    }
  }),

  currentAssessmentId: () => ({
    queryKey: assessmentKeys.currentAssessmentId(),
    queryFn: () => {
      // Return the in-memory current assessment ID
      return (window as any).__currentAssessmentId__ || null
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// React Query mutation functions
export const assessmentMutations = {
  create: (token: string) => ({
    mutationFn: () => AssessmentAPI.createAssessment(token),
    onSuccess: (assessment: Assessment) => {
      // Store current assessment ID in memory
      (window as any).__currentAssessmentId__ = assessment.assessment_id
    }
  }),

  submitDomain: (token: string) => ({
    mutationFn: ({ assessmentId, domain, responses }: { 
      assessmentId: string
      domain: string 
      responses: Record<string, any> 
    }) => AssessmentAPI.submitDomain(assessmentId, domain, responses, token)
  }),

  delete: (token: string) => ({
    mutationFn: (assessmentId: string) => AssessmentAPI.deleteAssessment(assessmentId, token),
    onSuccess: () => {
      // Clear current assessment ID
      (window as any).__currentAssessmentId__ = null
    }
  })
}

// Enhanced query client configuration
export const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Global query defaults
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000, // 5 minutes
        retry: (failureCount, error: any) => {
          // Don't retry on authentication or not found errors
          if (error?.message?.includes('401') || 
              error?.message?.includes('403') ||
              error?.message?.includes('Authentication required') ||
              error?.message?.includes('not found')) {
            return false
          }
          return failureCount < 2
        },
        refetchOnWindowFocus: false,
        refetchOnMount: true,
        refetchOnReconnect: true,
      },
      mutations: {
        // Global mutation defaults
        retry: 1,
        onError: (error: any) => {
          console.error('Mutation error:', error)
          // Could add global error handling here (toast notifications, etc.)
        }
      }
    }
  })
}

// Assessment utilities for managing state
export const AssessmentUtils = {
  // Set current assessment ID in memory
  setCurrentAssessmentId: (assessmentId: string | null) => {
    (window as any).__currentAssessmentId__ = assessmentId
  },

  // Get current assessment ID from memory
  getCurrentAssessmentId: (): string | null => {
    return (window as any).__currentAssessmentId__ || null
  },

  // Clear current assessment ID
  clearCurrentAssessmentId: () => {
    (window as any).__currentAssessmentId__ = null
  },

  // Check if assessment is completed
  isAssessmentCompleted: (assessment: Assessment): boolean => {
    return assessment.status === 'COMPLETED' || 
           assessment.progress?.completion_percentage === 100
  },

  // Calculate completion percentage
  calculateCompletionPercentage: (
    completedDomains: string[], 
    totalDomains: string[]
  ): number => {
    if (totalDomains.length === 0) return 0
    return (completedDomains.length / totalDomains.length) * 100
  },

  // Get assessment summary
  getAssessmentSummary: (assessment: Assessment) => {
    const progress = assessment.progress
    return {
      id: assessment.assessment_id,
      status: assessment.status,
      completedDomains: progress?.completed_domains?.length || 0,
      totalDomains: ['human_centricity', 'resilience', 'sustainability'].length,
      overallScore: progress?.overall_score,
      completionPercentage: progress?.completion_percentage || 0,
      createdAt: assessment.created_at,
      updatedAt: assessment.updated_at
    }
  }
}