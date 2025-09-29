
// Base entity type
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

// System health and dashboard
export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  data?: any;
  error?: string;
}

export interface ServicesHealthResponse {
  overall_status: 'healthy' | 'unhealthy';
  services: Record<string, ServiceHealth>;
  checked_by: string;
  checked_at: string;
}

export interface AdminDashboard {
  admin_user: string;
  services_health: Record<string, 'healthy' | 'unhealthy'>;
  overall_health: 'healthy' | 'degraded';
  configuration_summary: Record<string, string>;
  available_actions: Record<string, string[]>;
  timestamp: string;
}

// Sustainability types
export type SustainabilityDomain = 'environmental' | 'economic' | 'social';

export interface CriterionCreate {
  // criterion_key is now auto-generated, so it's optional and only used internally
  criterion_key?: string;
  name: string;
  description: string;
  domain: SustainabilityDomain;
  level_count?: number;
  custom_levels?: string[];
  is_default?: boolean;
}

export interface CriterionUpdate {
  name?: string;
  description?: string;
  custom_levels?: string[];
  level_count?: number;
}

export interface CriterionResponse extends BaseEntity {
  criterion_key: string;
  name: string;
  description: string;
  domain: SustainabilityDomain;
  level_count: number;
  custom_levels?: string[];
  is_default: boolean;
}

// Resilience types
export type ResilienceDomain = 'Robustness' | 'Redundancy' | 'Adaptability' | 'Rapidity' | 'PHM';

export interface ScenarioCreate {
  domain: ResilienceDomain;
  scenario_text: string;
  description?: string;
  is_default?: boolean;
}

export interface ScenarioUpdate {
  scenario_text?: string;
  domain?: ResilienceDomain;
  description?: string;
}

export interface ScenarioResponse extends BaseEntity {
  domain: ResilienceDomain;
  scenario_text: string;
  description?: string;
  is_default: boolean;
}

// Human Centricity types
export type HumanCentricityDomain = 
  | 'Core_Usability' 
  | 'Trust_Transparency' 
  | 'Workload_Comfort' 
  | 'Cybersickness' 
  | 'Emotional_Response' 
  | 'Performance';

export type StatementType = 'scale' | 'numeric' | 'performance' | 'text' | 'composite' | 'custom';

export interface StatementCreate {
  domain_key: HumanCentricityDomain;
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

export interface StatementResponse extends BaseEntity {
  domain_key: HumanCentricityDomain;
  statement_text: string;
  statement_type: StatementType;
  scale_key: string;
  widget: string;
  widget_config?: Record<string, any>;
  display_order: number;
  is_required: boolean;
  is_active: boolean;
  is_default: boolean;
  meta_data: Record<string, any>;
}

// Navigation types
export type AdminSection = 'dashboard' | 'sustainability' | 'resilience' | 'human-centricity' | 'system';

// Error types
export interface AdminError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'SERVICE_ERROR';
  message: string;
  service?: string;
}