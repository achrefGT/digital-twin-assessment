export interface HumanCentricityStructure {
  domains: Record<string, {
    title: string;
    description: string;
    statements: Array<{
      id: string;
      statement_text: string;
      widget: string;
      scale_key: string;
      widget_config?: Record<string, any>;
      display_order: number;
      is_required: boolean;
      is_active: boolean;
      is_default: boolean;
    }>;
    statement_count: number;
    compatible_widgets: string[];
    compatible_scales: string[];
  }>;
  scales: Record<string, {
    type: string;
    min: number;
    max: number;
    step?: number;
    labels: Record<number, string>;
    description: string;
  }>;
}

export interface StatementResponse {
  id: string;
  domain_key: string;
  statement_text: string;
  statement_type: string;
  scale_key: string;
  widget: string;
  widget_config?: Record<string, any>;
  display_order: number;
  is_required: boolean;
  is_active: boolean;
  is_default: boolean;
  meta_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface StatementCreate {
  domain_key: string;
  statement_text: string;
  widget?: string;
  scale_key?: string;
  widget_config?: Record<string, any>;
  display_order?: number;
  is_required?: boolean;
  is_active?: boolean;
  meta_data?: Record<string, any>;
}

export interface StatementUpdate {
  statement_text?: string;
  widget?: string;
  widget_config?: Record<string, any>;
  scale_key?: string;
  display_order?: number;
  is_required?: boolean;
  is_active?: boolean;
  meta_data?: Record<string, any>;
}

export interface DomainInfo {
  domain: string;
  config: {
    title: string;
    description: string;
    statement_type: string;
    default_widget: string;
    default_scale: string;
    display_order: number;
    is_composite: boolean;
    icon: string;
    color: string;
  };
  statements: StatementResponse[];
  statement_count: number;
  compatible_widgets: string[];
  compatible_scales: string[];
}

export interface HumanCentricityValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  structure: {
    total_domains: number;
    total_statements: number;
    enabled_domains: string[];
    validation_rules: Record<string, any>;
  };
}

const HUMAN_CENTRICITY_SERVICE_URL = 'http://localhost:8002'

