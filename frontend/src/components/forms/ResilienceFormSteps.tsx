import React from "react"
import { Button } from "@/components/ui/enhanced-button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Copy, Shuffle, Zap, Activity, AlertCircle } from "lucide-react"
import { useScenarios } from "@/hooks/useScenarios"
import { getResilienceDomainTranslationKey, getResilienceDomainDescriptionKey } from '@/services/ResilienceAPI'
import { useLanguage } from "@/contexts/LanguageContext"

interface ScenarioAssessment {
  likelihood: string
  impact: string
}

interface StepProps {
  onSubmit: (data: any) => void
  initialData?: any
}

interface StepDefinition {
  title: string
  description: string
  component: React.ComponentType<StepProps>
}

// Domain-specific icon mapping
const DOMAIN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Robustness': Shield,
  'Redundancy': Copy,
  'Adaptability': Shuffle,
  'Rapidity': Zap,
  'PHM': Activity
}

// Domain-specific color mapping
const DOMAIN_COLORS: Record<string, { gradient: string; text: string }> = {
  'Robustness': { gradient: 'from-blue-500 to-blue-600', text: 'text-blue-600' },
  'Redundancy': { gradient: 'from-indigo-500 to-indigo-600', text: 'text-indigo-600' },
  'Adaptability': { gradient: 'from-purple-500 to-purple-600', text: 'text-purple-600' },
  'Rapidity': { gradient: 'from-cyan-500 to-cyan-600', text: 'text-cyan-600' },
  'PHM': { gradient: 'from-teal-500 to-teal-600', text: 'text-teal-600' }
}

