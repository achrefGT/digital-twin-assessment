import React from "react"
import { Button } from "@/components/ui/enhanced-button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Leaf, DollarSign, Users, AlertCircle } from "lucide-react"
import { useSustainability } from "@/hooks/useSustainability"

interface StepProps {
  onSubmit: (data: any) => void
  initialData?: any
}

interface StepDefinition {
  title: string
  description: string
  component: React.ComponentType<StepProps>
}

// Helper function to convert criterion key to enum value
const keyToEnumValue = (key: string, level: number): string => {
  // This maps criterion keys to their corresponding enum values
  // You might need to adjust this based on your enum definitions
  const keyMap: Record<string, string[]> = {
    'ENV_01': ['static_plan', 'simple_3d', 'basic_movements', 'representative_simulation', 'high_fidelity', 'real_time_connection'],
    'ENV_02': ['nothing_tracked', 'single_flow', 'multiple_flows', 'global_balance', 'detailed_traceability', 'complete_supply_chain'],
    'ENV_03': ['no_data', 'annual_bills', 'monthly_readings', 'continuous_equipment', 'real_time_majority', 'precise_subsystem_counting'],
    'ENV_04': ['no_indicators', 'energy_only', 'energy_carbon', 'add_water', 'multi_indicators', 'complete_lifecycle'],
    'ENV_05': ['observation_only', 'simple_reports', 'basic_change_tests', 'predictive_scenarios', 'assisted_optimization', 'autonomous_optimization'],
    'ECO_01': ['no_budget', 'minimal_budget', 'correct_budget', 'large_budget', 'very_large_budget', 'maximum_budget'],
    'ECO_02': ['no_savings', 'small_savings', 'correct_savings', 'good_savings', 'very_good_savings', 'exceptional_savings'],
    'ECO_03': ['no_improvement', 'small_improvement', 'correct_improvement', 'good_improvement', 'very_good_improvement', 'exceptional_improvement'],
    'ECO_04': ['not_calculated_over_5y', 'profitable_3_5y', 'profitable_2_3y', 'profitable_18_24m', 'profitable_12_18m', 'profitable_under_12m'],
    'SOC_01': ['job_suppression_over_10', 'some_suppressions_5_10', 'stable_some_training', 'same_jobs_all_trained', 'new_positions_5_10', 'strong_job_creation'],
    'SOC_02': ['no_change', 'slight_reduction_under_10', 'moderate_reduction_10_25', 'good_improvement_25_50', 'strong_reduction_50_75', 'near_elimination_over_75'],
    'SOC_03': ['no_local_impact', 'some_local_purchases', 'partnership_1_2_companies', 'institutional_collaboration', 'notable_local_creation', 'major_impact']
  }
  
  const enumValues = keyMap[key]
  if (!enumValues || level < 0 || level >= enumValues.length) {
    return `level_${level}`
  }
  
  return enumValues[level]
}

// Helper function to convert enum value back to level index
const enumValueToLevel = (key: string, enumValue: string): number => {
  const keyMap: Record<string, string[]> = {
    'ENV_01': ['static_plan', 'simple_3d', 'basic_movements', 'representative_simulation', 'high_fidelity', 'real_time_connection'],
    'ENV_02': ['nothing_tracked', 'single_flow', 'multiple_flows', 'global_balance', 'detailed_traceability', 'complete_supply_chain'],
    'ENV_03': ['no_data', 'annual_bills', 'monthly_readings', 'continuous_equipment', 'real_time_majority', 'precise_subsystem_counting'],
    'ENV_04': ['no_indicators', 'energy_only', 'energy_carbon', 'add_water', 'multi_indicators', 'complete_lifecycle'],
    'ENV_05': ['observation_only', 'simple_reports', 'basic_change_tests', 'predictive_scenarios', 'assisted_optimization', 'autonomous_optimization'],
    'ECO_01': ['no_budget', 'minimal_budget', 'correct_budget', 'large_budget', 'very_large_budget', 'maximum_budget'],
    'ECO_02': ['no_savings', 'small_savings', 'correct_savings', 'good_savings', 'very_good_savings', 'exceptional_savings'],
    'ECO_03': ['no_improvement', 'small_improvement', 'correct_improvement', 'good_improvement', 'very_good_improvement', 'exceptional_improvement'],
    'ECO_04': ['not_calculated_over_5y', 'profitable_3_5y', 'profitable_2_3y', 'profitable_18_24m', 'profitable_12_18m', 'profitable_under_12m'],
    'SOC_01': ['job_suppression_over_10', 'some_suppressions_5_10', 'stable_some_training', 'same_jobs_all_trained', 'new_positions_5_10', 'strong_job_creation'],
    'SOC_02': ['no_change', 'slight_reduction_under_10', 'moderate_reduction_10_25', 'good_improvement_25_50', 'strong_reduction_50_75', 'near_elimination_over_75'],
    'SOC_03': ['no_local_impact', 'some_local_purchases', 'partnership_1_2_companies', 'institutional_collaboration', 'notable_local_creation', 'major_impact']
  }
  
  const enumValues = keyMap[key]
  if (!enumValues) return -1
  
  const index = enumValues.indexOf(enumValue)
  return index !== -1 ? index : -1
}