// Default fallback structure when service is unavailable
const DEFAULT_STRUCTURE: HumanCentricityStructure = {
  domains: {
    'Core_Usability': {
      title: 'Core Usability & User Experience',
      description: 'Evaluate the fundamental usability and user experience aspects of the system',
      statements: [
        {
          id: 'core_01',
          statement_text: 'I found the digital twin intuitive and easy to use.',
          widget: 'likert',
          scale_key: 'likert_7_point',
          display_order: 1,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'core_02',
          statement_text: "The system's functions feel well integrated and coherent.",
          widget: 'likert',
          scale_key: 'likert_7_point',
          display_order: 2,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'core_03',
          statement_text: 'I would use this digital twin frequently in my work.',
          widget: 'likert',
          scale_key: 'likert_7_point',
          display_order: 3,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'core_04',
          statement_text: 'Learning to operate the system was quick and straightforward.',
          widget: 'likert',
          scale_key: 'likert_7_point',
          display_order: 4,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'core_05',
          statement_text: 'I feel confident and in control when using the twin.',
          widget: 'likert',
          scale_key: 'likert_7_point',
          display_order: 5,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'core_06',
          statement_text: 'The terminology and workflows match my domain expertise.',
          widget: 'likert',
          scale_key: 'likert_7_point',
          display_order: 6,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'core_07',
          statement_text: 'I can easily tailor views, dashboards, and alerts to my needs.',
          widget: 'likert',
          scale_key: 'likert_7_point',
          display_order: 7,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'core_08',
          statement_text: 'I feel comfortable with how the system collects, uses, and displays my data.',
          widget: 'likert',
          scale_key: 'likert_7_point',
          display_order: 8,
          is_required: true,
          is_active: true,
          is_default: true
        }
      ],
      statement_count: 8,
      compatible_widgets: ['likert', 'radio', 'text'],
      compatible_scales: ['likert_7_point']
    },
    'Trust_Transparency': {
      title: 'Trust & Transparency',
      description: 'Assess trust levels and system transparency in decision-making',
      statements: [
        {
          id: 'trust_01',
          statement_text: 'I understand the origins and currency of the data shown.',
          widget: 'likert',
          scale_key: 'likert_7_point',
          display_order: 1,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'trust_02',
          statement_text: 'The system explains how it generated its insights or recommendations.',
          widget: 'likert',
          scale_key: 'likert_7_point',
          display_order: 2,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'trust_03',
          statement_text: "I trust the accuracy and reliability of the digital twin's outputs.",
          widget: 'likert',
          scale_key: 'likert_7_point',
          display_order: 3,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'trust_04',
          statement_text: "I feel confident making operational decisions based on the twin's insights.",
          widget: 'likert',
          scale_key: 'likert_7_point',
          display_order: 4,
          is_required: true,
          is_active: true,
          is_default: true
        }
      ],
      statement_count: 4,
      compatible_widgets: ['likert', 'radio', 'text'],
      compatible_scales: ['likert_7_point']
    },
    'Workload_Comfort': {
      title: 'Workload & Comfort Assessment',
      description: 'Evaluate mental workload and physical comfort while using the system',
      statements: [
        {
          id: 'workload_01',
          statement_text: 'Mental Demand',
          widget: 'slider',
          scale_key: 'workload_slider',
          display_order: 1,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'workload_02',
          statement_text: 'Effort Required',
          widget: 'slider',
          scale_key: 'workload_slider',
          display_order: 2,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'workload_03',
          statement_text: 'Frustration Level',
          widget: 'slider',
          scale_key: 'workload_slider',
          display_order: 3,
          is_required: true,
          is_active: true,
          is_default: true
        }
      ],
      statement_count: 3,
      compatible_widgets: ['slider', 'likert', 'numeric'],
      compatible_scales: ['workload_slider', 'likert_7_point']
    },
    'Cybersickness': {
      title: 'Cybersickness / Comfort',
      description: 'Evaluate physical discomfort or cybersickness symptoms while using the system',
      statements: [
        {
          id: 'cyber_01',
          statement_text: 'Queasiness or nausea',
          widget: 'likert',
          scale_key: 'cybersickness_5_point',
          display_order: 1,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'cyber_02',
          statement_text: 'Dizziness or off-balance feeling',
          widget: 'likert',
          scale_key: 'cybersickness_5_point',
          display_order: 2,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'cyber_03',
          statement_text: 'Eye strain or visual discomfort',
          widget: 'likert',
          scale_key: 'cybersickness_5_point',
          display_order: 3,
          is_required: true,
          is_active: true,
          is_default: true
        }
      ],
      statement_count: 3,
      compatible_widgets: ['likert', 'radio'],
      compatible_scales: ['cybersickness_5_point', 'likert_7_point']
    },
    'Emotional_Response': {
      title: 'Emotional Response (SAM)',
      description: 'Capture your emotional state while using the system',
      statements: [
        {
          id: 'emotion_01',
          statement_text: 'Valence (1 = Negative, 5 = Positive)',
          widget: 'sam',
          scale_key: 'sam_valence',
          display_order: 1,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'emotion_02',
          statement_text: 'Arousal (1 = Calm, 5 = Excited)',
          widget: 'sam',
          scale_key: 'sam_arousal',
          display_order: 2,
          is_required: true,
          is_active: true,
          is_default: true
        }
      ],
      statement_count: 2,
      compatible_widgets: ['sam', 'likert'],
      compatible_scales: ['sam_valence', 'sam_arousal', 'likert_7_point']
    },
    'Performance': {
      title: 'Objective Performance Metrics',
      description: 'Record measured performance indicators',
      statements: [
        {
          id: 'perf_01',
          statement_text: 'Task Completion Time (minutes)',
          widget: 'numeric',
          scale_key: 'performance_metrics',
          widget_config: { min: 0, step: 0.1, unit: 'minutes' },
          display_order: 1,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'perf_02',
          statement_text: 'Error Rate (errors per task)',
          widget: 'numeric',
          scale_key: 'performance_metrics',
          widget_config: { min: 0, step: 1, unit: 'errors' },
          display_order: 2,
          is_required: true,
          is_active: true,
          is_default: true
        },
        {
          id: 'perf_03',
          statement_text: 'Help Requests (occurrences)',
          widget: 'numeric',
          scale_key: 'performance_metrics',
          widget_config: { min: 0, step: 1, unit: 'requests' },
          display_order: 3,
          is_required: true,
          is_active: true,
          is_default: true
        }
      ],
      statement_count: 3,
      compatible_widgets: ['numeric', 'slider'],
      compatible_scales: ['performance_metrics']
    }
  },
  scales: {
    'likert_7_point': {
      type: 'likert',
      min: 1,
      max: 7,
      labels: {
        1: 'Strongly Disagree',
        2: 'Disagree',
        3: 'Somewhat Disagree',
        4: 'Neutral',
        5: 'Somewhat Agree',
        6: 'Agree',
        7: 'Strongly Agree'
      },
      description: '7-point Likert scale from Strongly Disagree to Strongly Agree'
    },
    'workload_slider': {
      type: 'slider',
      min: 0,
      max: 100,
      step: 1,
      labels: {
        0: 'Very Low',
        25: 'Low',
        50: 'Moderate',
        75: 'High',
        100: 'Very High'
      },
      description: 'Mental workload assessment from Very Low (0) to Very High (100)'
    },
    'cybersickness_5_point': {
      type: 'likert',
      min: 1,
      max: 5,
      labels: {
        1: 'None',
        2: 'Slight',
        3: 'Moderate',
        4: 'Severe',
        5: 'Very Severe'
      },
      description: 'Cybersickness severity scale from None to Very Severe'
    },
    'sam_valence': {
      type: 'sam',
      min: 1,
      max: 5,
      labels: {
        1: 'Very Unhappy',
        2: 'Unhappy',
        3: 'Neutral',
        4: 'Happy',
        5: 'Very Happy'
      },
      description: 'Self-Assessment Manikin (SAM) valence scale'
    },
    'sam_arousal': {
      type: 'sam',
      min: 1,
      max: 5,
      labels: {
        1: 'Very Calm',
        2: 'Calm',
        3: 'Neutral',
        4: 'Excited',
        5: 'Very Excited'
      },
      description: 'Self-Assessment Manikin (SAM) arousal scale'
    },
    'performance_metrics': {
      type: 'performance',
      min: 0,
      max: 999,
      labels: {
        0: 'Optimal Performance',
        50: 'Average Performance',
        100: 'Below Average Performance'
      },
      description: 'Objective performance measurement metrics'
    }
  }
}

