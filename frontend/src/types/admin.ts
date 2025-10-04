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

// Widget configuration types
export type NormalizationType = 'direct' | 'inverse';

export interface PerformanceWidgetConfig {
  min: number;
  max: number;
  step?: number;
  unit?: string;
  normalization: NormalizationType;
  description?: string;
}

export interface SliderWidgetConfig {
  min: number;
  max: number;
  step?: number;
  labels?: Record<number, string>;
}

export interface LikertWidgetConfig {
  min: number;
  max: number;
  labels?: Record<number, string>;
}

export interface SAMWidgetConfig {
  dimensions: {
    valence?: {
      min: number;
      max: number;
      labels?: Record<number, string>;
    };
    arousal?: {
      min: number;
      max: number;
      labels?: Record<number, string>;
    };
  };
}

export type WidgetConfig = 
  | PerformanceWidgetConfig 
  | SliderWidgetConfig 
  | LikertWidgetConfig 
  | SAMWidgetConfig 
  | Record<string, any>;

export interface StatementCreate {
  domain_key: HumanCentricityDomain;
  statement_text: string;
  widget?: string;
  scale_key?: string;
  widget_config?: WidgetConfig;
  display_order?: number;
  is_required?: boolean;
  is_active?: boolean;
  meta_data?: Record<string, any>;
}

export interface StatementUpdate {
  statement_text?: string;
  widget?: string;
  widget_config?: WidgetConfig;
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
  widget_config?: WidgetConfig;
  display_order: number;
  is_required: boolean;
  is_active: boolean;
  is_default: boolean;
  meta_data: Record<string, any>;
}

// Helper type guards
export function isPerformanceWidgetConfig(config: WidgetConfig): config is PerformanceWidgetConfig {
  return 'normalization' in config && 'min' in config && 'max' in config;
}

export function isSliderWidgetConfig(config: WidgetConfig): config is SliderWidgetConfig {
  return 'min' in config && 'max' in config && !('normalization' in config);
}

export function isSAMWidgetConfig(config: WidgetConfig): config is SAMWidgetConfig {
  return 'dimensions' in config;
}

// Navigation types
export type AdminSection = 'dashboard' | 'users' | 'sustainability' | 'resilience' | 'human-centricity';
 
// Error types
export interface AdminError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'SERVICE_ERROR';
  message: string;
  service?: string;
}

// Utility types for widget configuration validation
export interface WidgetConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePerformanceConfig(config: any): WidgetConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.min === undefined || config.max === undefined) {
    errors.push('Min and max values are required for performance metrics');
  }

  if (config.min !== undefined && config.max !== undefined && config.min >= config.max) {
    errors.push('Min value must be less than max value');
  }

  if (!config.normalization || !['direct', 'inverse'].includes(config.normalization)) {
    errors.push('Normalization type must be either "direct" or "inverse"');
  }

  if (config.step && config.step <= 0) {
    warnings.push('Step value should be positive');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export interface SustainabilityCriterion {
  name: string;
  description: string;
  levels: string[];
}

export interface SustainabilityDomainConfig {
  description: string;
  criteria: Record<string, SustainabilityCriterion>;
}

export interface SustainabilityScenarios {
  scenarios: Record<SustainabilityDomain, SustainabilityDomainConfig>;
}