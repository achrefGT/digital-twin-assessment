import React from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/enhanced-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Step 1: Project Information
const ProjectInfoStep = ({ onSubmit, initialData }: any) => {
  const { register, handleSubmit, setValue, watch } = useForm({ defaultValues: initialData })
  const watchedValues = watch()

  return (
    <Card className="shadow-md">
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="projectName">Project Name</Label>
            <Input {...register("projectName", { required: true })} placeholder="e.g., Sustainable Manufacturing Initiative" />
          </div>
          
          <div>
            <Label htmlFor="stakeholderGroup">Primary Stakeholder Group</Label>
            <Select onValueChange={(value) => setValue("stakeholderGroup", value)} defaultValue={initialData?.stakeholderGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Select stakeholder group" />
              </SelectTrigger>
              <SelectContent>
                {[
                  { value: "workers", label: "Workers" },
                  { value: "community", label: "Local Community" }, 
                  { value: "consumers", label: "Consumers" },
                  { value: "suppliers", label: "Suppliers" },
                  { value: "society", label: "Society" }
                ].map(group => (
                  <SelectItem key={group.value} value={group.value}>
                    {group.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="years">Assessment Period (Years)</Label>
            <Select onValueChange={(value) => setValue("years", parseInt(value))} defaultValue={initialData?.years?.toString()}>
              <SelectTrigger>
                <SelectValue placeholder="Select years" />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 7, 10].map(year => (
                  <SelectItem key={year} value={year.toString()}>{year} years</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" variant="eco" className="w-full">Complete Step</Button>
        </form>
      </CardContent>
    </Card>
  )
}

// Step 2: Social Indicators
const SocialIndicatorsStep = ({ onSubmit, initialData, allStepData }: any) => {
  // Get years from previous step data or fallback to initialData
  const years = allStepData?.[0]?.years || initialData?.years || 5
  
  const [indicators, setIndicators] = React.useState<Record<string, number[]>>(initialData?.indicators || {})

  console.log('SocialIndicatorsStep - years:', years)
  console.log('SocialIndicatorsStep - allStepData:', allStepData)
  console.log('SocialIndicatorsStep - initialData:', initialData)

  const socialIndicators = [
    { key: "safety_incident_reduction", label: "Safety Incident Reduction (%)", type: "percentage" },
    { key: "worker_satisfaction", label: "Worker Satisfaction (%)", type: "percentage" },
    { key: "community_engagement", label: "Community Engagement (%)", type: "percentage" },
    { key: "job_creation", label: "Job Creation (count)", type: "count" },
    { key: "skills_development", label: "Skills Development (%)", type: "percentage" },
    { key: "health_safety_improvements", label: "Health & Safety Improvements (%)", type: "percentage" },
    { key: "local_employment", label: "Local Employment (%)", type: "percentage" },
    { key: "gender_equality", label: "Gender Equality (%)", type: "percentage" },
    { key: "fair_wages", label: "Fair Wages (%)", type: "percentage" },
    { key: "working_conditions", label: "Working Conditions (%)", type: "percentage" },
    { key: "community_investment", label: "Community Investment (%)", type: "percentage" },
    { key: "cultural_preservation", label: "Cultural Preservation (%)", type: "percentage" },
    { key: "stakeholder_participation", label: "Stakeholder Participation (%)", type: "percentage" }
  ]

  const handleIndicatorChange = (indicatorKey: string, yearIndex: number, value: string) => {
    setIndicators(prev => {
      const updated = { ...prev }
      if (!updated[indicatorKey]) updated[indicatorKey] = new Array(years).fill(0)
      updated[indicatorKey][yearIndex] = parseFloat(value) || 0
      return updated
    })
  }

  const handleSubmit = () => {
    // Ensure all indicators have values for the exact number of years selected
    const completeIndicators = {}
    socialIndicators.forEach(indicator => {
      if (!indicators[indicator.key]) {
        // Initialize with zeros if not set
        completeIndicators[indicator.key] = new Array(years).fill(0)
      } else {
        // Take exactly the number of years selected
        completeIndicators[indicator.key] = indicators[indicator.key].slice(0, years)
        
        // Fill any missing years with zeros
        while (completeIndicators[indicator.key].length < years) {
          completeIndicators[indicator.key].push(0)
        }
      }
    })
    
    onSubmit({ indicators: completeIndicators })
  }

  return (
    <Card className="shadow-md">
      <CardContent className="space-y-6 pt-4">
        {socialIndicators.map(indicator => (
          <div key={indicator.key} className="space-y-3">
            <Label className="font-medium">{indicator.label}</Label>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${years}, 1fr)` }}>
              {Array.from({ length: years }, (_, i) => (
                <div key={i}>
                  <Label className="text-xs text-muted-foreground">Year {i + 1}</Label>
                  <Input
                    type="number"
                    step={indicator.type === "count" ? "1" : "0.1"}
                    min="0"
                    placeholder="0"
                    value={indicators[indicator.key]?.[i] || ""}
                    onChange={(e) => handleIndicatorChange(indicator.key, i, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        
        <Button onClick={handleSubmit} variant="eco" className="w-full">Complete Assessment</Button>
      </CardContent>
    </Card>
  )
}

export const getSLCASteps = () => [
  {
    title: "Project Setup",
    description: "Define basic project information and assessment parameters",
    component: <ProjectInfoStep />
  },
  {
    title: "Social Indicators",
    description: "Set yearly values for social impact indicators",
    component: <SocialIndicatorsStep />
  }
]

// Keep the original form for backward compatibility
export const SLCAForm = ({ onSubmit }: any) => {
  const { register, handleSubmit, formState: { errors } } = useForm()

  const submitForm = (data: any) => {
    console.log("Form Data:", data)
    onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit(submitForm)} className="space-y-6">
      <div>
        <Label htmlFor="projectName">Project Name *</Label>
        <Input
          {...register("projectName", { required: "Project name is required" })}
          placeholder="e.g., Manufacturing Digital Twin System"
        />
        {errors.projectName && <p className="text-sm text-destructive mt-1">{errors.projectName.message as string}</p>}
      </div>

      <div>
        <Label htmlFor="description">Description (Optional)</Label>
        <Input
          {...register("description")}
          placeholder="Brief description of your project"
        />
      </div>

      <Button type="submit" variant="sustainability" size="lg" className="w-full">
        Submit SLCA Data
      </Button>
    </form>
  )
}