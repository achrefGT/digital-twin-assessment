import React from "react"
import { Button } from "@/components/ui/enhanced-button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, ChevronRight, Sparkles, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { PaginatedForm } from "./PaginatedForm"
import { useScenarios } from "@/hooks/useScenarios"
import { useSustainability } from "@/hooks/useSustainability"
import { useHumanCentricity } from "@/hooks/useHumanCentricity"
import { useLanguage } from "@/contexts/LanguageContext"
import { getHumanCentricityDomainTranslationKey } from '@/services/humanCentricityApi'
import { getSustainabilityDomainTranslationKey } from '@/services/sustainabilityApi'
import { getResilienceDomainTranslationKey } from '@/services/ResilienceAPI'

// Step getter function map
const stepGetters = {
  sustainability: () => import("./forms/SustainabilityFormSteps").then(m => m.getSustainabilitySteps()),
  // Remove the static resilience import - we'll handle this dynamically
  human_centricity: () => import("./forms/DynamicHumanCentricityFormSteps").then(m => m.getHumanCentricitySteps()),
} as const

// Assessment type configuration
const assessmentConfig = {
  sustainability: {
    title: "Sustainability Assessment",
    titleKey: "domain.sustainability.title",
    description: "Choose which sustainability domains you want to include in this assessment.",
    descriptionKey: "assessment.selectDomainDesc",
    primaryColor: "bg-emerald-500",
    primaryColorHover: "bg-emerald-600",
    accentColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    textColor: "text-emerald-700",
    icon: "🌱"
  },
  resilience: {
    title: "Resilience Assessment", 
    titleKey: "domain.resilience.title",
    description: "Choose which resilience domains you want to include in this assessment.",
    descriptionKey: "assessment.selectDomainDesc",
    primaryColor: "bg-blue-500",
    primaryColorHover: "bg-blue-600", 
    accentColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
    icon: "🛡️"
  },
  human_centricity: {
    title: "Human Centricity Assessment",
    titleKey: "domain.humanCentricity.title",
    description: "Choose which human centricity domains you want to include in this assessment.", 
    descriptionKey: "assessment.selectDomainDesc",
    primaryColor: "bg-violet-500",
    primaryColorHover: "bg-violet-600",
    accentColor: "bg-violet-50", 
    borderColor: "border-violet-200",
    textColor: "text-violet-700",
    icon: "👥"
  }
} as const

type AssessmentType = keyof typeof assessmentConfig

interface UnifiedDomainSelectorProps {
  assessmentType: AssessmentType
  assessmentInfo: any
  onComplete: (submission: any) => void
}