// Generic domain step component that works with dynamic criteria
const DomainStep: React.FC<StepProps & { domain: string }> = ({ 
  onSubmit, 
  initialData, 
  domain 
}) => {
  const { scenarios, isLoading, error } = useSustainability()
  const [assessments, setAssessments] = React.useState<Record<string, string>>(() => {
    // Initialize from initialData if available
    const initialValues: Record<string, string> = {}
    if (initialData?.assessments?.[domain]) {
      const domainData = initialData.assessments[domain]
      Object.entries(domainData).forEach(([key, value]) => {
        if (typeof value === 'string') {
          initialValues[key] = value
        }
      })
    }
    return initialValues
  })

  // Get domain data and criteria for this domain
  const domainData = scenarios?.scenarios[domain]
  const domainCriteria = domainData?.criteria || {}

  const updateAssessment = (criterionKey: string, levelIndex: number) => {
    const enumValue = keyToEnumValue(criterionKey, levelIndex)
    setAssessments(prev => ({
      ...prev,
      [criterionKey]: enumValue
    }))
  }

  const isComplete = Object.keys(domainCriteria).length > 0 && 
    Object.keys(domainCriteria).every(key => assessments[key])

  const handleSubmit = () => {
    // Convert back to the expected format
    const domainAssessment: Record<string, string> = {}
    Object.entries(assessments).forEach(([key, enumValue]) => {
      domainAssessment[key] = enumValue
    })

    const finalData = { 
      assessments: {
        ...initialData?.assessments,
        [domain]: domainAssessment
      }
    }
    onSubmit(finalData)
  }

  // Get domain icon
  const getDomainIcon = (domain: string) => {
    switch (domain) {
      case 'environmental': return <Leaf className="w-5 h-5 text-white" />
      case 'economic': return <DollarSign className="w-5 h-5 text-white" />
      case 'social': return <Users className="w-5 h-5 text-white" />
      default: return <AlertCircle className="w-5 h-5 text-white" />
    }
  }

  const getDomainColors = (domain: string) => {
    switch (domain) {
      case 'environmental': return 'from-green-500 to-emerald-600'
      case 'economic': return 'from-purple-500 to-violet-600'
      case 'social': return 'from-blue-500 to-cyan-600'
      default: return 'from-gray-500 to-gray-600'
    }
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="space-y-3 p-4 border rounded-lg">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load criteria for {domain}. Please try refreshing the page.
            Error: {error.message}
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} variant="eco" className="w-full" disabled>
          Cannot Continue - Criteria Not Available
        </Button>
      </div>
    )
  }

  // Show no criteria state
  if (Object.keys(domainCriteria).length === 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No criteria are currently configured for {domain}. Please contact your administrator.
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} variant="eco" className="w-full" disabled>
          No Criteria Available
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Domain Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 bg-gradient-to-br ${getDomainColors(domain)} rounded-lg flex items-center justify-center`}>
          {getDomainIcon(domain)}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 capitalize">{domain} Impact</h3>
          <p className="text-sm text-gray-600">{domainData?.description || `Assess ${domain} sustainability criteria`}</p>
        </div>
      </div>

      {/* Criteria List */}
      <div className="space-y-4">
        {Object.entries(domainCriteria).map(([criterionKey, criterion]) => {
          const currentEnumValue = assessments[criterionKey] || ""
          const currentLevel = currentEnumValue ? enumValueToLevel(criterionKey, currentEnumValue) : -1
          
          return (
            <div key={criterionKey} className="space-y-3 p-4 border rounded-lg">
              <Label className="text-sm font-medium">{criterion.name}</Label>
              {criterion.description && (
                <p className="text-xs text-gray-500">{criterion.description}</p>
              )}
              
              <Select 
                value={currentLevel >= 0 ? currentLevel.toString() : ""} 
                onValueChange={(value) => updateAssessment(criterionKey, parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {criterion.levels.map((level, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
      
      <Button onClick={handleSubmit} variant="eco" className="w-full" disabled={!isComplete}>
        {domain === 'social' ? 'Complete Assessment' : 'Next Step'}
      </Button>
    </div>
  )
}

// Individual domain components that use the generic DomainStep
const EnvironmentalStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="environmental" />
)

const EconomicStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="economic" />
)

const SocialStep: React.FC<StepProps> = ({ onSubmit, initialData }) => {
  const { scenarios, isLoading, error } = useSustainability()
  const [assessments, setAssessments] = React.useState<Record<string, string>>(() => {
    // Initialize from initialData if available
    const initialValues: Record<string, string> = {}
    if (initialData?.assessments?.social) {
      const domainData = initialData.assessments.social
      Object.entries(domainData).forEach(([key, value]) => {
        if (typeof value === 'string') {
          initialValues[key] = value
        }
      })
    }
    return initialValues
  })

  const domainData = scenarios?.scenarios.social
  const domainCriteria = domainData?.criteria || {}

  const updateAssessment = (criterionKey: string, levelIndex: number) => {
    const enumValue = keyToEnumValue(criterionKey, levelIndex)
    setAssessments(prev => ({
      ...prev,
      [criterionKey]: enumValue
    }))
  }

  const isComplete = Object.keys(domainCriteria).length > 0 && 
    Object.keys(domainCriteria).every(key => assessments[key])

  const handleSubmit = () => {
    // Convert back to the expected format and calculate total criteria
    const domainAssessment: Record<string, string> = {}
    Object.entries(assessments).forEach(([key, enumValue]) => {
      domainAssessment[key] = enumValue
    })

    const allAssessments = {
      ...initialData?.assessments,
      social: domainAssessment
    }
    
    let totalCriteria = 0
    Object.values(allAssessments).forEach((domain: any) => {
      if (domain && typeof domain === 'object') {
        totalCriteria += Object.keys(domain).length
      }
    })

    const finalData = { 
      assessments: allAssessments,
      metadata: {
        assessment_type: "sustainability",
        version: "2.0",
        total_criteria: totalCriteria,
        selected_domain_count: Object.keys(allAssessments).length,
        criteria_configuration_version: scenarios?.version || "unknown"
      }
    }
    onSubmit(finalData)
  }

  // Handle loading and error states (same as DomainStep)
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-3 p-4 border rounded-lg">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load criteria for social domain. Please try refreshing the page.
            Error: {error.message}
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} variant="eco" className="w-full" disabled>
          Cannot Complete - Criteria Not Available
        </Button>
      </div>
    )
  }

  if (Object.keys(domainCriteria).length === 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No criteria are currently configured for social domain. Please contact your administrator.
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} variant="eco" className="w-full" disabled>
          No Criteria Available
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Domain Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Social Impact</h3>
          <p className="text-sm text-gray-600">{domainData?.description || "Assess social sustainability criteria"}</p>
        </div>
      </div>

      {/* Criteria List */}
      <div className="space-y-4">
        {Object.entries(domainCriteria).map(([criterionKey, criterion]) => {
          const currentEnumValue = assessments[criterionKey] || ""
          const currentLevel = currentEnumValue ? enumValueToLevel(criterionKey, currentEnumValue) : -1
          
          return (
            <div key={criterionKey} className="space-y-3 p-4 border rounded-lg">
              <Label className="text-sm font-medium">{criterion.name}</Label>
              {criterion.description && (
                <p className="text-xs text-gray-500">{criterion.description}</p>
              )}
              
              <Select 
                value={currentLevel >= 0 ? currentLevel.toString() : ""} 
                onValueChange={(value) => updateAssessment(criterionKey, parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {criterion.levels.map((level, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
      
      <Button onClick={handleSubmit} variant="eco" className="w-full" disabled={!isComplete}>
        Complete Assessment
      </Button>
    </div>
  )
}

// Static step generation for backward compatibility
export const getSustainabilitySteps = (): StepDefinition[] => {
  return [
    {
      title: "Environmental",
      description: "Evaluate environmental monitoring and impact tracking capabilities",
      component: EnvironmentalStep 
    },
    {
      title: "Economic", 
      description: "Assess economic performance and cost-benefit analysis",
      component: EconomicStep
    },
    {
      title: "Social",
      description: "Evaluate social impact and community benefits",
      component: SocialStep
    }
  ]
}

// Dynamic step generation based on available domains (use this for fully dynamic steps)
export const getDynamicSustainabilitySteps = (availableDomains: Array<{domain: string, description: string}>): StepDefinition[] => {
  return availableDomains.map((domainInfo, index) => ({
    title: domainInfo.domain.charAt(0).toUpperCase() + domainInfo.domain.slice(1), // Capitalize first letter
    description: domainInfo.description,
    component: (props: StepProps) => (
      <DomainStep 
        {...props} 
        domain={domainInfo.domain}
      />
    )
  }))
}