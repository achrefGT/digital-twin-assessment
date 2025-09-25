// services/scenariosApi.ts

export interface ResilienceScenarios {
  scenarios: Record<string, string[]>
  domain_descriptions: Record<string, string>
  scenario_categories: Record<string, string[]>
}

export interface ScenarioResponse {
  id: string
  domain: string
  scenario_text: string
  description?: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface ScenarioCreate {
  domain: string
  scenario_text: string
  description?: string
  is_default?: boolean
}

export interface ScenarioUpdate {
  scenario_text?: string
  domain?: string
}

export interface ScenarioValidation {
  valid: boolean
  missing_scenarios?: string[]
  message: string
}

const RESILIENCE_SERVICE_URL = 'http://localhost:8001'

// Default fallback scenarios when service is unavailable
const DEFAULT_SCENARIOS: ResilienceScenarios = {
  scenarios: {
    'Robustness': [
      "Core model parameter drifts or becomes invalid",
      "Input data exceeds expected ranges",
      "Critical compute module crashes under load",
      "Required external service becomes unavailable"
    ],
    'Redundancy': [
      "Primary data channel fails",
      "Backup resources are offline when needed",
      "Multiple parallel processes stall simultaneously",
      "Failover logic does not trigger as designed"
    ],
    'Adaptability': [
      "System must incorporate a new asset type on-the-fly",
      "An unforeseen failure mode emerges",
      "Configuration parameters change unexpectedly",
      "Operational conditions shift beyond original design"
    ],
    'Rapidity': [
      "Anomaly detection delayed beyond alert threshold",
      "Recovery routines restart slower than required",
      "Operator notifications delayed by system lag",
      "Corrective actions cannot be executed in time"
    ],
    'PHM': [
      "Failure-prediction accuracy degrades significantly",
      "Remaining-useful-life estimates deviate widely",
      "Maintenance recommendations cannot reach operators",
      "Health-monitoring data streams are interrupted"
    ]
  },
  domain_descriptions: {
    'Robustness': 'System ability to withstand stresses and continue operating',
    'Redundancy': 'System ability to maintain operations through backup resources',
    'Adaptability': 'System ability to adjust to changing conditions and requirements',
    'Rapidity': 'System ability to respond quickly to disruptions',
    'PHM': 'Prognostics and Health Management capabilities'
  },
  scenario_categories: {}
}

// Scenarios API service class
export class ScenariosAPI {
  private static getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json'
    }
  }

  // Main scenarios endpoint - returns current configuration
  static async fetchScenarios(): Promise<ResilienceScenarios> {
    try {
      const response = await fetch(`${RESILIENCE_SERVICE_URL}/scenarios`, {
        headers: this.getHeaders()
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch scenarios: ${response.status} ${response.statusText}`)
      }
      
      return response.json()
    } catch (error) {
      console.warn('Resilience service unavailable, using default scenarios:', error)
      // Return default scenarios when service is down
      return DEFAULT_SCENARIOS
    }
  }

  // Detailed scenarios with metadata
  static async fetchAllScenarios(): Promise<ScenarioResponse[]> {
    const response = await fetch(`${RESILIENCE_SERVICE_URL}/scenarios/all`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch all scenarios: ${response.status} ${response.statusText}`)
    }
    
    return response.json()
  }

  // Get scenarios for specific domain
  static async fetchScenariosByDomain(domain: string): Promise<ScenarioResponse[]> {
    const response = await fetch(`${RESILIENCE_SERVICE_URL}/scenarios/domain/${encodeURIComponent(domain)}`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`No scenarios found for domain: ${domain}`)
      }
      throw new Error(`Failed to fetch scenarios for domain ${domain}: ${response.status}`)
    }
    
    return response.json()
  }

  // Management operations (for admin interfaces)
  static async createScenario(scenario: ScenarioCreate): Promise<ScenarioResponse> {
    const response = await fetch(`${RESILIENCE_SERVICE_URL}/scenarios`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(scenario),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to create scenario: ${response.status}`)
    }
    
    return response.json()
  }

  static async updateScenario(scenarioId: string, update: ScenarioUpdate): Promise<ScenarioResponse> {
    const response = await fetch(`${RESILIENCE_SERVICE_URL}/scenarios/${scenarioId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(update),
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Scenario not found: ${scenarioId}`)
      }
      throw new Error(`Failed to update scenario: ${response.status}`)
    }
    
    return response.json()
  }

  static async deleteScenario(scenarioId: string): Promise<void> {
    const response = await fetch(`${RESILIENCE_SERVICE_URL}/scenarios/${scenarioId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Scenario not found: ${scenarioId}`)
      }
      throw new Error(`Failed to delete scenario: ${response.status}`)
    }
  }

  // Reset scenarios to defaults
  static async resetScenarios(domain?: string): Promise<void> {
    const response = await fetch(`${RESILIENCE_SERVICE_URL}/scenarios/reset`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(domain ? { domain } : {}),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to reset scenarios: ${response.status}`)
    }
  }

  // Validate assessment scenarios against current configuration
  static async validateAssessmentScenarios(assessments: Record<string, any>): Promise<ScenarioValidation> {
    const response = await fetch(`${RESILIENCE_SERVICE_URL}/scenarios/validate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(assessments),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to validate scenarios: ${response.status}`)
    }
    
    return response.json()
  }

  // Utility methods
  static extractAvailableDomains(scenarios: ResilienceScenarios): Array<{domain: string, description: string, scenarioCount: number}> {
    return Object.entries(scenarios.scenarios)
      .filter(([_, scenarioList]) => scenarioList.length > 0)
      .map(([domain, scenarioList]) => ({
        domain,
        description: scenarios.domain_descriptions[domain] || '',
        scenarioCount: scenarioList.length
      }))
  }

  static getScenariosForDomains(scenarios: ResilienceScenarios, selectedDomains: string[]): Record<string, string[]> {
    return selectedDomains.reduce((acc, domain) => {
      if (scenarios.scenarios[domain]) {
        acc[domain] = scenarios.scenarios[domain]
      }
      return acc
    }, {} as Record<string, string[]>)
  }
}