export default function UnifiedDomainSelector({ 
  assessmentType, 
  assessmentInfo, 
  onComplete 
}: UnifiedDomainSelectorProps) {
  const { t } = useLanguage()
  const [allSteps, setAllSteps] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedDomains, setSelectedDomains] = React.useState<Set<string>>(new Set())
  const [started, setStarted] = React.useState(false)
  
  // ALWAYS call all hooks to maintain hook order - this is crucial for Rules of Hooks
  const resilienceHook = useScenarios()
  const sustainabilityHook = useSustainability()
  const humanCentricityHook = useHumanCentricity()
  
  const config = assessmentConfig[assessmentType]

  // Load steps dynamically
  React.useEffect(() => {
    const loadSteps = async () => {
      setLoading(true)
      setError(null)
      
      try {
        let steps: any[] = []
        
        if (assessmentType === 'resilience') {
          // Handle resilience assessment with dynamic scenarios
          if (!resilienceHook.isReady) {
            // Wait for scenarios to load
            if (resilienceHook.error) {
              throw new Error(`Failed to load resilience scenarios: ${resilienceHook.error.message}`)
            }
            return // Still loading scenarios
          }
          
          // Import resilience steps and get dynamic steps
          const resilienceModule = await import("./forms/ResilienceFormSteps")
          
          // Use dynamic steps if available
          if (resilienceModule.getDynamicResilienceSteps && resilienceHook.availableDomains?.length > 0) {
            steps = resilienceModule.getDynamicResilienceSteps(resilienceHook.availableDomains)
          } else {
            // Fallback to static steps
            steps = resilienceModule.getResilienceSteps()
          }
          
        } else if (assessmentType === 'sustainability') {
          // Handle sustainability assessment with dynamic scenarios
          if (!sustainabilityHook.isReady) {
            // Wait for scenarios to load
            if (sustainabilityHook.error) {
              throw new Error(`Failed to load sustainability scenarios: ${sustainabilityHook.error.message}`)
            }
            return // Still loading scenarios
          }
          
          // Import sustainability steps and get dynamic steps
          const sustainabilityModule = await import("./forms/SustainabilityFormSteps")
          
          // Use dynamic steps if available
          if (sustainabilityModule.getDynamicSustainabilitySteps && sustainabilityHook.availableDomains?.length > 0) {
            steps = sustainabilityModule.getDynamicSustainabilitySteps(sustainabilityHook.availableDomains)
          } else if (sustainabilityModule.getSustainabilitySteps) {
            // Fallback to static steps
            steps = sustainabilityModule.getSustainabilitySteps()
          } else {
            throw new Error('No sustainability steps available')
          }
          
        } else if (assessmentType === 'human_centricity') {
          // Handle human centricity assessment with dynamic structure
          if (!humanCentricityHook.isReady) {
            // Wait for structure to load
            if (humanCentricityHook.error) {
              throw new Error(`Failed to load human centricity structure: ${humanCentricityHook.error.message}`)
            }
            return // Still loading structure
          }
          
          // Import human centricity steps and get dynamic steps
          const humanCentricityModule = await import("./forms/DynamicHumanCentricityFormSteps")
          
          // Use dynamic steps if available
          if (humanCentricityModule.getDynamicHumanCentricitySteps && humanCentricityHook.availableDomains?.length > 0) {
            steps = humanCentricityModule.getDynamicHumanCentricitySteps(humanCentricityHook.availableDomains)
          } else if (humanCentricityModule.getHumanCentricitySteps) {
            // Fallback to static steps
            steps = humanCentricityModule.getHumanCentricitySteps()
          } else {
            throw new Error('No human centricity steps available')
          }
          
        } else {
          // Handle other assessment types normally
          const stepGetter = stepGetters[assessmentType as keyof typeof stepGetters]
          if (stepGetter) {
            steps = await stepGetter()
          } else {
            throw new Error(`No step getter found for assessment type: ${assessmentType}`)
          }
        }
        
        setAllSteps(steps)
        // Default: all domains selected
        setSelectedDomains(new Set(steps.map(s => s.title)))
        
      } catch (error) {
        console.error('Failed to load steps:', error)
        setError(error instanceof Error ? error.message : 'Failed to load assessment steps')
        setAllSteps([])
      } finally {
        setLoading(false)
      }
    }
    
    loadSteps()
  }, [
    assessmentType, 
    resilienceHook.isReady, 
    resilienceHook.error?.message, 
    resilienceHook.availableDomains?.length,
    sustainabilityHook.isReady,
    sustainabilityHook.error?.message,
    sustainabilityHook.availableDomains?.length,
    humanCentricityHook.isReady,
    humanCentricityHook.error?.message,
    humanCentricityHook.availableDomains?.length
  ])

  // Build the steps array for PaginatedForm - MOVED BEFORE EARLY RETURNS
  const stepsToUse = React.useMemo(() => {
    return allSteps
      .filter(step => selectedDomains.has(step.title))
      .map(step => ({
        title: step.title,
        description: step.description,
        component: React.createElement(step.component as any, {
          // Pass scenarios data to components that need it
          ...(assessmentType === 'resilience' && { scenariosData: resilienceHook.scenarios }),
          ...(assessmentType === 'sustainability' && { scenariosData: sustainabilityHook.scenarios }),
          ...(assessmentType === 'human_centricity' && { 
            structureData: humanCentricityHook.structure, 
            scalesData: humanCentricityHook.scales 
          })
        })
      }))
  }, [allSteps, selectedDomains, assessmentType, resilienceHook.scenarios, sustainabilityHook.scenarios, humanCentricityHook.structure, humanCentricityHook.scales])

  const domainTitles = allSteps.map(s => s.title)

  const toggleDomain = (title: string) => {
    setSelectedDomains(prev => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })
  }

  const selectAll = () => setSelectedDomains(new Set(domainTitles))
  const clearAll = () => setSelectedDomains(new Set())

  const startAssessment = () => {
    if (selectedDomains.size === 0) return
    setStarted(true)
  }

  // Loading state message helper
  const getLoadingMessage = () => {
    if (assessmentType === 'resilience') return t('unifiedDomain.loadingResilience')
    if (assessmentType === 'sustainability') return t('unifiedDomain.loadingSustainability')
    if (assessmentType === 'human_centricity') return t('unifiedDomain.loadingHumanCentricity')
    return t('unifiedDomain.loadingDomains')
  }

  // Error message helper
  const getNoScenariosMessage = () => {
    if (assessmentType === 'resilience') return t('unifiedDomain.noResilienceScenarios')
    if (assessmentType === 'sustainability') return t('unifiedDomain.noSustainabilityScenarios')
    if (assessmentType === 'human_centricity') return t('unifiedDomain.noHumanCentricityDomains')
    return t('unifiedDomain.noDomainsAvailable')
  }

  // Show PaginatedForm when started
  if (started) {
    return (
      <PaginatedForm
        steps={stepsToUse}
        assessmentInfo={assessmentInfo}
        onComplete={onComplete}
      />
    )
  }

  // Determine loading state based on assessment type
  const isLoadingAny = loading || 
    (assessmentType === 'resilience' && resilienceHook.isLoading) ||
    (assessmentType === 'sustainability' && sustainabilityHook.isLoading) ||
    (assessmentType === 'human_centricity' && humanCentricityHook.isLoading)
  
  if (isLoadingAny) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Section Skeleton */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Skeleton className="w-16 h-16 rounded-2xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 mx-auto" />
            <Skeleton className="h-5 w-96 mx-auto" />
          </div>
        </div>

        {/* Main Card Skeleton */}
        <Card className="border-0 shadow-xl">
          <CardHeader className="pb-6">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1,2,3,4,5,6].map(i => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
            <div className="pt-4">
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </CardContent>
        </Card>

        {/* Loading Message */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <span className="text-sm text-gray-600">{getLoadingMessage()}</span>
          </div>
        </div>
      </div>
    )
  }

  // Determine error state based on assessment type
  const currentError = error || 
    (assessmentType === 'resilience' && resilienceHook.error) ||
    (assessmentType === 'sustainability' && sustainabilityHook.error) ||
    (assessmentType === 'human_centricity' && humanCentricityHook.error)

  // Error state
  if (currentError) {
    const displayError = error || currentError?.message || t('error.unknown')
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${config.accentColor} ${config.borderColor} border-2`}>
            <AlertCircle className={`w-8 h-8 ${config.textColor}`} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t(config.titleKey || 'assessment.title')}</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {t('unifiedDomain.unableToLoad')}
            </p>
          </div>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-base">
            {displayError}
          </AlertDescription>
        </Alert>

        <div className="text-center">
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            className="px-6 py-2"
          >
            {t('common.tryAgain')}
          </Button>
        </div>
      </div>
    )
  }

  // No domains available
  if (domainTitles.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${config.accentColor} ${config.borderColor} border-2`}>
            <span className="text-2xl">{config.icon}</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t(config.titleKey || 'assessment.title')}</h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {t('unifiedDomain.noDomainsCurrently')}
            </p>
          </div>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-base">
            {getNoScenariosMessage()}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Get the appropriate data for the info alert
  const currentData = assessmentType === 'resilience' ? resilienceHook.scenarios : 
                     assessmentType === 'sustainability' ? sustainabilityHook.scenarios :
                     assessmentType === 'human_centricity' ? humanCentricityHook.structure : null

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${config.accentColor} ${config.borderColor} border-2`}>
          <span className="text-2xl">{config.icon}</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t(config.titleKey || 'assessment.title')}</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('unifiedDomain.selectDomains')}
          </p>
        </div>
      </div>

      {/* Main Selection Card */}
      <Card className="border-0 shadow-xl bg-gradient-to-br from-white via-gray-50 to-gray-100">
        <CardHeader className="pb-6">
          <div className="flex items-center space-x-3">
            <Sparkles className={`w-5 h-5 ${config.textColor}`} />
            <CardTitle className="text-xl">{t('unifiedDomain.chooseYourDomains')}</CardTitle>
          </div>
          <CardDescription className="text-base">
            {t(config.descriptionKey || 'unifiedDomain.chooseDescription')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Domain Selection Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {domainTitles.map(title => {
              const isSelected = selectedDomains.has(title)
              // Translate domain title if it's a human centricity assessment
              let displayTitle = title
              if (assessmentType === 'human_centricity') {
                displayTitle = t(getHumanCentricityDomainTranslationKey(title.replace('_', ' ')))
              } else if (assessmentType === 'sustainability') {
                displayTitle = t(getSustainabilityDomainTranslationKey(title.toLowerCase()))
              } else if (assessmentType === 'resilience') {
                displayTitle = t(getResilienceDomainTranslationKey(title))
              }

              return (
                <div
                  key={title}
                  onClick={() => toggleDomain(title)}
                  className={`relative group cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 hover:shadow-md ${
                    isSelected 
                      ? `${config.primaryColor} border-transparent text-white shadow-lg` 
                      : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm leading-relaxed pr-2">
                      {displayTitle}
                    </span>
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected 
                        ? 'bg-white border-white' 
                        : 'border-gray-300 group-hover:border-gray-400'
                    }`}>
                      {isSelected && <Check className={`w-3 h-3 ${config.textColor}`} />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline" 
                onClick={selectAll}
                className="text-sm"
                disabled={selectedDomains.size === domainTitles.length}
              >
                {t('common.selectAll')} ({domainTitles.length})
              </Button>
              <Button 
                variant="ghost" 
                onClick={clearAll}
                className="text-sm text-gray-500 hover:text-gray-700"
                disabled={selectedDomains.size === 0}
              >
                {t('common.clearSelection')}
              </Button>
            </div>
            
            <div className="text-sm text-gray-500">
              {selectedDomains.size} {t('common.of')} {domainTitles.length} {t('common.selected')}
            </div>
          </div>

          {/* Start Assessment Button */}
          <div className="pt-4">
            <Button
              onClick={startAssessment}
              disabled={selectedDomains.size === 0}
              className={`w-full py-6 text-base font-semibold rounded-xl transition-all duration-200 ${config.primaryColor} hover:${config.primaryColorHover} disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl`}
            >
              <div className="flex items-center justify-center space-x-3">
                <span>
                  {t('unifiedDomain.startAssessment')}
                  {selectedDomains.size > 0 && (
                    <span className="ml-2">
                      ({selectedDomains.size} {selectedDomains.size !== 1 ? t('unifiedDomain.domains') : t('unifiedDomain.domain')})
                    </span>
                  )}
                </span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </Button>
            
            {selectedDomains.size === 0 && (
              <p className="text-center text-sm text-gray-500 mt-3">
                {t('unifiedDomain.selectAtLeastOne')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress Indicator */}
      {selectedDomains.size > 0 && (
        <div className={`text-center p-4 rounded-xl ${config.accentColor} ${config.borderColor} border`}>
          <p className={`text-sm font-medium ${config.textColor}`}>
            {t('unifiedDomain.assessmentWillInclude')} {selectedDomains.size} {selectedDomains.size !== 1 ? t('unifiedDomain.domains') : t('unifiedDomain.domain')} {t('unifiedDomain.withApproximately')}{' '}
            {assessmentType === 'human_centricity' 
              ? `${selectedDomains.size * 2}-${selectedDomains.size * 8}` 
              : `${selectedDomains.size * 3}-${selectedDomains.size * 5}`
            } {t('unifiedDomain.questions')}
          </p>
        </div>
      )}
    </div>
  )
}