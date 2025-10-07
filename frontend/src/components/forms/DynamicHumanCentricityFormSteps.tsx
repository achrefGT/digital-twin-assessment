import React, { useState } from "react"
import { Button } from "@/components/ui/enhanced-button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, User, Shield, Activity, Brain, Heart, Zap, AlertCircle } from "lucide-react"
import { useHumanCentricity } from "@/hooks/useHumanCentricity"
import { useLanguage } from "@/contexts/LanguageContext"
import { getHumanCentricityDomainTranslationKey, getHumanCentricityDomainDescriptionKey } from '@/services/humanCentricityApi'

// Color mapping for domains
const DOMAIN_COLORS: Record<string, { bg: string; ring: string; text: string; accent: string }> = {
  'Core_Usability': { bg: 'bg-blue-600', ring: 'ring-blue-200', text: 'text-blue-600', accent: 'border-blue-500' },
  'Trust_Transparency': { bg: 'bg-purple-600', ring: 'ring-purple-200', text: 'text-purple-600', accent: 'border-purple-500' },
  'Workload_Comfort': { bg: 'bg-orange-600', ring: 'ring-orange-200', text: 'text-orange-600', accent: 'border-orange-500' },
  'Cybersickness': { bg: 'bg-red-600', ring: 'ring-red-200', text: 'text-red-600', accent: 'border-red-500' },
  'Emotional_Response': { bg: 'bg-green-600', ring: 'ring-green-200', text: 'text-green-600', accent: 'border-green-500' },
  'Performance': { bg: 'bg-indigo-600', ring: 'ring-indigo-200', text: 'text-indigo-600', accent: 'border-indigo-500' }
}

// Icon mapping for domains
const DOMAIN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Core_Usability': User,
  'Trust_Transparency': Shield,
  'Workload_Comfort': Brain,
  'Cybersickness': Activity,
  'Emotional_Response': Heart,
  'Performance': Zap
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

