import React from "react"
import { Button } from "@/components/ui/enhanced-button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Leaf, DollarSign, Users } from "lucide-react"



interface StepProps {
  onSubmit: (data: any) => void
  initialData?: any
}

interface StepDefinition {
  title: string
  description: string
  component: React.ComponentType<StepProps>
}

const EnvironmentalStep: React.FC<StepProps> = ({ onSubmit, initialData }) => {
  const [environmental, setEnvironmental] = React.useState({
    digital_twin_realism: initialData?.environmental?.digital_twin_realism || "",
    flow_tracking: initialData?.environmental?.flow_tracking || "",
    energy_visibility: initialData?.environmental?.energy_visibility || "",
    environmental_scope: initialData?.environmental?.environmental_scope || "",
    simulation_prediction: initialData?.environmental?.simulation_prediction || ""
  })

  const updateField = (field: string, value: string) => {
    setEnvironmental(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const isComplete = Object.values(environmental).every(value => value !== "")

  const handleSubmit = () => {
    const finalData = {
      // only include the assessments map; no top-level environmental/economic duplication
      assessments: {
        ...initialData?.assessments,
        environmental: environmental
      }
    }
    console.log('DEBUG: Environmental step submitting:', finalData)
    onSubmit(finalData)
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
          <Leaf className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Environmental Impact</h3>
          <p className="text-sm text-gray-600">Assess environmental monitoring and prediction capabilities</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-3 p-4 border rounded-lg">
          <Label className="text-sm font-medium">Digital Twin Realism</Label>
          <Select value={environmental.digital_twin_realism} onValueChange={(value) => updateField('digital_twin_realism', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select realism level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="static_plan">Static plan, no link with reality</SelectItem>
              <SelectItem value="simple_3d">Simple 3D shapes</SelectItem>
              <SelectItem value="basic_movements">Model with basic movements</SelectItem>
              <SelectItem value="representative_simulation">Representative simulation: processes realistically simulated</SelectItem>
              <SelectItem value="high_fidelity">High-fidelity model: detailed physical model, very close to reality</SelectItem>
              <SelectItem value="real_time_connection">Real-time connection: complete digital replica, synchronized in real time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 p-4 border rounded-lg">
          <Label className="text-sm font-medium">Material/Energy Flow Tracking</Label>
          <Select value={environmental.flow_tracking} onValueChange={(value) => updateField('flow_tracking', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select tracking capability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nothing_tracked">Nothing is tracked</SelectItem>
              <SelectItem value="single_flow">A single flow measured (e.g., electricity)</SelectItem>
              <SelectItem value="multiple_flows">Multiple flows measured separately (e.g., water + energy)</SelectItem>
              <SelectItem value="global_balance">Global balances of main flows (total inputs/outputs)</SelectItem>
              <SelectItem value="detailed_traceability">Detailed traceability workstation by workstation, inside the plant</SelectItem>
              <SelectItem value="complete_supply_chain">Complete tracking including supply chain (upstream/downstream)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 p-4 border rounded-lg">
          <Label className="text-sm font-medium">Energy Consumption Visibility</Label>
          <Select value={environmental.energy_visibility} onValueChange={(value) => updateField('energy_visibility', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select visibility level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no_data">No data</SelectItem>
              <SelectItem value="annual_bills">Annual bills</SelectItem>
              <SelectItem value="monthly_readings">Monthly readings</SelectItem>
              <SelectItem value="continuous_equipment">Continuous monitoring of major equipment</SelectItem>
              <SelectItem value="real_time_majority">Real-time monitoring of most systems</SelectItem>
              <SelectItem value="precise_subsystem_counting">Precise subsystem and equipment-level metering</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 p-4 border rounded-lg">
          <Label className="text-sm font-medium">Environmental Scope Coverage</Label>
          <Select value={environmental.environmental_scope} onValueChange={(value) => updateField('environmental_scope', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select scope coverage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no_indicators">No indicators tracked</SelectItem>
              <SelectItem value="energy_only">Energy only</SelectItem>
              <SelectItem value="energy_carbon">Energy + carbon emissions</SelectItem>
              <SelectItem value="add_water">Add water (consumption, discharges)</SelectItem>
              <SelectItem value="multi_indicators">Multi-indicators: energy, carbon, water, waste, materials</SelectItem>
              <SelectItem value="complete_lifecycle">Full lifecycle analysis (production → use → end of life)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 p-4 border rounded-lg">
          <Label className="text-sm font-medium">Simulation & Prediction</Label>
          <Select value={environmental.simulation_prediction} onValueChange={(value) => updateField('simulation_prediction', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select prediction capability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="observation_only">Observation only</SelectItem>
              <SelectItem value="simple_reports">Simple reports and alerts</SelectItem>
              <SelectItem value="basic_change_tests">Basic change tests (e.g., rate, schedules)</SelectItem>
              <SelectItem value="predictive_scenarios">Predictive scenarios with comparisons</SelectItem>
              <SelectItem value="assisted_optimization">Assisted optimization: system proposes several optimal solutions</SelectItem>
              <SelectItem value="autonomous_optimization">Autonomous optimization: twin automatically adjusts parameters</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button 
        onClick={handleSubmit} 
        variant="eco" 
        className="w-full" 
        disabled={!isComplete}
      >
        Next Step
      </Button>
    </div>
  )
}

const EconomicStep: React.FC<StepProps> = ({ onSubmit, initialData }) => {
  const [economic, setEconomic] = React.useState({
    digitalization_budget: initialData?.economic?.digitalization_budget || "",
    savings_realized: initialData?.economic?.savings_realized || "",
    performance_improvement: initialData?.economic?.performance_improvement || "",
    roi_timeframe: initialData?.economic?.roi_timeframe || ""
  })

  const updateField = (field: string, value: string) => {
    setEconomic(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const isComplete = Object.values(economic).every(value => value !== "")

  const handleSubmit = () => {
    const finalData = {
      assessments: {
        ...initialData?.assessments,
        economic: economic
      }
    }
    console.log('DEBUG: Economic step submitting:', finalData)
    onSubmit(finalData)
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Economic Performance</h3>
          <p className="text-sm text-gray-600">Evaluate cost efficiency and financial returns</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-3 p-4 border rounded-lg">
          <Label className="text-sm font-medium">Digitalization Budget Tracking</Label>
          <Select value={economic.digitalization_budget} onValueChange={(value) => updateField('digitalization_budget', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select budget tracking level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no_budget">No budget allocated for digitizing the system</SelectItem>
              <SelectItem value="minimal_budget">Minimal budget - Basic modeling of the physical system</SelectItem>
              <SelectItem value="correct_budget">Correct budget - Faithful reproduction of main equipment</SelectItem>
              <SelectItem value="large_budget">Large budget - Complete digital copy of the system</SelectItem>
              <SelectItem value="very_large_budget">Very large budget - Ultra-precise twin with advanced sensors</SelectItem>
              <SelectItem value="maximum_budget">Maximum budget - Perfect real-time connected replica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 p-4 border rounded-lg">
          <Label className="text-sm font-medium">Realized Savings</Label>
          <Select value={economic.savings_realized} onValueChange={(value) => updateField('savings_realized', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select savings level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no_savings">No savings</SelectItem>
              <SelectItem value="small_savings">Small savings</SelectItem>
              <SelectItem value="correct_savings">Correct savings</SelectItem>
              <SelectItem value="good_savings">Good savings</SelectItem>
              <SelectItem value="very_good_savings">Very good savings</SelectItem>
              <SelectItem value="exceptional_savings">Exceptional savings</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 p-4 border rounded-lg">
          <Label className="text-sm font-medium">Performance Improvement</Label>
          <Select value={economic.performance_improvement} onValueChange={(value) => updateField('performance_improvement', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select improvement level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no_improvement">No improvement</SelectItem>
              <SelectItem value="small_improvement">Small improvement</SelectItem>
              <SelectItem value="correct_improvement">Correct improvement</SelectItem>
              <SelectItem value="good_improvement">Good improvement</SelectItem>
              <SelectItem value="very_good_improvement">Very good improvement</SelectItem>
              <SelectItem value="exceptional_improvement">Exceptional improvement</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 p-4 border rounded-lg">
          <Label className="text-sm font-medium">ROI Achievement Timeframe</Label>
          <Select value={economic.roi_timeframe} onValueChange={(value) => updateField('roi_timeframe', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select ROI timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="not_calculated_over_5y">Not calculated or more than 5 years</SelectItem>
              <SelectItem value="profitable_3_5y">Profitable between 3 and 5 years</SelectItem>
              <SelectItem value="profitable_2_3y">Profitable between 2 and 3 years</SelectItem>
              <SelectItem value="profitable_18_24m">Profitable between 18 and 24 months</SelectItem>
              <SelectItem value="profitable_12_18m">Profitable between 12 and 18 months</SelectItem>
              <SelectItem value="profitable_under_12m">Profitable in less than 12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button 
        onClick={handleSubmit} 
        variant="eco" 
        className="w-full" 
        disabled={!isComplete}
      >
        Next Step
      </Button>
    </div>
  )
}

const SocialStep: React.FC<StepProps> = ({ onSubmit, initialData }) => {
  const [social, setSocial] = React.useState({
    employee_impact: initialData?.social?.employee_impact || "",
    workplace_safety: initialData?.social?.workplace_safety || "",
    regional_benefits: initialData?.social?.regional_benefits || ""
  })

  const updateField = (field: string, value: string) => {
    setSocial(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const isComplete = Object.values(social).every(value => value !== "")

  const handleSubmit = () => {
    const finalData = {
      // finalData.assessments will contain environmental + economic + social in lowercase
      assessments: {
        ...initialData?.assessments,
        social: social
      }
    }
    console.log('DEBUG: Social final step submitting complete assessment data:', finalData)
    onSubmit(finalData)
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg flex items-center justify-center">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Social Impact</h3>
          <p className="text-sm text-gray-600">Assess social and community benefits</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-3 p-4 border rounded-lg">
          <Label className="text-sm font-medium">Employee Impact</Label>
          <Select value={social.employee_impact} onValueChange={(value) => updateField('employee_impact', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select employee impact" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="job_suppression_over_10">Job cuts (over 10% of workforce affected)</SelectItem>
              <SelectItem value="some_suppressions_5_10">Some job cuts (5–10% of workforce)</SelectItem>
              <SelectItem value="stable_some_training">Stable workforce, some training</SelectItem>
              <SelectItem value="same_jobs_all_trained">Same number of jobs + training for all concerned</SelectItem>
              <SelectItem value="new_positions_5_10">New positions created (5–10% more jobs)</SelectItem>
              <SelectItem value="strong_job_creation">Strong creation of qualified jobs (over 10% increase)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 p-4 border rounded-lg">
          <Label className="text-sm font-medium">Workplace Safety Improvement</Label>
          <Select value={social.workplace_safety} onValueChange={(value) => updateField('workplace_safety', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select safety improvement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no_change">No change in risks</SelectItem>
              <SelectItem value="slight_reduction_under_10">Slight reduction of incidents (&lt;10%)</SelectItem>
              <SelectItem value="moderate_reduction_10_25">Moderate risk reduction (10–25%)</SelectItem>
              <SelectItem value="good_improvement_25_50">Good improvement in safety (25–50%)</SelectItem>
              <SelectItem value="strong_reduction_50_75">Strong reduction in accidents (50–75%)</SelectItem>
              <SelectItem value="near_elimination_over_75">Near elimination of risks (&gt;75% reduction)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 p-4 border rounded-lg">
          <Label className="text-sm font-medium">Regional/Community Benefits</Label>
          <Select value={social.regional_benefits} onValueChange={(value) => updateField('regional_benefits', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select regional benefits" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no_local_impact">No local impact: no local purchases/partnerships identified</SelectItem>
              <SelectItem value="some_local_purchases">Some additional local purchases</SelectItem>
              <SelectItem value="partnership_1_2_companies">Partnership with 1–2 local companies</SelectItem>
              <SelectItem value="institutional_collaboration">Institutional collaboration: active collaboration with local universities/schools</SelectItem>
              <SelectItem value="notable_local_creation">Notable local creation: new local jobs linked to the project</SelectItem>
              <SelectItem value="major_impact">Major impact: new local jobs or significant financial benefits</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button 
        onClick={handleSubmit} 
        variant="eco" 
        className="w-full" 
        disabled={!isComplete}
      >
        Complete Assessment
      </Button>
    </div>
  )
}
/*
export const getSustainabilitySteps = () => [
  {
    title: "Sustainability Assessment", 
    description: "Complete an interactive sustainability assessment through guided conversation",
    component: <ConversationalSustainabilityForm />
  }
]*/

export const getSustainabilitySteps = () => [
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