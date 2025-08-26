import React from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/enhanced-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Step 1: Project Parameters
const ProjectParametersStep = ({ onSubmit, initialData }: any) => {
  const { register, handleSubmit, setValue } = useForm({ defaultValues: initialData })

  return (
    <Card className="shadow-md">
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="industry">Industry</Label>
            <Select onValueChange={(value) => setValue("industry", value)}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {["manufacturing", "automotive", "aerospace", "energy", "healthcare"].map(industry => (
                  <SelectItem key={industry} value={industry}>
                    {industry.charAt(0).toUpperCase() + industry.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="capex">Initial CAPEX ($)</Label>
            <Input {...register("capex")} type="number" placeholder="2,500,000" className="mt-2" />
          </div>
          
          <div>
            <Label htmlFor="discountRate">Discount Rate</Label>
            <Input {...register("discountRate")} type="number" step="0.01" placeholder="0.08" className="mt-2" />
          </div>

          <Button type="submit" className="w-full">Complete Step</Button>
        </form>
      </CardContent>
    </Card>
  )
}

// Step 2: Cost Categories
const CostCategoriesStep = ({ onSubmit, initialData }: any) => {
  const [costs, setCosts] = React.useState<Record<string, number[]>>(initialData?.costs || {})

  const costCategories = [
    "dt_software_license", "cloud_computing", "data_storage", "sensor_hardware", "networking_infra",
    "edge_devices", "integration_costs", "customization", "training", "dt_maintenance", 
    "cybersecurity", "data_management", "energy_costs", "maintenance_costs", "downtime_costs", "replacement_costs"
  ]

  const handleSubmit = () => {
    onSubmit({ costs })
  }

  return (
    <Card className="shadow-md">
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {costCategories.map(category => (
            <div key={category} className="space-y-2">
              <Label className="text-sm font-medium">
                {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Label>
              <Input
                type="number"
                placeholder="Annual cost ($)"
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0
                  setCosts(prev => ({
                    ...prev,
                    [category]: new Array(10).fill(value)
                  }))
                }}
              />
            </div>
          ))}
        </div>
        
        <Button onClick={handleSubmit} className="w-full mt-6">Complete Step</Button>
      </CardContent>
    </Card>
  )
}

// Step 3: Benefits
const BenefitsStep = ({ onSubmit, initialData }: any) => {
  const [benefits, setBenefits] = React.useState<Record<string, number[]>>(initialData?.benefits || {})

  const benefitCategories = [
    "predictive_maintenance_savings", "maintenance_optimization", "process_efficiency_gains", 
    "energy_optimization", "quality_improvements", "reduced_prototype_costs", "faster_time_to_market",
    "risk_mitigation_value", "compliance_savings", "inventory_optimization", "supply_chain_optimization",
    "innovation_value", "competitive_advantage"
  ]

  const handleSubmit = () => {
    onSubmit({ benefits, discount_rate: 0.08, start_year: 2025, roi_bounds: [0.0, 1.5] })
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>Benefits Analysis</CardTitle>
        <CardDescription>Set expected annual benefits for each category (amounts will be applied to all 10 years)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {benefitCategories.map(category => (
            <div key={category} className="space-y-2">
              <Label className="text-sm font-medium">
                {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Label>
              <Input
                type="number"
                placeholder="Annual benefit ($)"
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0
                  setBenefits(prev => ({
                    ...prev,
                    [category]: new Array(10).fill(value)
                  }))
                }}
              />
            </div>
          ))}
        </div>
        
        <Button onClick={handleSubmit} className="w-full mt-6">Complete Assessment</Button>
      </CardContent>
    </Card>
  )
}

export const getLCCSteps = () => [
  {
    title: "Project Parameters",
    description: "Set up basic project financial parameters",
    component: <ProjectParametersStep />
  },
  {
    title: "Cost Categories", 
    description: "Define annual costs for different categories",
    component: <CostCategoriesStep />
  },
  {
    title: "Benefits Analysis",
    description: "Set expected benefits and complete the assessment",
    component: <BenefitsStep />
  }
]