// hooks/useScenarios.ts
import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  ScenariosAPI, 
  scenarioKeys, 
  scenarioQueries, 
  scenarioMutations,
  type ResilienceScenarios,
  type ScenarioResponse,
  type ScenarioCreate,
  type ScenarioUpdate 
} from '@/services/scenariosApi'

const RESILIENCE_DOMAINS = ['Robustness', 'Redundancy', 'Adaptability', 'Rapidity', 'PHM']

export const useScenarios = () => {
  const queryClient = useQueryClient()
  
  // Main scenarios query
  const {
    data: scenarios,
    isLoading: scenariosLoading,
    error: scenariosError,
    refetch: refetchScenarios
  } = useQuery(scenarioQueries.scenarios())
  
  // All scenarios with metadata
  const {
    data: allScenarios,
    isLoading: allScenariosLoading,
    error: allScenariosError,
    refetch: refetchAllScenarios
  } = useQuery(scenarioQueries.allScenarios())

  // Derived state
  const availableDomains = scenarios ? ScenariosAPI.extractAvailableDomains(scenarios) : []
  const isReady = !scenariosLoading && !scenariosError && scenarios

  // Query function for specific domain
  const getScenariosForDomain = useCallback(async (domain: string) => {
    return queryClient.fetchQuery(scenarioQueries.domain(domain))
  }, [queryClient])

  // Helper function 
  const getScenariosForDomains = useCallback((selectedDomains: string[]) => {
    if (!scenarios) return {}
    return ScenariosAPI.getScenariosForDomains(scenarios, selectedDomains)
  }, [scenarios])

  // Mutations
  const addScenarioMutation = useMutation({
    ...scenarioMutations.create(),
    onSuccess: (newScenario) => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: scenarioKeys.scenarios() })
      queryClient.invalidateQueries({ queryKey: scenarioKeys.allScenarios() })
      queryClient.invalidateQueries({ queryKey: scenarioKeys.domain(newScenario.domain) })
    }
  })

  const editScenarioMutation = useMutation({
    ...scenarioMutations.update(),
    onSuccess: (updatedScenario) => {
      queryClient.invalidateQueries({ queryKey: scenarioKeys.scenarios() })
      queryClient.invalidateQueries({ queryKey: scenarioKeys.allScenarios() })
      queryClient.invalidateQueries({ queryKey: scenarioKeys.domain(updatedScenario.domain) })
    }
  })

  const deleteScenarioMutation = useMutation({
    ...scenarioMutations.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scenarioKeys.all })
    }
  })

  const resetScenariosMutation = useMutation({
    ...scenarioMutations.reset(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scenarioKeys.all })
    }
  })

  const validateScenariosMutation = useMutation({
    ...scenarioMutations.validate()
  })

  // Wrapper functions for mutations
  const addScenario = useCallback(async (scenarioData: ScenarioCreate) => {
    return addScenarioMutation.mutateAsync(scenarioData)
  }, [addScenarioMutation])

  const editScenario = useCallback(async (scenarioId: string, updateData: ScenarioUpdate) => {
    return editScenarioMutation.mutateAsync({ scenarioId, update: updateData })
  }, [editScenarioMutation])

  const removeScenario = useCallback(async (scenarioId: string) => {
    return deleteScenarioMutation.mutateAsync(scenarioId)
  }, [deleteScenarioMutation])

  const resetToDefaults = useCallback(async (domain?: string) => {
    return resetScenariosMutation.mutateAsync(domain)
  }, [resetScenariosMutation])

  const validateScenarios = useCallback(async (assessments: Record<string, any>) => {
    return validateScenariosMutation.mutateAsync(assessments)
  }, [validateScenariosMutation])

  return {
    // Data
    scenarios,
    allScenarios,
    availableDomains,
    
    // Loading states
    isLoading: scenariosLoading,
    allScenariosLoading,
    isReady,
    
    // Error states
    error: scenariosError,
    allScenariosError,
    
    // Query functions
    getScenariosForDomain,
    getScenariosForDomains,
    refetchScenarios,
    refetchAllScenarios,
    
    // Mutations with loading states
    addScenario,
    editScenario,
    removeScenario,
    resetToDefaults,
    validateScenarios,
    
    // Mutation states
    isAdding: addScenarioMutation.isPending,
    isEditing: editScenarioMutation.isPending,
    isDeleting: deleteScenarioMutation.isPending,
    isResetting: resetScenariosMutation.isPending,
    isValidating: validateScenariosMutation.isPending,
    
    // Constants
    RESILIENCE_DOMAINS,
  }
}