// Generic domain step component that works with dynamic scenarios
const DomainStep: React.FC<StepProps & { domain: string; isLastStep?: boolean }> = ({ 
  onSubmit, 
  initialData, 
  domain,
  isLastStep = false
}) => {
  const { scenarios, isLoading, error } = useScenarios()
  const { t } = useLanguage()
  
  const [assessments, setAssessments] = React.useState<Record<string, ScenarioAssessment>>(
    initialData?.assessments?.[domain]?.scenarios || {}
  )

  // Get scenarios for this domain
  const domainScenarios = scenarios?.scenarios[domain] || []
  const domainColors = DOMAIN_COLORS[domain] || DOMAIN_COLORS['Robustness']
  const DomainIcon = DOMAIN_ICONS[domain] || AlertCircle

  const updateAssessment = (scenario: string, field: keyof ScenarioAssessment, value: any) => {
    setAssessments(prev => ({
      ...prev,
      [scenario]: {
        likelihood: "",
        impact: "",
        ...prev[scenario],
        [field]: value
      }
    }))
  }

  const isComplete = domainScenarios.length > 0 && domainScenarios.every(scenario => 
    assessments[scenario]?.likelihood && assessments[scenario]?.impact
  )

  const handleSubmit = () => {
    const domainDataToSubmit: any = {
      assessments: {
        ...initialData?.assessments,
        [domain]: { 
          scenarios: assessments,
          custom_scenarios: {}
        }
      }
    }
    
    // Add metadata only if this is the last step
    if (isLastStep) {
      const allAssessments = domainDataToSubmit.assessments
      let totalScenarios = 0
      
      Object.values(allAssessments).forEach((domainData: any) => {
        if (domainData?.scenarios) {
          totalScenarios += Object.keys(domainData.scenarios).length
        }
      })
      
      domainDataToSubmit.metadata = {
        assessment_type: "resilience",
        version: "2.0",
        total_scenarios: totalScenarios,
        selected_domain_count: Object.keys(allAssessments).length,
        scenario_configuration_version: scenarios?.version || "unknown"
      }
    }
    
    onSubmit(domainDataToSubmit)
  }

  // Loading state
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
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-4 p-4 border rounded-lg">
              <Skeleton className="h-4 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('resilience.failedLoadScenarios')} {domain}. {t('error.tryRefresh')}
            {error.message && ` ${t('common.error')}: ${error.message}`}
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} variant="eco" className="w-full" disabled>
          {t('assessment.cannotContinue')}
        </Button>
      </div>
    )
  }

  // No scenarios configured
  if (domainScenarios.length === 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('resilience.noScenariosConfigured')} {domain}. {t('error.contactAdmin')}
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} variant="eco" className="w-full" disabled>
          {t('resilience.noScenariosAvailable')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Domain Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 bg-gradient-to-br ${domainColors.gradient} rounded-lg flex items-center justify-center`}>
          <DomainIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t(getResilienceDomainTranslationKey(domain))}
          </h3>
          <p className="text-sm text-gray-600">
            {scenarios?.domain_descriptions?.[domain] || t(getResilienceDomainDescriptionKey(domain))}
          </p>
        </div>
      </div>

      {/* Scenarios List */}
      <div className="space-y-4">
        {domainScenarios.map(scenario => (
          <div key={scenario} className="space-y-4 p-4 border rounded-lg hover:border-gray-300 transition-colors">
            <Label className="text-sm font-medium leading-relaxed text-gray-900">{scenario}</Label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-600 mb-2 block">{t('resilience.likelihood')}</Label>
                <Select 
                  value={assessments[scenario]?.likelihood || ""} 
                  onValueChange={(value) => updateAssessment(scenario, 'likelihood', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('resilience.selectLikelihood')} />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { value: "Rare", label: t('resilience.rare') },
                      { value: "Unlikely", label: t('resilience.unlikely') },
                      { value: "Possible", label: t('resilience.possible') },
                      { value: "Likely", label: t('resilience.likely') },
                      { value: "Almost Certain", label: t('resilience.almostCertain') }
                    ].map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-xs text-gray-600 mb-2 block">{t('resilience.impact')}</Label>
                <Select 
                  value={assessments[scenario]?.impact || ""} 
                  onValueChange={(value) => updateAssessment(scenario, 'impact', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('resilience.selectImpact')} />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { value: "Negligible", label: t('resilience.negligible') },
                      { value: "Minor", label: t('resilience.minor') },
                      { value: "Moderate", label: t('resilience.moderate') },
                      { value: "Major", label: t('resilience.major') },
                      { value: "Catastrophic", label: t('resilience.catastrophic') }
                    ].map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Progress indicator */}
      <div className="text-sm text-gray-500 text-center">
        {Object.keys(assessments).length} {t('common.of')} {domainScenarios.length} {t('resilience.scenariosCompleted')}
      </div>
      
      <Button 
        onClick={handleSubmit} 
        variant="eco" 
        className="w-full" 
        disabled={!isComplete}
      >
        {isLastStep ? t('assessment.completeAssessment') : t('assessment.nextStep')}
      </Button>
    </div>
  )
}

// Individual domain components
const RobustnessStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Robustness" />
)

const RedundancyStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Redundancy" />
)

const AdaptabilityStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Adaptability" />
)

const RapidityStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Rapidity" />
)

const PHMStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="PHM" />
)

// Static step generation for backward compatibility
export const getResilienceSteps = (): StepDefinition[] => {
  return [
    {
      title: "Robustness",
      description: "Evaluate system robustness under unexpected conditions",
      component: RobustnessStep
    },
    {
      title: "Redundancy", 
      description: "Assess backup systems and failover mechanisms",
      component: RedundancyStep
    },
    {
      title: "Adaptability",
      description: "Evaluate adaptability to changing conditions",
      component: AdaptabilityStep
    },
    {
      title: "Rapidity",
      description: "Assess speed of response and recovery",
      component: RapidityStep
    },
    {
      title: "PHM",
      description: "Evaluate prognostics and health management",
      component: PHMStep
    }
  ]
}

// Dynamic step generation based on available domains
export const getDynamicResilienceSteps = (
  availableDomains: Array<{domain: string, description: string}>
): StepDefinition[] => {
  const lastIndex = availableDomains.length - 1
  
  return availableDomains.map((domainInfo, index) => ({
    title: domainInfo.domain,
    description: domainInfo.description,
    component: (props: StepProps) => (
      <DomainStep 
        {...props} 
        domain={domainInfo.domain}
        isLastStep={index === lastIndex}
      />
    )
  }))
}