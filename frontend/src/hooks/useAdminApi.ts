import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminAPI, adminKeys, AdminApiError } from '../services/adminApi';
import { useAuth } from '@/auth/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCallback, useRef } from 'react';
import { sustainabilityKeys } from '@/services/sustainabilityApi';
import { scenarioKeys } from '@/services/ResilienceAPI';
import { humanCentricityKeys } from '@/services/humanCentricityApi';

export function useAdminApi() {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Track ongoing deletions to prevent duplicates
  const deletingIdsRef = useRef<Set<string>>(new Set());

  const isAdmin = ['admin', 'super_admin'].includes(user?.role || '');
  const enabled = !!token && isAdmin;

  // Error handler for mutations
  const handleMutationError = useCallback((error: unknown, defaultMessage: string) => {
    console.error('Admin mutation failed:', error);
    
    let message = defaultMessage;
    
    if (error instanceof AdminApiError) {
      if (error.code === 'UNAUTHORIZED') {
        message = 'Your session has expired. Please log in again.';
      } else if (error.code === 'FORBIDDEN') {
        message = 'You do not have admin privileges to perform this action.';
      } else {
        message = error.message;
      }
    } else if (error instanceof Error) {
      message = error.message;
    }
    
    toast({
      title: "Error",
      description: message,
      variant: "destructive",
    });
  }, [toast]);

  // Success handler for mutations
  const handleMutationSuccess = useCallback((message: string) => {
    toast({
      title: "Success",
      description: message,
      variant: "default",
    });
  }, [toast]);

  // System queries
  const dashboard = useQuery({
    queryKey: adminKeys.dashboard(),
    queryFn: () => AdminAPI.getDashboard(token!),
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    retry: (failureCount, error) => {
      if (error instanceof AdminApiError && (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN')) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const servicesHealth = useQuery({
    queryKey: adminKeys.servicesHealth(),
    queryFn: () => AdminAPI.getServicesHealth(token!),
    enabled,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
    retry: 1,
  });

  // Sustainability queries
  const sustainabilityCriteria = useQuery({
    queryKey: adminKeys.sustainabilityCriteria(),
    queryFn: () => AdminAPI.getAllSustainabilityCriteria(token!),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const getSustainabilityCriteriaByDomain = (domain: string) => 
    useQuery({
      queryKey: adminKeys.sustainabilityCriteriaByDomain(domain),
      queryFn: () => AdminAPI.getSustainabilityCriteriaByDomain(domain, token!),
      enabled: enabled && !!domain,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

  // Resilience queries
  const resilienceScenarios = useQuery({
    queryKey: adminKeys.resilienceScenarios(),
    queryFn: () => AdminAPI.getAllResilienceScenarios(token!),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const getResilienceScenariosByDomain = (domain: string) =>
    useQuery({
      queryKey: adminKeys.resilienceScenariosByDomain(domain),
      queryFn: () => AdminAPI.getResilienceScenariosByDomain(domain, token!),
      enabled: enabled && !!domain,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

  // Human Centricity queries
  const humanCentricityStatements = (domain?: string, activeOnly: boolean = true) =>
    useQuery({
      queryKey: adminKeys.humanCentricityStatements(domain, activeOnly),
      queryFn: () => AdminAPI.getAllHumanCentricityStatements(token!, domain, activeOnly),
      enabled,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

  // System mutations
  const validateConfiguration = useMutation({
    mutationFn: () => AdminAPI.validateConfiguration(token!),
    onSuccess: () => {
      handleMutationSuccess('Configuration validation completed successfully');
    },
    onError: (error) => {
      handleMutationError(error, 'Configuration validation failed');
    },
  });

  // Sustainability mutations
  const createSustainabilityCriterion = useMutation({
    mutationFn: (data: any) => AdminAPI.createSustainabilityCriterion(data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.sustainabilityCriteria() });
      queryClient.invalidateQueries({ queryKey: sustainabilityKeys.all });
      handleMutationSuccess('Sustainability criterion created successfully');
    },
    onError: (error) => {
      handleMutationError(error, 'Failed to create sustainability criterion');
    },
  });

  const updateSustainabilityCriterion = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      AdminAPI.updateSustainabilityCriterion(id, data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.sustainabilityCriteria() });
      queryClient.invalidateQueries({ queryKey: sustainabilityKeys.all });
      handleMutationSuccess('Sustainability criterion updated successfully');
    },
    onError: (error) => {
      handleMutationError(error, 'Failed to update sustainability criterion');
    },
  });

  const deleteSustainabilityCriterion = useMutation({
    mutationFn: async (id: string) => {
      if (deletingIdsRef.current.has(id)) {
        throw new Error('Deletion already in progress for this criterion');
      }
      
      deletingIdsRef.current.add(id);
      
      try {
        const result = await AdminAPI.deleteSustainabilityCriterion(id, token!);
        return result;
      } finally {
        deletingIdsRef.current.delete(id);
      }
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.sustainabilityCriteria() });
      queryClient.invalidateQueries({ queryKey: sustainabilityKeys.all });
      handleMutationSuccess('Sustainability criterion deleted successfully');
    },
    onError: (error, id) => {
      deletingIdsRef.current.delete(id);
      
      if (error instanceof Error && error.message.includes('already in progress')) {
        return;
      }
      
      handleMutationError(error, 'Failed to delete sustainability criterion');
    },
  });

  const resetSustainabilityCriteria = useMutation({
    mutationFn: (domain?: string) => AdminAPI.resetSustainabilityCriteria(domain || null, token!),
    onSuccess: (_, domain) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.sustainabilityCriteria() });
      queryClient.invalidateQueries({ queryKey: sustainabilityKeys.all });
      const message = `Sustainability criteria reset successfully${domain ? ` for ${domain}` : ''}`;
      handleMutationSuccess(message);
    },
    onError: (error) => {
      handleMutationError(error, 'Failed to reset sustainability criteria');
    },
  });

  // Resilience mutations
  const createResilienceScenario = useMutation({
    mutationFn: (data: any) => AdminAPI.createResilienceScenario(data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.resilienceScenarios() });
      queryClient.invalidateQueries({ queryKey: scenarioKeys.all });
      handleMutationSuccess('Resilience scenario created successfully');
    },
    onError: (error) => {
      handleMutationError(error, 'Failed to create resilience scenario');
    },
  });

  const updateResilienceScenario = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      AdminAPI.updateResilienceScenario(id, data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.resilienceScenarios() });
      queryClient.invalidateQueries({ queryKey: scenarioKeys.all });
      handleMutationSuccess('Resilience scenario updated successfully');
    },
    onError: (error) => {
      handleMutationError(error, 'Failed to update resilience scenario');
    },
  });

  const deleteResilienceScenario = useMutation({
    mutationFn: async (id: string) => {
      if (deletingIdsRef.current.has(id)) {
        throw new Error('Deletion already in progress for this scenario');
      }
      
      deletingIdsRef.current.add(id);
      
      try {
        const result = await AdminAPI.deleteResilienceScenario(id, token!);
        return result;
      } finally {
        deletingIdsRef.current.delete(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.resilienceScenarios() });
      queryClient.invalidateQueries({ queryKey: scenarioKeys.all });
      handleMutationSuccess('Resilience scenario deleted successfully');
    },
    onError: (error, id) => {
      deletingIdsRef.current.delete(id);
      
      if (error instanceof Error && error.message.includes('already in progress')) {
        return;
      }
      
      handleMutationError(error, 'Failed to delete resilience scenario');
    },
  });

  const resetResilienceScenarios = useMutation({
    mutationFn: (domain?: string) => AdminAPI.resetResilienceScenarios(domain || null, token!),
    onSuccess: (_, domain) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.resilienceScenarios() });
      queryClient.invalidateQueries({ queryKey: scenarioKeys.all });
      const message = `Resilience scenarios reset successfully${domain ? ` for ${domain}` : ''}`;
      handleMutationSuccess(message);
    },
    onError: (error) => {
      handleMutationError(error, 'Failed to reset resilience scenarios');
    },
  });

  // Human Centricity mutations
  const createHumanCentricityStatement = useMutation({
    mutationFn: (data: any) => AdminAPI.createHumanCentricityStatement(data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.humanCentricity() });
      queryClient.invalidateQueries({ queryKey: humanCentricityKeys.all });
      handleMutationSuccess('Human centricity statement created successfully');
    },
    onError: (error) => {
      handleMutationError(error, 'Failed to create human centricity statement');
    },
  });

  const updateHumanCentricityStatement = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      AdminAPI.updateHumanCentricityStatement(id, data, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.humanCentricity() });
      queryClient.invalidateQueries({ queryKey: humanCentricityKeys.all });
      handleMutationSuccess('Human centricity statement updated successfully');
    },
    onError: (error) => {
      handleMutationError(error, 'Failed to update human centricity statement');
    },
  });

  const deleteHumanCentricityStatement = useMutation({
    mutationFn: async (id: string) => {
      if (deletingIdsRef.current.has(id)) {
        throw new Error('Deletion already in progress for this statement');
      }
      
      deletingIdsRef.current.add(id);
      
      try {
        const result = await AdminAPI.deleteHumanCentricityStatement(id, token!);
        return result;
      } finally {
        deletingIdsRef.current.delete(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.humanCentricity() });
      queryClient.invalidateQueries({ queryKey: humanCentricityKeys.all });
      handleMutationSuccess('Human centricity statement deleted successfully');
    },
    onError: (error, id) => {
      deletingIdsRef.current.delete(id);
      
      if (error instanceof Error && error.message.includes('already in progress')) {
        return;
      }
      
      handleMutationError(error, 'Failed to delete human centricity statement');
    },
  });

  const resetHumanCentricityDomain = useMutation({
    mutationFn: (domain: string) => AdminAPI.resetHumanCentricityDomain(domain, token!),
    onSuccess: (_, domain) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.humanCentricity() });
      queryClient.invalidateQueries({ queryKey: humanCentricityKeys.all });
      handleMutationSuccess(`Human centricity domain ${domain} reset successfully`);
    },
    onError: (error) => {
      handleMutationError(error, 'Failed to reset human centricity domain');
    },
  });

  return {
    // Auth state
    isAdmin,
    enabled,
    
    // Queries
    dashboard,
    servicesHealth,
    sustainabilityCriteria,
    resilienceScenarios,
    
    // Dynamic queries (functions that return queries)
    getSustainabilityCriteriaByDomain,
    getResilienceScenariosByDomain,
    humanCentricityStatements,
    
    // Mutations
    mutations: {
      // System
      validateConfiguration,
      
      // Sustainability
      createSustainabilityCriterion,
      updateSustainabilityCriterion,
      deleteSustainabilityCriterion,
      resetSustainabilityCriteria,
      
      // Resilience
      createResilienceScenario,
      updateResilienceScenario,
      deleteResilienceScenario,
      resetResilienceScenarios,
      
      // Human Centricity
      createHumanCentricityStatement,
      updateHumanCentricityStatement,
      deleteHumanCentricityStatement,
      resetHumanCentricityDomain,
    },
    
    // Utility methods for manual operations
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
    refetchHealth: () => queryClient.refetchQueries({ queryKey: adminKeys.servicesHealth() }),
    
    // Helper to check if an item is being deleted (for UI state)
    isDeleting: (id: string) => deletingIdsRef.current.has(id),
  };
}

// Component guard hook for admin routes
export function useRequireAdmin() {
  const { user, isLoading } = useAuth();
  
  return {
    isAdmin: user?.role === 'admin',
    isLoading,
    hasAccess: !isLoading && user?.role === 'admin'
  };
}