// Human Centricity API service class
export class HumanCentricityAPI {
  private static getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json'
    }
  }

  // Main structure endpoint - returns current assessment configuration
  static async fetchStructure(): Promise<HumanCentricityStructure> {
    try {
      const response = await fetch(`${HUMAN_CENTRICITY_SERVICE_URL}/structure`, {
        headers: this.getHeaders()
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch structure: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      return data.structure || data // Handle both wrapped and direct responses
    } catch (error) {
      console.warn('Human Centricity service unavailable, using default structure:', error)
      // Return default structure when service is down
      return DEFAULT_STRUCTURE
    }
  }

  // Get all domains with their configuration
  static async fetchAllDomains(): Promise<Record<string, DomainInfo>> {
    try {
      const response = await fetch(`${HUMAN_CENTRICITY_SERVICE_URL}/domains`, {
        headers: this.getHeaders()
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch domains: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      return data.domains || {}
    } catch (error) {
      console.warn('Human Centricity service unavailable for domains')
      throw error
    }
  }

  // Get statements for specific domain
  static async fetchStatementsByDomain(domain: string): Promise<StatementResponse[]> {
    const response = await fetch(`${HUMAN_CENTRICITY_SERVICE_URL}/statements?domain=${encodeURIComponent(domain)}`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`No statements found for domain: ${domain}`)
      }
      throw new Error(`Failed to fetch statements for domain ${domain}: ${response.status}`)
    }
    
    return response.json()
  }

  // Get all statements
  static async fetchAllStatements(): Promise<StatementResponse[]> {
    const response = await fetch(`${HUMAN_CENTRICITY_SERVICE_URL}/statements`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch all statements: ${response.status} ${response.statusText}`)
    }
    
    return response.json()
  }

  // Get scale definitions
  static async fetchScales(): Promise<Record<string, any>> {
    try {
      const response = await fetch(`${HUMAN_CENTRICITY_SERVICE_URL}/scales`, {
        headers: this.getHeaders()
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch scales: ${response.status} ${response.statusText}`)
      }
      
      const data = await response.json()
      return data.scales || {}
    } catch (error) {
      console.warn('Using default scales due to service unavailability')
      return DEFAULT_STRUCTURE.scales
    }
  }

  // Management operations (for admin interfaces)
  static async createStatement(statement: StatementCreate): Promise<StatementResponse> {
    const response = await fetch(`${HUMAN_CENTRICITY_SERVICE_URL}/statements`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(statement),
    })
    
    if (!response.ok) {
      throw new Error(`Failed to create statement: ${response.status}`)
    }
    
    return response.json()
  }

  static async updateStatement(statementId: string, update: StatementUpdate): Promise<StatementResponse> {
    const response = await fetch(`${HUMAN_CENTRICITY_SERVICE_URL}/statements/${statementId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(update),
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Statement not found: ${statementId}`)
      }
      throw new Error(`Failed to update statement: ${response.status}`)
    }
    
    return response.json()
  }

  static async deleteStatement(statementId: string): Promise<void> {
    const response = await fetch(`${HUMAN_CENTRICITY_SERVICE_URL}/statements/${statementId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Statement not found: ${statementId}`)
      }
      throw new Error(`Failed to delete statement: ${response.status}`)
    }
  }

  // Validation
  static async validateStructure(): Promise<HumanCentricityValidation> {
    const response = await fetch(`${HUMAN_CENTRICITY_SERVICE_URL}/validation`, {
      headers: this.getHeaders()
    })
    
    if (!response.ok) {
      throw new Error(`Failed to validate structure: ${response.status}`)
    }
    
    return response.json()
  }

  // Utility methods
  static extractAvailableDomains(structure: HumanCentricityStructure): Array<{domain: string, description: string, statementCount: number}> {
    return Object.entries(structure.domains)
      .filter(([_, domainData]) => domainData.statements.length > 0)
      .map(([domain, domainData]) => ({
        domain,
        description: domainData.description || '',
        statementCount: domainData.statement_count
      }))
  }

  static getStructureForDomains(structure: HumanCentricityStructure, selectedDomains: string[]): Record<string, any> {
    return selectedDomains.reduce((acc, domain) => {
      if (structure.domains[domain]) {
        acc[domain] = structure.domains[domain]
      }
      return acc
    }, {} as Record<string, any>)
  }
}

