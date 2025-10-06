export interface SustainabilityScenarios {
  scenarios: Record<string, { 
    description: string;
    criteria: Record<string, {
      name: string;
      description: string;
      levels: string[];
    }>;
  }>
}

export interface CriterionResponse {
  id: string
  criterion_key: string
  name: string
  description: string
  domain: string
  level_count: number
  custom_levels?: string[]
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface CriterionCreate {
  criterion_key?: string
  name: string
  description: string
  domain: string
  level_count?: number
  custom_levels?: string[]
  is_default?: boolean
}

export interface CriterionUpdate {
  name?: string
  description?: string
  custom_levels?: string[]
  level_count?: number
}

export interface SustainabilityValidation {
  valid: boolean
  missing_criteria?: string[]
  message: string
}

const SUSTAINABILITY_SERVICE_URL = 'http://localhost:8006'

// Default fallback scenarios when service is unavailable
const DEFAULT_SCENARIOS: SustainabilityScenarios = {
  scenarios: {
    'environmental': {
      description: 'Environmental impact and resource management assessment',
      criteria: {
        'ENV_01': {
          name: 'Digital Twin Realism',
          description: 'Level of digital model accuracy and real-world connection',
          levels: [
            "Static plan, no link with reality",
            "Simple 3D shapes",
            "Model with basic movements",
            "Representative simulation: processes realistically simulated",
            "High-fidelity model: detailed physical model, very close to reality",
            "Real-time connection: complete digital replica, synchronized in real time"
          ]
        },
        'ENV_02': {
          name: 'Flow Tracking',
          description: 'Material and energy flow monitoring capabilities',
          levels: [
            "Nothing is tracked",
            "A single flow measured (e.g., electricity)",
            "Multiple flows measured separately (e.g., water + energy)",
            "Global balances of main flows (total inputs/outputs)",
            "Detailed traceability workstation by workstation, inside the plant",
            "Complete tracking including supply chain (upstream/downstream)"
          ]
        },
        'ENV_03': {
          name: 'Energy Visibility',
          description: 'Level of energy consumption monitoring and visibility',
          levels: [
            "No data",
            "Annual bills",
            "Monthly readings",
            "Continuous monitoring of major equipment",
            "Real-time monitoring of most systems",
            "Precise subsystem and equipment-level metering"
          ]
        },
        'ENV_04': {
          name: 'Environmental Scope',
          description: 'Breadth of environmental indicators tracked',
          levels: [
            "No indicators tracked",
            "Energy only",
            "Energy + carbon emissions",
            "Add water (consumption, discharges)",
            "Multi-indicators: energy, carbon, water, waste, materials",
            "Full lifecycle analysis (production → use → end of life)"
          ]
        },
        'ENV_05': {
          name: 'Simulation & Prediction',
          description: 'Predictive and optimization capabilities',
          levels: [
            "Observation only",
            "Simple reports and alerts",
            "Basic change tests (e.g., rate, schedules)",
            "Predictive scenarios with comparisons",
            "Assisted optimization: system proposes several optimal solutions",
            "Autonomous optimization: twin automatically adjusts parameters"
          ]
        }
      }
    },
    'economic': {
      description: 'Economic viability and financial impact assessment',
      criteria: {
        'ECO_01': {
          name: 'Digitalization Budget',
          description: 'Investment level in digital transformation',
          levels: [
            "No budget allocated for digitizing the system",
            "Minimal budget - Basic modeling of the physical system",
            "Correct budget - Faithful reproduction of main equipment",
            "Large budget - Complete digital copy of the system",
            "Very large budget - Ultra-precise twin with advanced sensors",
            "Maximum budget - Perfect real-time connected replica"
          ]
        },
        'ECO_02': {
          name: 'Savings Realized',
          description: 'Actual cost savings achieved',
          levels: [
            "No savings",
            "Small savings",
            "Correct savings",
            "Good savings",
            "Very good savings",
            "Exceptional savings"
          ]
        },
        'ECO_03': {
          name: 'Performance Improvement',
          description: 'Operational performance gains',
          levels: [
            "No improvement",
            "Small improvement",
            "Correct improvement",
            "Good improvement",
            "Very good improvement",
            "Exceptional improvement"
          ]
        },
        'ECO_04': {
          name: 'ROI Timeframe',
          description: 'Return on investment timeline',
          levels: [
            "Not calculated or more than 5 years",
            "Profitable between 3 and 5 years",
            "Profitable between 2 and 3 years",
            "Profitable between 18 and 24 months",
            "Profitable between 12 and 18 months",
            "Profitable in less than 12 months"
          ]
        }
      }
    },
    'social': {
      description: 'Social impact and stakeholder benefits assessment',
      criteria: {
        'SOC_01': {
          name: 'Employee Impact',
          description: 'Effects on workforce and employment',
          levels: [
            "Job cuts (over 10% of workforce affected)",
            "Some job cuts (5–10% of workforce)",
            "Stable workforce, some training",
            "Same number of jobs + training for all concerned",
            "New positions created (5–10% more jobs)",
            "Strong creation of qualified jobs (over 10% increase)"
          ]
        },
        'SOC_02': {
          name: 'Workplace Safety',
          description: 'Impact on worker safety and risk reduction',
          levels: [
            "No change in risks",
            "Slight reduction of incidents (<10%)",
            "Moderate risk reduction (10–25%)",
            "Good improvement in safety (25–50%)",
            "Strong reduction in accidents (50–75%)",
            "Near elimination of risks (>75% reduction)"
          ]
        },
        'SOC_03': {
          name: 'Regional Benefits',
          description: 'Local economic and social benefits',
          levels: [
            "No local impact: no local purchases/partnerships identified",
            "Some additional local purchases",
            "Partnership with 1–2 local companies",
            "Institutional collaboration: active collaboration with local universities/schools",
            "Notable local creation: new local jobs linked to the project",
            "Major impact: new local jobs or significant financial benefits"
          ]
        }
      }
    }
  }
}

// Sustainability API service class
export class SustainabilityAPI {
  private static getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json'
    }
  }

  // Main scenarios endpoint - returns current configuration
  static async fetchScenarios(): Promise<SustainabilityScenarios> {
    try {
      const response = await fetch(`${SUSTAINABILITY_SERVICE_URL}/scenarios`, {
        headers: this.getHeaders()
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch scenarios: ${response.status} ${response.statusText}`)
      }
      
      return response.json()
    } catch (error) {
      console.warn('Sustainability service unavailable, using default scenarios:', error)
      // Return default scenarios when service is down
      return DEFAULT_SCENARIOS
    }
  }

  // Detailed criteria with metadata
  static async fetchAllCriteria(): Promise<CriterionResponse[]> {
    const response = await fetch(`${SUSTAINABILITY_SERVICE_URL}/criteria/all`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch all criteria: ${response.status} ${response.statusText}`)
    }
    
    return response.json()
  }

  // Get criteria for specific domain
  static async fetchCriteriaByDomain(domain: string): Promise<CriterionResponse[]> {
    const response = await fetch(`${SUSTAINABILITY_SERVICE_URL}/criteria/domain/${encodeURIComponent(domain)}`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`No criteria found for domain: ${domain}`)
      }
      throw new Error(`Failed to fetch criteria for domain ${domain}: ${response.status}`)
    }
    
    return response.json()
  }

  // Management operations (for admin interfaces)
  static async createCriterion(criterion: CriterionCreate): Promise<CriterionResponse> {
    const response = await fetch(`${SUSTAINABILITY_SERVICE_URL}/criteria`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(criterion),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to create criterion: ${response.status}`)
    }
    
    return response.json()
  }

  static async updateCriterion(criterionId: string, update: CriterionUpdate): Promise<CriterionResponse> {
    const response = await fetch(`${SUSTAINABILITY_SERVICE_URL}/criteria/${criterionId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(update),
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Criterion not found: ${criterionId}`)
      }
      throw new Error(`Failed to update criterion: ${response.status}`)
    }
    
    return response.json()
  }

  static async deleteCriterion(criterionId: string): Promise<void> {
    const response = await fetch(`${SUSTAINABILITY_SERVICE_URL}/criteria/${criterionId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Criterion not found: ${criterionId}`)
      }
      throw new Error(`Failed to delete criterion: ${response.status}`)
    }
  }

  // Reset criteria to defaults
  static async resetCriteria(domain?: string): Promise<void> {
    const response = await fetch(`${SUSTAINABILITY_SERVICE_URL}/criteria/reset`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(domain ? { domain } : {}),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to reset criteria: ${response.status}`)
    }
  }

  // Validate assessment criteria against current configuration
  static async validateAssessmentCriteria(assessments: Record<string, any>): Promise<SustainabilityValidation> {
    const response = await fetch(`${SUSTAINABILITY_SERVICE_URL}/criteria/validate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(assessments),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to validate criteria: ${response.status}`)
    }
    
    return response.json()
  }

  // Utility methods
  static extractAvailableDomains(scenarios: SustainabilityScenarios): Array<{domain: string, description: string, criteriaCount: number}> {
    return Object.entries(scenarios.scenarios)
      .filter(([_, domainData]) => Object.keys(domainData.criteria).length > 0)
      .map(([domain, domainData]) => ({
        domain,
        description: domainData.description || '',
        criteriaCount: Object.keys(domainData.criteria).length
      }))
  }

  static getScenariosForDomains(scenarios: SustainabilityScenarios, selectedDomains: string[]): Record<string, any> {
    return selectedDomains.reduce((acc, domain) => {
      if (scenarios.scenarios[domain]) {
        acc[domain] = scenarios.scenarios[domain]
      }
      return acc
    }, {} as Record<string, any>)
  }
}

