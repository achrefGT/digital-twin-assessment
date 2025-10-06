import React from "react"
import { Button } from "@/components/ui/enhanced-button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Leaf, DollarSign, Users, AlertCircle } from "lucide-react"
import { useSustainability } from "@/hooks/useSustainability"
import { getSustainabilityDomainTranslationKey, getSustainabilityDomainDescriptionKey } from '@/services/sustainabilityApi'
import { useLanguage } from "@/contexts/LanguageContext"

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
  'environmental': Leaf,
  'economic': DollarSign,
  'Social': Users
}

// Domain-specific color mapping
const DOMAIN_COLORS: Record<string, { gradient: string; text: string }> = {
  'environmental': { gradient: 'from-green-500 to-emerald-600', text: 'text-green-600' },
  'economic': { gradient: 'from-purple-500 to-violet-600', text: 'text-purple-600' },
  'social': { gradient: 'from-blue-500 to-cyan-600', text: 'text-blue-600' }
}

// Generic domain step component that works with dynamic criteria
const DomainStep: React.FC<StepProps & { domain: string; isLastStep?: boolean }> = ({ 
  onSubmit, 
  initialData, 
  domain,
  isLastStep = false
}) => {
  const { scenarios, isLoading, error } = useSustainability()
  const { t } = useLanguage()
  
  // State stores numeric level indices (0-5)
  const [assessments, setAssessments] = React.useState<Record<string, number>>(() => {
    const initialValues: Record<string, number> = {}
    if (initialData?.assessments?.[domain]) {
      const domainData = initialData.assessments[domain]
      Object.entries(domainData).forEach(([key, value]) => {
        if (typeof value === 'number') {
          initialValues[key] = value
        }
      })
    }
    return initialValues
  })

  const domainData = scenarios?.scenarios[domain]
  const domainCriteria = domainData?.criteria || {}
  const domainColors = DOMAIN_COLORS[domain] || DOMAIN_COLORS['environmental']
  const DomainIcon = DOMAIN_ICONS[domain] || AlertCircle

  const updateAssessment = (criterionKey: string, levelIndex: number) => {
    setAssessments(prev => ({
      ...prev,
      [criterionKey]: levelIndex
    }))
  }

  const isComplete = Object.keys(domainCriteria).length > 0 && 
    Object.keys(domainCriteria).every(key => assessments[key] !== undefined)

  const handleSubmit = () => {
    const domainDataToSubmit: any = {
      assessments: {
        ...initialData?.assessments,
        [domain]: assessments
      }
    }
    
    // Add metadata only if this is the last step
    if (isLastStep) {
      const allAssessments = domainDataToSubmit.assessments
      let totalCriteria = 0
      
      Object.values(allAssessments).forEach((domainAssessment: any) => {
        if (domainAssessment && typeof domainAssessment === 'object') {
          totalCriteria += Object.keys(domainAssessment).length
        }
      })
      
      domainDataToSubmit.metadata = {
        assessment_type: "sustainability",
        version: "2.0",
        total_criteria: totalCriteria,
        selected_domain_count: Object.keys(allAssessments).length,
        criteria_configuration_version: "2.0"
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

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('sustainability.failedLoadCriteria')} {domain}. {t('error.tryRefresh')}
            {error.message && ` ${t('common.error')}: ${error.message}`}
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} variant="eco" className="w-full" disabled>
          {t('assessment.cannotContinue')}
        </Button>
      </div>
    )
  }

  // No criteria configured
  if (Object.keys(domainCriteria).length === 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('sustainability.noCriteriaConfigured')} {domain}. {t('error.contactAdmin')}
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} variant="eco" className="w-full" disabled>
          {t('sustainability.noCriteriaAvailable')}
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
            {t(getSustainabilityDomainTranslationKey(domain))}
          </h3>
          <p className="text-sm text-gray-600">
            {domainData?.description || t(getSustainabilityDomainDescriptionKey(domain))}
          </p>
        </div>
      </div>

      {/* Criteria List */}
      <div className="space-y-4">
        {Object.entries(domainCriteria).map(([criterionKey, criterion]) => {
          const currentLevel = assessments[criterionKey]
          const levelCount = criterion.levels?.length || 0
          
          return (
            <div key={criterionKey} className="space-y-3 p-4 border rounded-lg hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <Label className="text-sm font-medium text-gray-900">
                    {criterion.name}
                  </Label>
                  {criterion.description && (
                    <p className="text-xs text-gray-500 mt-1">{criterion.description}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 ml-2">
                  {currentLevel !== undefined ? `${currentLevel + 1}/${levelCount}` : `0/${levelCount}`}
                </span>
              </div>
              
              <Select 
                value={currentLevel !== undefined ? currentLevel.toString() : ""} 
                onValueChange={(value) => updateAssessment(criterionKey, parseInt(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('form.selectLevel')} />
                </SelectTrigger>
                <SelectContent>
                  {criterion.levels.map((level, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-mono">L{index}</span>
                        <span>{level}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
      
      {/* Progress indicator */}
      <div className="text-sm text-gray-500 text-center">
        {Object.keys(assessments).length} {t('common.of')} {Object.keys(domainCriteria).length} {t('assessment.criteriaCompleted')}
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
const EnvironmentalStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Environmental" />
)

const EconomicStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Economic" />
)

const SocialStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Social" />
)

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

// Dynamic step generation based on available domains
export const getDynamicSustainabilitySteps = (
  availableDomains: Array<{domain: string, description: string}>
): StepDefinition[] => {
  const lastIndex = availableDomains.length - 1
  
  return availableDomains.map((domainInfo, index) => ({
    title: domainInfo.domain.charAt(0).toUpperCase() + domainInfo.domain.slice(1),
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