// Query keys for React Query
export const humanCentricityKeys = {
  all: ['human_centricity'] as const,
  structure: () => [...humanCentricityKeys.all, 'structure'] as const,
  domains: () => [...humanCentricityKeys.all, 'domains'] as const,
  statements: () => [...humanCentricityKeys.all, 'statements'] as const,
  domain: (domain: string) => [...humanCentricityKeys.all, 'domain', domain] as const,
  scales: () => [...humanCentricityKeys.all, 'scales'] as const,
  validation: () => [...humanCentricityKeys.all, 'validation'] as const,
}

// React Query query functions
export const humanCentricityQueries = {
  structure: () => ({
    queryKey: humanCentricityKeys.structure(),
    queryFn: () => HumanCentricityAPI.fetchStructure(),
    staleTime: 5 * 60 * 1000, // 5 minutes - structure doesn't change often
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount: number, error: any) => {
      // Don't retry on 404 or service unavailable
      if (error?.message?.includes('404') || error?.message?.includes('503')) {
        return false
      }
      return failureCount < 2
    }
  }),

  domains: () => ({
    queryKey: humanCentricityKeys.domains(),
    queryFn: () => HumanCentricityAPI.fetchAllDomains(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  }),

  statements: () => ({
    queryKey: humanCentricityKeys.statements(),
    queryFn: () => HumanCentricityAPI.fetchAllStatements(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  }),

  domain: (domain: string) => ({
    queryKey: humanCentricityKeys.domain(domain),
    queryFn: () => HumanCentricityAPI.fetchStatementsByDomain(domain),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!domain, // Only run if domain is provided
  }),

  scales: () => ({
    queryKey: humanCentricityKeys.scales(),
    queryFn: () => HumanCentricityAPI.fetchScales(),
    staleTime: 10 * 60 * 1000, // 10 minutes - scales change rarely
    gcTime: 15 * 60 * 1000,
  }),

  validation: () => ({
    queryKey: humanCentricityKeys.validation(),
    queryFn: () => HumanCentricityAPI.validateStructure(),
    staleTime: 1 * 60 * 1000, // 1 minute - validation can change more frequently
    gcTime: 5 * 60 * 1000,
  }),
}

// React Query mutation functions  
export const humanCentricityMutations = {
  create: () => ({
    mutationFn: (statement: StatementCreate) => HumanCentricityAPI.createStatement(statement),
  }),

  update: () => ({
    mutationFn: ({ statementId, update }: { statementId: string, update: StatementUpdate }) => 
      HumanCentricityAPI.updateStatement(statementId, update),
  }),

  delete: () => ({
    mutationFn: (statementId: string) => HumanCentricityAPI.deleteStatement(statementId),
  }),
}

export const getHumanCentricityDomainTranslationKey = (domainKey: string): string => {
  const keyMap: Record<string, string> = {
    'Core Usability': 'domain.humanCentricity.coreUsability',
    'Trust Transparency': 'domain.humanCentricity.trustTransparency',
    'Workload Comfort': 'domain.humanCentricity.workloadComfort',
    'Cybersickness': 'domain.humanCentricity.cybersickness',
    'Emotional Response': 'domain.humanCentricity.emotionalResponse',
    'Performance': 'domain.humanCentricity.performance',
  };
  
  return keyMap[domainKey] || domainKey.replace('_', ' ');
};

export const getHumanCentricityDomainDescriptionKey = (domainKey: string): string => {
  return `${getHumanCentricityDomainTranslationKey(domainKey)}.desc`;
};