// Query keys for React Query
export const scenarioKeys = {
  all: ['scenarios'] as const,
  scenarios: () => [...scenarioKeys.all, 'list'] as const,
  allScenarios: () => [...scenarioKeys.all, 'detailed'] as const,
  domain: (domain: string) => [...scenarioKeys.all, 'domain', domain] as const,
  validation: (assessments: string) => [...scenarioKeys.all, 'validation', assessments] as const,
}

// React Query query functions
export const scenarioQueries = {
  scenarios: () => ({
    queryKey: scenarioKeys.scenarios(),
    queryFn: () => ScenariosAPI.fetchScenarios(),
    staleTime: 5 * 60 * 1000, // 5 minutes - scenarios don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount: number, error: any) => {
      // Don't retry on 404 or service unavailable
      if (error?.message?.includes('404') || error?.message?.includes('503')) {
        return false
      }
      return failureCount < 2
    }
  }),

  allScenarios: () => ({
    queryKey: scenarioKeys.allScenarios(),
    queryFn: () => ScenariosAPI.fetchAllScenarios(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  }),

  domain: (domain: string) => ({
    queryKey: scenarioKeys.domain(domain),
    queryFn: () => ScenariosAPI.fetchScenariosByDomain(domain),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!domain, // Only run if domain is provided
  }),
}

// React Query mutation functions  
export const scenarioMutations = {
  create: () => ({
    mutationFn: (scenario: ScenarioCreate) => ScenariosAPI.createScenario(scenario),
  }),

  update: () => ({
    mutationFn: ({ scenarioId, update }: { scenarioId: string, update: ScenarioUpdate }) => 
      ScenariosAPI.updateScenario(scenarioId, update),
  }),

  delete: () => ({
    mutationFn: (scenarioId: string) => ScenariosAPI.deleteScenario(scenarioId),
  }),

  reset: () => ({
    mutationFn: (domain?: string) => ScenariosAPI.resetScenarios(domain),
  }),

  validate: () => ({
    mutationFn: (assessments: Record<string, any>) => ScenariosAPI.validateAssessmentScenarios(assessments),
  }),
}