import { Button } from "@/components/ui/enhanced-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Globe, Users, DollarSign, CheckCircle, ArrowRight, Sparkles, Leaf } from "lucide-react"

const sustainabilityDomains = [
  {
    id: "elca",
    title: "Environmental Life Cycle Assessment",
    description: "Comprehensive environmental impact analysis and carbon footprint assessment across the system lifecycle",
    icon: Leaf,
    gradient: "from-green-500 to-emerald-600",
    bgGradient: "from-green-50 to-emerald-50",
    borderColor: "border-green-200 hover:border-green-400",
    features: ["Carbon intensity analysis", "Energy consumption tracking", "Regional environmental parameters", "Operational data modeling"],
    focus: "Environmental Impact"
  },
  {
    id: "slca", 
    title: "Social Life Cycle Assessment",
    description: "Evaluate social impacts including worker safety, community engagement, and stakeholder welfare",
    icon: Users,
    gradient: "from-blue-500 to-cyan-600",
    bgGradient: "from-blue-50 to-cyan-50",
    borderColor: "border-blue-200 hover:border-blue-400",
    features: ["Worker satisfaction metrics", "Community engagement scores", "Stakeholder impact analysis", "Social indicator tracking"],
    focus: "Social Impact"
  },
  {
    id: "lcc",
    title: "Life Cycle Costing",
    description: "Financial assessment of costs and benefits over the system's lifetime with comprehensive ROI analysis",
    icon: DollarSign,
    gradient: "from-purple-500 to-violet-600",
    bgGradient: "from-purple-50 to-violet-50",
    borderColor: "border-purple-200 hover:border-purple-400",
    features: ["CAPEX/OPEX analysis", "ROI calculations", "Benefit-cost tracking", "Financial forecasting"],
    focus: "Economic Impact"
  }
]

const Sustainability = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header */}
      <nav className="border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/')}
                className="-ml-2 p-2 hover:translate-x-[-4px] transition-transform duration-200 hover:bg-white"
              >
                <ArrowLeft className="w-6 h-6 text-black" />
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">Sustainability Assessment</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-gray-50" />
        <div className="relative container mx-auto px-6 py-16">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-8">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Triple Bottom Line Framework
            </div>
            
            <h1 className="text-5xl font-bold mb-6 text-gray-900 leading-tight">
              Sustainability
              <span className="block bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                Assessment Framework
              </span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-12 leading-relaxed max-w-3xl mx-auto">
              Comprehensive sustainability evaluation covering environmental, social, and economic dimensions 
              of your digital twin system through standardized life cycle assessment methodologies.
            </p>
          </div>
        </div>
      </div>

      {/* Assessment Options */}
      <div className="container mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Assessment Type</h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Select the specific sustainability assessment that matches your evaluation needs. 
            Each assessment follows international standards and generates comprehensive data for analysis.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {sustainabilityDomains.map((domain) => {
            const IconComponent = domain.icon
            return (
              <Card 
                key={domain.id} 
                className={`group cursor-pointer border-2 ${domain.borderColor} bg-gradient-to-br ${domain.bgGradient} hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] rounded-2xl overflow-hidden`}
                onClick={() => navigate(`/assessment/${domain.id}`)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-4 rounded-2xl bg-gradient-to-br ${domain.gradient} shadow-lg`}>
                      <IconComponent className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  
                  <CardTitle className="text-2xl font-bold text-gray-900 mb-3 group-hover:bg-gradient-to-r group-hover:from-gray-900 group-hover:to-gray-700 group-hover:bg-clip-text transition-all duration-300">
                    {domain.title}
                  </CardTitle>
                  
                  <CardDescription className="text-gray-600 leading-relaxed text-base">
                    {domain.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Assessment Features:</p>
                    <div className="space-y-2">
                      {domain.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="text-sm text-gray-600 font-medium">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-white/60">
                    <div className="flex items-center text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
                      Start {domain.id.toUpperCase()} Assessment
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Information Section */}
      <div className="bg-gray-50 py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Comprehensive Assessment Framework</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our sustainability framework evaluates your digital twin across three critical dimensions
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <Leaf className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Environmental Dimension</h3>
              <p className="text-gray-600 leading-relaxed">
                Evaluate carbon footprint, energy consumption, resource usage, and environmental impact 
                throughout the digital twin system lifecycle.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Social Dimension</h3>
              <p className="text-gray-600 leading-relaxed">
                Assess worker safety, community engagement, stakeholder welfare, and social value 
                creation across the entire value chain.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <DollarSign className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Economic Dimension</h3>
              <p className="text-gray-600 leading-relaxed">
                Analyze total cost of ownership, return on investment, and long-term financial 
                benefits of digital twin implementation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-6 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to Begin?</h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Start your comprehensive sustainability assessment or explore other assessment domains.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              onClick={() => navigate('/assessment')}
              className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Create New Assessment
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              variant="outline"
              size="lg"
              onClick={() => navigate('/')}
              className="border-2 border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-700 px-8 py-3 rounded-xl font-semibold transition-all duration-300"
            >
              Explore Other Domains
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sustainability