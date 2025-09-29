import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  HumanCentricityAPI, 
  humanCentricityKeys, 
  humanCentricityQueries, 
  humanCentricityMutations,
  type HumanCentricityStructure,
  type StatementResponse,
  type StatementCreate,
  type StatementUpdate 
} from '@/services/humanCentricityApi'

const HUMAN_CENTRICITY_DOMAINS = [
  'Core_Usability',
  'Trust_Transparency', 
  'Workload_Comfort',
  'Cybersickness',
  'Emotional_Response',
  'Performance'
]

export const useHumanCentricity = () => {
  const queryClient = useQueryClient()
  
  // Main structure query
  const {
    data: structure,
    isLoading: structureLoading,
    error: structureError,
    refetch: refetchStructure
  } = useQuery(humanCentricityQueries.structure())
  
  // All domains with metadata
  const {
    data: allDomains,
    isLoading: allDomainsLoading,
    error: allDomainsError,
    refetch: refetchAllDomains
  } = useQuery(humanCentricityQueries.domains())

  // All statements with metadata
  const {
    data: allStatements,
    isLoading: allStatementsLoading,
    error: allStatementsError,
    refetch: refetchAllStatements
  } = useQuery(humanCentricityQueries.statements())

  // Scales configuration
  const {
    data: scales,
    isLoading: scalesLoading,
    error: scalesError,
    refetch: refetchScales
  } = useQuery(humanCentricityQueries.scales())

  // Structure validation
  const {
    data: validation,
    isLoading: validationLoading,
    error: validationError,
    refetch: refetchValidation
  } = useQuery(humanCentricityQueries.validation())

  // Derived state
  const availableDomains = structure ? HumanCentricityAPI.extractAvailableDomains(structure) : []
  const isReady = !structureLoading && !structureError && structure

  // Query function for specific domain
  const getStatementsForDomain = useCallback(async (domain: string) => {
    return queryClient.fetchQuery(humanCentricityQueries.domain(domain))
  }, [queryClient])

  // Helper function 
  const getStructureForDomains = useCallback((selectedDomains: string[]) => {
    if (!structure) return {}
    return HumanCentricityAPI.getStructureForDomains(structure, selectedDomains)
  }, [structure])

  // Get domain configuration
  const getDomainConfig = useCallback((domain: string) => {
    if (!structure || !structure.domains[domain]) return null
    return structure.domains[domain]
  }, [structure])

  // Get statements for a domain from structure
  const getDomainStatements = useCallback((domain: string) => {
    if (!structure || !structure.domains[domain]) return []
    return structure.domains[domain].statements
  }, [structure])

  // Get scale configuration
  const getScaleConfig = useCallback((scaleKey: string) => {
    if (!scales || !scales[scaleKey]) return null
    return scales[scaleKey]
  }, [scales])

  // Mutations
  const addStatementMutation = useMutation({
    ...humanCentricityMutations.create(),
    onSuccess: (newStatement) => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: humanCentricityKeys.structure() })
      queryClient.invalidateQueries({ queryKey: humanCentricityKeys.statements() })
      queryClient.invalidateQueries({ queryKey: humanCentricityKeys.domain(newStatement.domain_key) })
    }
  })

  const editStatementMutation = useMutation({
    ...humanCentricityMutations.update(),
    onSuccess: (updatedStatement) => {
      queryClient.invalidateQueries({ queryKey: humanCentricityKeys.structure() })
      queryClient.invalidateQueries({ queryKey: humanCentricityKeys.statements() })
      queryClient.invalidateQueries({ queryKey: humanCentricityKeys.domain(updatedStatement.domain_key) })
    }
  })

  const deleteStatementMutation = useMutation({
    ...humanCentricityMutations.delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: humanCentricityKeys.all })
    }
  })

  // Wrapper functions for mutations
  const addStatement = useCallback(async (statementData: StatementCreate) => {
    return addStatementMutation.mutateAsync(statementData)
  }, [addStatementMutation])

  const editStatement = useCallback(async (statementId: string, updateData: StatementUpdate) => {
    return editStatementMutation.mutateAsync({ statementId, update: updateData })
  }, [editStatementMutation])

  const removeStatement = useCallback(async (statementId: string) => {
    return deleteStatementMutation.mutateAsync(statementId)
  }, [deleteStatementMutation])

  return {
    // Data
    structure,
    allDomains,
    allStatements,
    scales,
    validation,
    availableDomains,
    
    // Loading states
    isLoading: structureLoading,
    allDomainsLoading,
    allStatementsLoading,
    scalesLoading,
    validationLoading,
    isReady,
    
    // Error states
    error: structureError,
    allDomainsError,
    allStatementsError,
    scalesError,
    validationError,
    
    // Query functions
    getStatementsForDomain,
    getStructureForDomains,
    getDomainConfig,
    getDomainStatements,
    getScaleConfig,
    refetchStructure,
    refetchAllDomains,
    refetchAllStatements,
    refetchScales,
    refetchValidation,
    
    // Mutations with loading states
    addStatement,
    editStatement,
    removeStatement,
    
    // Mutation states
    isAdding: addStatementMutation.isPending,
    isEditing: editStatementMutation.isPending,
    isDeleting: deleteStatementMutation.isPending,
    
    // Constants
    HUMAN_CENTRICITY_DOMAINS,
  }
}