// Generic domain step component that works with dynamic statements
const DomainStep: React.FC<StepProps & { domain: string }> = ({ 
  onSubmit, 
  initialData, 
  domain 
}) => {
  const { structure, scales, isLoading, error } = useHumanCentricity()
  const { t } = useLanguage()
  
  // Get domain data
  const domainData = structure?.domains?.[domain]
  const domainStatements = domainData?.statements || []
  const domainColors = DOMAIN_COLORS[domain] || DOMAIN_COLORS['Core_Usability']
  const DomainIcon = DOMAIN_ICONS[domain] || User

  // Initialize responses based on domain and widget types
  const [responses, setResponses] = useState<Record<string, any>>(() => {
    const initialResponses: Record<string, any> = {}
    
    if (initialData) {
      // Try to find existing data for this domain
      const existingData = initialData[`${domain.toLowerCase()}_responses`] || 
                          initialData[`${domain.toLowerCase()}_metrics`] ||
                          initialData[`${domain.toLowerCase()}_response`] ||
                          initialData.custom_responses?.[domain]
      
      if (existingData) {
        if (Array.isArray(existingData)) {
          // Handle array responses (like likert responses, cybersickness responses)
          existingData.forEach((item, index) => {
            if (domainStatements[index]) {
              const statementId = domainStatements[index].id
              // Handle different response formats
              if (item.rating !== undefined) {
                initialResponses[statementId] = item.rating
              } else if (item.severity !== undefined) {
                initialResponses[statementId] = item.severity
              } else if (item.value !== undefined) {
                initialResponses[statementId] = item.value
              } else {
                initialResponses[statementId] = 4 // Default fallback
              }
            }
          })
        } else if (typeof existingData === 'object') {
          // Handle object responses (like workload metrics, emotional response)
          Object.entries(existingData).forEach(([key, value]) => {
            // Try to match by statement text or key
            const matchingStatement = domainStatements.find(stmt => 
              stmt.statement_text.toLowerCase().includes(key.replace(/_/g, ' ').toLowerCase()) ||
              stmt.id.includes(key)
            )
            if (matchingStatement) {
              initialResponses[matchingStatement.id] = value
            }
          })
        }
      }
    }
    
    // Set default values for statements without existing data
    domainStatements.forEach(statement => {
      if (!(statement.id in initialResponses)) {
        const scaleConfig = scales?.[statement.scale_key]
        if (statement.widget === 'numeric') {
          initialResponses[statement.id] = ""
        } else if (scaleConfig) {
          const midPoint = Math.ceil((scaleConfig.min + scaleConfig.max) / 2)
          initialResponses[statement.id] = midPoint
        } else {
          initialResponses[statement.id] = 4 // Default fallback
        }
      }
    })
    
    return initialResponses
  })

  const handleResponseChange = (statementId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [statementId]: value
    }))
  }

  const isComplete = () => {
    return domainStatements.filter(stmt => stmt.is_required).every(statement => {
      const response = responses[statement.id]
      if (statement.widget === 'numeric') {
        return response !== "" && response !== null && response !== undefined
      }
      return response !== null && response !== undefined
    })
  }

  const handleSubmit = () => {
    // Convert responses back to expected format based on domain
    const domainKey = domain.toLowerCase()
    let finalData: any = {}
    
    if (domain === 'Core_Usability' || domain === 'Trust_Transparency') {
      // Likert-style responses
      const responseArray = domainStatements.map(statement => ({
        statement: statement.statement_text,
        rating: responses[statement.id] || 4
      }))
      finalData[`${domainKey}_responses`] = responseArray
      finalData.assessments = {
        [domainKey]: responseArray
      }
      
    } else if (domain === 'Workload_Comfort') {
      // Workload metrics object
      const workloadMetrics: any = {}
      domainStatements.forEach(statement => {
        const key = statement.statement_text.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .replace(/_+/g, '_')
          .trim()
        workloadMetrics[key] = responses[statement.id] || 3
      })
      finalData.workload_metrics = workloadMetrics
      finalData.assessments = {
        [domainKey]: workloadMetrics
      }
      
    } else if (domain === 'Emotional_Response') {
      // Emotional response object
      const emotionalResponse: any = {}
      domainStatements.forEach(statement => {
        const text = statement.statement_text.toLowerCase()
        // More flexible matching for valence and arousal
        if (text.includes('valence') || text.includes('plaisir') || text.includes('pleasure')) {
          emotionalResponse.valence = responses[statement.id] || 3
        }
        if (text.includes('arousal') || text.includes('activation') || text.includes('éveil')) {
          emotionalResponse.arousal = responses[statement.id] || 3
        }
      })
      finalData.emotional_response = emotionalResponse
      finalData.assessments = {
        [domainKey]: emotionalResponse
      }
      
    } else if (domain === 'Performance') {
      // Performance metrics object
      const performanceMetrics: any = {}
      domainStatements.forEach(statement => {
        const text = statement.statement_text.toLowerCase()
        const value = responses[statement.id]
        
        // More flexible matching for performance metrics
        if (text.includes('time') || text.includes('temps') || text.includes('durée')) {
          performanceMetrics.task_completion_time_min = value ? parseFloat(value) : 0
        }
        if (text.includes('error') || text.includes('erreur') || text.includes('faute')) {
          performanceMetrics.error_rate = value ? parseInt(value) : 0
        }
        if (text.includes('help') || text.includes('aide') || text.includes('assistance')) {
          performanceMetrics.help_requests = value ? parseInt(value) : 0
        }
        
        // If none of the above matched, add a generic key
        if (!text.includes('time') && !text.includes('temps') && !text.includes('durée') &&
            !text.includes('error') && !text.includes('erreur') && !text.includes('faute') &&
            !text.includes('help') && !text.includes('aide') && !text.includes('assistance')) {
          const key = text.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_').replace(/_+/g, '_').trim()
          performanceMetrics[key] = value
        }
      })
      finalData.performance_metrics = performanceMetrics
      // Also add to assessments for proper accumulation
      finalData.assessments = {
        [domainKey]: performanceMetrics
      }
      
    } else if (domain === 'Cybersickness') {
      // Cybersickness responses
      const cybersicknessResponses = domainStatements.map(statement => ({
        symptom: statement.statement_text,
        severity: responses[statement.id] || 0
      }))
      finalData[`${domainKey}_responses`] = cybersicknessResponses
      finalData.assessments = {
        [domainKey]: cybersicknessResponses
      }
      
    } else {
      // Generic custom responses
      const customResponses: any = {}
      domainStatements.forEach(statement => {
        customResponses[statement.id] = {
          statement: statement.statement_text,
          value: responses[statement.id],
          widget: statement.widget,
          scale_key: statement.scale_key
        }
      })
      finalData.custom_responses = { [domain]: Object.values(customResponses) }
      finalData.assessments = {
        [domainKey]: Object.values(customResponses)
      }
    }
    
    onSubmit(finalData)
  }

  const renderStatement = (statement: any, index: number) => {
  const scaleConfig = scales?.[statement.scale_key]
  const response = responses[statement.id]
  
  if (!scaleConfig) {
    return (
      <Card key={statement.id} className={`group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border-l-4 ${domainColors.accent}`}>
        <CardContent className="p-5">
          <div className="space-y-4">
            <Label className="text-sm font-semibold leading-relaxed text-gray-800">{statement.statement_text}</Label>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t('error.notFound')} {statement.scale_key}</AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Handle numeric input widget
  if (statement.widget === 'numeric') {
    return (
      <Card key={statement.id} className={`group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border-l-4 ${domainColors.accent}`}>
        <CardContent className="p-5">
          <div className="space-y-4">
            <Label className="text-sm font-semibold leading-relaxed text-gray-800">{statement.statement_text}</Label>
            <Input
              type="number"
              step={statement.widget_config?.step || 1}
              min={statement.widget_config?.min || scaleConfig.min}
              placeholder={statement.widget_config?.placeholder || t('form.selectValue')}
              value={response}
              onChange={(e) => handleResponseChange(statement.id, e.target.value)}
              className="transition-all duration-200 focus:scale-105 focus:shadow-lg"
            />
            {statement.widget_config?.unit && (
              <p className="text-xs text-gray-500">{statement.widget_config.unit}</p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Handle ACTUAL slider widget (range input)
  if (statement.widget === 'slider') {
    const labels = scaleConfig.labels || {}
    const currentValue = response !== null && response !== undefined ? response : scaleConfig.min
    
    return (
      <Card key={statement.id} className={`group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border-l-4 ${domainColors.accent}`}>
        <CardContent className="p-5">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-semibold leading-relaxed text-gray-800">
                {statement.statement_text}
              </Label>
              <span className={`text-lg font-bold ${domainColors.text} min-w-[3rem] text-right`}>
                {currentValue}
              </span>
            </div>
            
            <input
              type="range"
              min={scaleConfig.min}
              max={scaleConfig.max}
              step={scaleConfig.step || 1}
              value={currentValue}
              onChange={(e) => handleResponseChange(statement.id, parseInt(e.target.value))}
              className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 slider-thumb-${domain.toLowerCase()}`}
              style={{
                background: `linear-gradient(to right, ${domainColors.bg.replace('bg-', '')} 0%, ${domainColors.bg.replace('bg-', '')} ${((currentValue - scaleConfig.min) / (scaleConfig.max - scaleConfig.min)) * 100}%, #e5e7eb ${((currentValue - scaleConfig.min) / (scaleConfig.max - scaleConfig.min)) * 100}%, #e5e7eb 100%)`
              }}
            />
            
            {Object.keys(labels).length > 0 && (
              <div className="flex justify-between text-xs text-gray-500 px-1">
                {Object.entries(labels).map(([value, label]) => (
                  <span key={value}>{label}</span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Default: likert/radio/sam style
  const options = []
  for (let i = scaleConfig.min; i <= scaleConfig.max; i++) {
    options.push(i)
  }

  return (
    <Card key={statement.id} className={`group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 border-l-4 ${domainColors.accent}`}>
      <CardContent className="p-5">
        <div className="space-y-4">
          <Label className="text-sm font-semibold leading-relaxed text-gray-800">{statement.statement_text}</Label>
          <RadioGroup
            value={response?.toString() || scaleConfig.min.toString()}
            onValueChange={(value) => handleResponseChange(statement.id, parseInt(value))}
            className="flex justify-between gap-2 items-center"
          >
            {options.map((rating) => {
              const selected = response === rating
              return (
                <div key={rating} className="flex flex-col items-center space-y-2">
                  <RadioGroupItem
                    value={rating.toString()}
                    id={`${statement.id}-${rating}`}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                      selected ? `${domainColors.bg} border-transparent ${domainColors.ring} ring-2 text-white` : 'bg-white border-gray-200'
                    }`}
                  />
                  <Label htmlFor={`${statement.id}-${rating}`} className={`text-xs cursor-pointer transition-colors duration-200 hover:${domainColors.text}`}>{rating}</Label>
                </div>
              )
            })}
          </RadioGroup>

          {scaleConfig.labels && (
            <div className="flex justify-between text-xs text-gray-500 px-1">
              <span>{scaleConfig.labels[scaleConfig.min]}</span>
              {scaleConfig.labels[Math.ceil((scaleConfig.min + scaleConfig.max) / 2)] && (
                <span>{scaleConfig.labels[Math.ceil((scaleConfig.min + scaleConfig.max) / 2)]}</span>
              )}
              <span>{scaleConfig.labels[scaleConfig.max]}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

  const getProgress = () => {
    const requiredStatements = domainStatements.filter(stmt => stmt.is_required)
    if (requiredStatements.length === 0) return 100
    
    const filledCount = requiredStatements.filter(statement => {
      const response = responses[statement.id]
      if (statement.widget === 'numeric') {
        return response !== "" && response !== null && response !== undefined
      }
      return response !== null && response !== undefined
    }).length
    
    return (filledCount / requiredStatements.length) * 100
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
            {t('humanCentricity.failedLoadStatements')} {domain}. {t('error.tryAgainLater')}
            {t('common.error')}: {error.message}
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} disabled className="w-full">
          {t('assessment.invalidDomain')}
        </Button>
      </div>
    )
  }

  // No statements available
  if (domainStatements.length === 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('humanCentricity.noStatementsFound')} {domain}. {t('unifiedDomain.noDomainsCurrently')}
          </AlertDescription>
        </Alert>
        <Button onClick={handleSubmit} disabled className="w-full">
          {t('humanCentricity.noStatementsFound')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Domain Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 ${domainColors.bg} rounded-lg flex items-center justify-center`}>
          <DomainIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t(getHumanCentricityDomainTranslationKey(domain.replace('_', ' ')))}
          </h3>
          <p className="text-sm text-gray-600">
            {domainData?.description || t(getHumanCentricityDomainDescriptionKey(domain.replace('_', ' ')))}
          </p>
        </div>
      </div>

      {/* Statements */}
      <div className="space-y-5">
        {domainStatements
          .filter(stmt => stmt.is_active)
          .sort((a, b) => a.display_order - b.display_order)
          .map((statement, index) => renderStatement(statement, index))
        }
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!isComplete()}
        className={`w-full h-12 transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl ${domainColors.bg} hover:${domainColors.bg} text-white disabled:opacity-50`}
      >
        {isComplete() ? (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {t('assessment.complete')} {t(getHumanCentricityDomainTranslationKey(domain))}
          </>
        ) : (
          `${t('assessment.progress')} (${Math.round(getProgress())}%)`
        )}
      </Button>
    </div>
  )
}

// Individual domain components that use the generic DomainStep
const CoreUsabilityStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Core_Usability" />
)

const TrustTransparencyStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Trust_Transparency" />
)

const WorkloadComfortStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Workload_Comfort" />
)

const CybersicknessStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Cybersickness" />
)

const EmotionalResponseStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Emotional_Response" />
)

const PerformanceStep: React.FC<StepProps> = (props) => (
  <DomainStep {...props} domain="Performance" />
)

// Static step generation for backward compatibility
export const getHumanCentricitySteps = (): StepDefinition[] => {
  return [
    {
      title: "Core_Usability", // Keep as domain key - will be translated in selector
      description: "Evaluate basic usability and system integration",
      component: CoreUsabilityStep 
    },
    {
      title: "Trust_Transparency",
      description: "Assess trust in system outputs and transparency",
      component: TrustTransparencyStep
    },
    {
      title: "Workload_Comfort",
      description: "Evaluate mental workload and physical comfort",
      component: WorkloadComfortStep
    },
    {
      title: "Cybersickness",
      description: "Evaluate physical discomfort or cybersickness symptoms",
      component: CybersicknessStep
    },
    {
      title: "Emotional_Response",
      description: "Capture your emotional state while using the system",
      component: EmotionalResponseStep
    },
    {
      title: "Performance",
      description: "Record measured performance indicators",
      component: PerformanceStep
    }
  ];
};

// Dynamic step generation based on available domains
export const getDynamicHumanCentricitySteps = (availableDomains: Array<{domain: string, description: string}>): StepDefinition[] => {
  return availableDomains.map((domainInfo) => ({
    title: domainInfo.domain.replace('_', ' '),
    description: domainInfo.description,
    component: (props: StepProps) => (
      <DomainStep 
        {...props} 
        domain={domainInfo.domain}
      />
    )
  }))
}