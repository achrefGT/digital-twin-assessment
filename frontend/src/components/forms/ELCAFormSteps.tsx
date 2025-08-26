// ELCAFormSteps.tsx
import React from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/enhanced-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Step 1: Assessment Overview
const AssessmentOverviewStep = ({ onSubmit, initialData }: any) => {
  // NOTE: use snake_case keys so the accumulated initialData is already in the right naming convention
  const { register, handleSubmit, setValue } = useForm({ defaultValues: initialData })

  return (
    <Card className="shadow-md">
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="name">Assessment Name</Label>
            <Input {...register("name")} placeholder="Digital Twin Manufacturing System ELCA" className="mt-2" />
          </div>
          
          <div>
            <Label htmlFor="industry_type">Industry Type</Label>
            <Select onValueChange={(value) => setValue("industry_type", value)}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {["automotive", "manufacturing", "aerospace", "energy", "chemicals"].map(industry => (
                  <SelectItem key={industry} value={industry}>
                    {industry.charAt(0).toUpperCase() + industry.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="assessment_years">Assessment Years</Label>
            <Select onValueChange={(value) => setValue("assessment_years", parseInt(value, 10))}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select years" />
              </SelectTrigger>
              <SelectContent>
                {[3, 5, 7, 10].map(year => (
                  <SelectItem key={year} value={year.toString()}>{year} years</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="functional_unit_description">Functional Unit Description</Label>
            <Input {...register("functional_unit_description")} placeholder="Annual production with digital twin system" className="mt-2" />
          </div>

          <Button type="submit" className="w-full">Complete Step</Button>
        </form>
      </CardContent>
    </Card>
  )
}

// Step 2: Operational Data
const OperationalDataStep = ({ onSubmit, initialData }: any) => {
  // names here match the nested structure keys' names (we'll wrap them into operational_data later)
  const { register, handleSubmit } = useForm({ defaultValues: initialData })

  return (
    <Card className="shadow-md">
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="annual_production_volume">Annual Production Volume</Label>
              <Input {...register("annual_production_volume")} type="number" placeholder="15000" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="operating_hours_per_year">Operating Hours per Year</Label>
              <Input {...register("operating_hours_per_year")} type="number" placeholder="8760" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="factory_floor_area_m2">Factory Floor Area (m²)</Label>
              <Input {...register("factory_floor_area_m2")} type="number" step="0.1" placeholder="7500" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="annual_electricity_kwh">Annual Electricity (kWh)</Label>
              <Input {...register("annual_electricity_kwh")} type="number" placeholder="1500000" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="electricity_peak_demand_kw">Electricity Peak Demand (kW)</Label>
              <Input {...register("electricity_peak_demand_kw")} type="number" placeholder="750" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="server_count">Server Count</Label>
              <Input {...register("server_count")} type="number" placeholder="15" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="server_avg_power_watts">Server Avg Power (Watts)</Label>
              <Input {...register("server_avg_power_watts")} type="number" placeholder="350" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="iot_sensor_count">IoT Sensor Count</Label>
              <Input {...register("iot_sensor_count")} type="number" placeholder="150" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="iot_power_per_sensor_mw">IoT Power per Sensor (mW)</Label>
              <Input {...register("iot_power_per_sensor_mw")} type="number" step="0.01" placeholder="0.06" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="daily_data_generation_gb">Daily Data Generation (GB)</Label>
              <Input {...register("daily_data_generation_gb")} type="number" step="0.1" placeholder="75" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="data_retention_years">Data Retention (Years)</Label>
              <Input {...register("data_retention_years")} type="number" placeholder="5" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="network_bandwidth_mbps">Network Bandwidth (Mbps)</Label>
              <Input {...register("network_bandwidth_mbps")} type="number" placeholder="1500" className="mt-2" />
            </div>

            <div>
              <Label htmlFor="annual_maintenance_hours">Annual Maintenance Hours</Label>
              <Input {...register("annual_maintenance_hours")} type="number" placeholder="600" className="mt-2" />
            </div>

            <div>
              <Label htmlFor="maintenance_energy_kwh_per_hour">Maintenance Energy (kWh/hour)</Label>
              <Input {...register("maintenance_energy_kwh_per_hour")} type="number" placeholder="18" className="mt-2" />
            </div>
          </div>

          <Button type="submit" className="w-full">Complete Step</Button>
        </form>
      </CardContent>
    </Card>
  )
}

// Step 3: Regional Parameters (final step — assemble nested form_data here)
const RegionalParametersStep = ({ onSubmit, initialData }: any) => {
  const { register, handleSubmit } = useForm({ defaultValues: initialData })

  const submitForm = (data: any) => {
    // Build a final nested form_data object using values from initialData (previous steps)
    // and data (this step). parseFloat/parseInt with sane defaults.
    const operational = {
      annual_production_volume: parseFloat(initialData?.annual_production_volume ?? 15000),
      operating_hours_per_year: parseFloat(initialData?.operating_hours_per_year ?? 8760),
      factory_floor_area_m2: parseFloat(initialData?.factory_floor_area_m2 ?? 7500),
      annual_electricity_kwh: parseFloat(initialData?.annual_electricity_kwh ?? 1500000),
      electricity_peak_demand_kw: parseFloat(initialData?.electricity_peak_demand_kw ?? 750),
      server_count: parseInt(initialData?.server_count ?? 15, 10),
      server_avg_power_watts: parseFloat(initialData?.server_avg_power_watts ?? 350),
      iot_sensor_count: parseInt(initialData?.iot_sensor_count ?? 150, 10),
      iot_power_per_sensor_mw: parseFloat(initialData?.iot_power_per_sensor_mw ?? 0.06),
      daily_data_generation_gb: parseFloat(initialData?.daily_data_generation_gb ?? 75),
      data_retention_years: parseInt(initialData?.data_retention_years ?? 5, 10),
      network_bandwidth_mbps: parseInt(initialData?.network_bandwidth_mbps ?? 1500, 10),
      annual_maintenance_hours: parseFloat(initialData?.annual_maintenance_hours ?? 600),
      maintenance_energy_kwh_per_hour: parseFloat(initialData?.maintenance_energy_kwh_per_hour ?? 18.0)
    }

    const regional = {
      grid_carbon_intensity_kg_co2_per_kwh: parseFloat(data.grid_carbon_intensity_kg_co2_per_kwh ?? 0.45),
      grid_renewable_percentage: parseFloat(data.grid_renewable_percentage ?? 35.0),
      water_stress_factor: parseFloat(data.water_stress_factor ?? 1.2),
      water_energy_intensity_kwh_per_m3: parseFloat(data.water_energy_intensity_kwh_per_m3 ?? 0.6),
      regional_recycling_rate: parseFloat(data.regional_recycling_rate ?? 55.0),
      electricity_price_per_kwh: parseFloat(data.electricity_price_per_kwh ?? 0.18),
      carbon_price_per_ton: parseFloat(data.carbon_price_per_ton ?? 65.0)
    }

    const formData = {
      name: initialData?.name ?? "Digital Twin Manufacturing System ELCA",
      industry_type: initialData?.industry_type ?? "manufacturing",
      assessment_years: parseInt(initialData?.assessment_years ?? 5, 10),
      functional_unit_description: initialData?.functional_unit_description ?? "Annual production with digital twin system",
      operational_data: operational,
      regional_params: regional
    }

    console.log('Final ELCA form_data being submitted (snake_case nested):', formData)
    // Important: we call onSubmit with the final `formData` object only. Assessment.tsx will wrap it
    // into the larger payload (assessment_id, user_id, metadata).
    onSubmit(formData)
  }

  return (
    <Card className="shadow-md">
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit(submitForm)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="grid_carbon_intensity_kg_co2_per_kwh">Grid Carbon Intensity (kg CO₂/kWh)</Label>
              <Input {...register("grid_carbon_intensity_kg_co2_per_kwh")} type="number" step="0.01" placeholder="0.45" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="grid_renewable_percentage">Grid Renewable (%)</Label>
              <Input {...register("grid_renewable_percentage")} type="number" placeholder="35" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="water_stress_factor">Water Stress Factor</Label>
              <Input {...register("water_stress_factor")} type="number" step="0.1" placeholder="1.2" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="water_energy_intensity_kwh_per_m3">Water Energy Intensity (kWh/m³)</Label>
              <Input {...register("water_energy_intensity_kwh_per_m3")} type="number" step="0.1" placeholder="0.6" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="regional_recycling_rate">Regional Recycling Rate (%)</Label>
              <Input {...register("regional_recycling_rate")} type="number" placeholder="55" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="electricity_price_per_kwh">Electricity Price ($/kWh)</Label>
              <Input {...register("electricity_price_per_kwh")} type="number" step="0.01" placeholder="0.18" className="mt-2" />
            </div>
            
            <div>
              <Label htmlFor="carbon_price_per_ton">Carbon Price ($/ton)</Label>
              <Input {...register("carbon_price_per_ton")} type="number" placeholder="65" className="mt-2" />
            </div>
          </div>

          <Button type="submit" className="w-full">Complete Assessment</Button>
        </form>
      </CardContent>
    </Card>
  )
}

export const getELCASteps = () => [
  {
    title: "Assessment Overview",
    description: "Basic information about your environmental assessment",
    component: <AssessmentOverviewStep />
  },
  {
    title: "Operational Data",
    description: "System operation parameters and resource consumption",
    component: <OperationalDataStep />
  },
  {
    title: "Regional Parameters",
    description: "Location-specific environmental factors",
    component: <RegionalParametersStep />
  }
]