// Query keys for React Query
export const sustainabilityKeys = {
  all: ['sustainability'] as const,
  scenarios: () => [...sustainabilityKeys.all, 'list'] as const,
  allCriteria: () => [...sustainabilityKeys.all, 'detailed'] as const,
  domain: (domain: string) => [...sustainabilityKeys.all, 'domain', domain] as const,
  validation: (assessments: string) => [...sustainabilityKeys.all, 'validation', assessments] as const,
}

// React Query query functions
export const sustainabilityQueries = {
  scenarios: () => ({
    queryKey: sustainabilityKeys.scenarios(),
    queryFn: () => SustainabilityAPI.fetchScenarios(),
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

  allCriteria: () => ({
    queryKey: sustainabilityKeys.allCriteria(),
    queryFn: () => SustainabilityAPI.fetchAllCriteria(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  }),

  domain: (domain: string) => ({
    queryKey: sustainabilityKeys.domain(domain),
    queryFn: () => SustainabilityAPI.fetchCriteriaByDomain(domain),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!domain, // Only run if domain is provided
  }),
}

// React Query mutation functions  
export const sustainabilityMutations = {
  create: () => ({
    mutationFn: (criterion: CriterionCreate) => SustainabilityAPI.createCriterion(criterion),
  }),

  update: () => ({
    mutationFn: ({ criterionId, update }: { criterionId: string, update: CriterionUpdate }) => 
      SustainabilityAPI.updateCriterion(criterionId, update),
  }),

  delete: () => ({
    mutationFn: (criterionId: string) => SustainabilityAPI.deleteCriterion(criterionId),
  }),

  reset: () => ({
    mutationFn: (domain?: string) => SustainabilityAPI.resetCriteria(domain),
  }),

  validate: () => ({
    mutationFn: (assessments: Record<string, any>) => SustainabilityAPI.validateAssessmentCriteria(assessments),
  }),
}

export const getSustainabilityDomainTranslationKey = (domainKey: string): string => {
  const keyMap: Record<string, string> = {
    'environmental': 'sustainability.environmental',
    'economic': 'sustainability.economic',
    'social': 'sustainability.social',
  };
  
  return keyMap[domainKey] || domainKey.replace('_', ' ');
};

export const getSustainabilityDomainDescriptionKey = (domainKey: string): string => {
  return `${getSustainabilityDomainTranslationKey(domainKey)}.desc`;
};