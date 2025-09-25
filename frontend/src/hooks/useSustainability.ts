import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  SustainabilityAPI, 
  sustainabilityKeys, 
  sustainabilityQueries, 
  sustainabilityMutations,
  type SustainabilityScenarios,
  type CriterionResponse,
  type CriterionCreate,
  type CriterionUpdate 
} from '@/services/sustainabilityApi'

const SUSTAINABILITY_DOMAINS = ['environmental', 'economic', 'social']

export const useSustainability = () => {
  const queryClient = useQueryClient()
  
  // Main scenarios query
  const {
    data: scenarios,
    isLoading: scenariosLoading,
    error: scenariosError,
    refetch: refetchScenarios
  } = useQuery(sustainabilityQueries.scenarios())
  
  // All criteria with metadata
  const {
    data: allCriteria,
    isLoading: allCriteriaLoading,
    error: allCriteriaError,
    refetch: refetchAllCriteria
  } = useQuery(sustainabilityQueries.allCriteria())

  // Derived state
  const availableDomains = scenarios ? SustainabilityAPI.extractAvailableDomains(scenarios) : []
  const isReady = !scenariosLoading && !scenariosError && scenarios

  // Query function for specific domain
  const getCriteriaForDomain = useCallback(async (domain: string) => {
    return queryClient.fetchQuery(sustainabilityQueries.domain(domain))
  }, [queryClient])

  // Helper function 
  const getScenariosForDomains = useCallback((selectedDomains: string[]) => {
    if (!scenarios) return {}
    return SustainabilityAPI.getScenariosForDomains(scenarios, selectedDomains)
  }, [scenarios])

  // Mutations
  const addCriterionMutation = useMutation({
    ...sustainabilityMutations.create(),
    onSuccess: (newCriterion) => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: sustainabilityKeys.scenarios() })
      queryClient.invalidateQueries({ queryKey: sustainabilityKeys.allCriteria() })
      queryClient.invalidateQueries({ queryKey: sustainabilityKeys.domain(newCriterion.domain) })
    }
  })

  const editCriterionMutation = useMutation({
    ...sustainabilityMutations.update(),
    onSuccess: (updatedCriterion) => {
      queryClient.invalidateQueries({ queryKey: sustainabilityKeys.scenarios() })
      queryClient.invalidateQueries({ queryKey: sustainabilityKeys.allCriteria() })
      queryClient.invalidateQueries({ queryKey: sustainabilityKeys.domain(updatedCriterion.domain) })
    }
  })

  const deleteCriterionMutation = useMutation({
    ...sustainabilityMutations.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sustainabilityKeys.all })
    }
  })

  const resetCriteriaMutation = useMutation({
    ...sustainabilityMutations.reset(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sustainabilityKeys.all })
    }
  })

  const validateCriteriaMutation = useMutation({
    ...sustainabilityMutations.validate()
  })

  // Wrapper functions for mutations
  const addCriterion = useCallback(async (criterionData: CriterionCreate) => {
    return addCriterionMutation.mutateAsync(criterionData)
  }, [addCriterionMutation])

  const editCriterion = useCallback(async (criterionId: string, updateData: CriterionUpdate) => {
    return editCriterionMutation.mutateAsync({ criterionId, update: updateData })
  }, [editCriterionMutation])

  const removeCriterion = useCallback(async (criterionId: string) => {
    return deleteCriterionMutation.mutateAsync(criterionId)
  }, [deleteCriterionMutation])

  const resetToDefaults = useCallback(async (domain?: string) => {
    return resetCriteriaMutation.mutateAsync(domain)
  }, [resetCriteriaMutation])

  const validateCriteria = useCallback(async (assessments: Record<string, any>) => {
    return validateCriteriaMutation.mutateAsync(assessments)
  }, [validateCriteriaMutation])

  return {
    // Data
    scenarios,
    allCriteria,
    availableDomains,
    
    // Loading states
    isLoading: scenariosLoading,
    allCriteriaLoading,
    isReady,
    
    // Error states
    error: scenariosError,
    allCriteriaError,
    
    // Query functions
    getCriteriaForDomain,
    getScenariosForDomains,
    refetchScenarios,
    refetchAllCriteria,
    
    // Mutations with loading states
    addCriterion,
    editCriterion,
    removeCriterion,
    resetToDefaults,
    validateCriteria,
    
    // Mutation states
    isAdding: addCriterionMutation.isPending,
    isEditing: editCriterionMutation.isPending,
    isDeleting: deleteCriterionMutation.isPending,
    isResetting: resetCriteriaMutation.isPending,
    isValidating: validateCriteriaMutation.isPending,
    
    // Constants
    SUSTAINABILITY_DOMAINS,
  }
}