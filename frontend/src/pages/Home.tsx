import { Button } from "@/components/ui/enhanced-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useNavigate } from "react-router-dom"
import { Leaf, DollarSign, Globe, Users, Shield, Activity, ArrowRight, CheckCircle, Sparkles, Brain } from "lucide-react"
import { useState, useEffect, useRef } from "react"

const assessmentDomains = [
  /*{
    id: "LCA",
    title: "SustainabilityLCA",
    tagline: "Environmental & Economic Impact",
    description: "Evaluate environmental footprint, social responsibility, and economic viability throughout the system lifecycle",
    icon: Sparkles,
    gradient: "from-green-500 to-emerald-600",
    bgGradient: "from-green-50 to-emerald-50",
    borderColor: "border-green-200 hover:border-green-400",
    features: ["Environmental LCA (ELCA)", "Social LCA (SLCA)", "Life Cycle Costing (LCC)"],
    subDomains: [
      {
        id: "elca",
        title: "Environmental Life Cycle Assessment",
        description: "Carbon footprint and environmental impact analysis",
        features: ["Carbon intensity", "Energy consumption", "Regional parameters"]
      },
      {
        id: "slca", 
        title: "Social Life Cycle Assessment",
        description: "Social impacts including worker safety and community engagement",
        features: ["Worker satisfaction", "Community engagement", "Stakeholder analysis"]
      },
      {
        id: "lcc",
        title: "Life Cycle Costing",
        description: "Financial assessment of costs and benefits over system lifetime",
        features: ["CAPEX/OPEX analysis", "ROI calculations", "Benefit tracking"]
      }
    ]
  },*/
 {
    id: "sustainability",
    title: "Sustainability",
    tagline: "Balancing environmental, economic, and social impact",
    description: "Evaluate the system’s long-term resilience and performance across environmental, economic, and social dimensions.",
    icon: Sparkles,
    gradient: "from-green-500 to-emerald-600",
    bgGradient: "from-green-50 to-emerald-50",
    borderColor: "border-green-200 hover:border-green-400",
    features: ["Environmental", "Economic", "Social"]
  },
  {
    id: "human_centricity",
    title: "Human Centricity",
    tagline: "User Experience & Trust",
    description: "Assess user experience quality, trust factors, workload distribution, and human-system interaction performance",
    icon: Brain,
    gradient: "from-blue-500 to-cyan-600",
    bgGradient: "from-blue-50 to-cyan-50",
    borderColor: "border-blue-200 hover:border-blue-400",
    features: ["UX/Trust metrics", "Workload analysis", "Performance tracking"]
  },
  {
    id: "resilience",
    title: "Resilience",
    tagline: "System Robustness & Risk Management", 
    description: "Evaluate system adaptability, redundancy mechanisms, and comprehensive risk management capabilities",
    icon: Shield,
    gradient: "from-purple-500 to-violet-600",
    bgGradient: "from-purple-50 to-violet-50",
    borderColor: "border-purple-200 hover:border-purple-400",
    features: ["Risk scenarios", "Impact analysis", "Resilience metrics"]
  }
]

// Animated Background Component
const AnimatedBackground = () => {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Generate resilience network nodes
    const createResilienceNodes = () => {
      for (let i = 0; i < 12; i++) {
        const node = document.createElement('div')
        node.className = 'resilience-node'
        node.style.cssText = `
          position: absolute;
          width: 12px;
          height: 12px;
          background: radial-gradient(circle, #3b82f6, #1e40af);
          border: 2px solid rgba(34, 197, 94, 0.6);
          border-radius: 50%;
          box-shadow: 0 0 15px rgba(59, 130, 246, 0.8), 0 0 25px rgba(34, 197, 94, 0.4);
          animation: resilienceFloat 8s ease-in-out infinite;
          left: ${Math.random() * 100}%;
          top: ${Math.random() * 100}%;
          animation-delay: ${Math.random() * 8}s;
        `
        
        const pulse = document.createElement('div')
        pulse.style.cssText = `
          position: absolute;
          top: -4px;
          left: -4px;
          width: 16px;
          height: 16px;
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 50%;
          animation: resiliencePulse 3s ease-in-out infinite;
        `
        node.appendChild(pulse)
        container.appendChild(node)
      }
    }

    // Generate human-centric icons
    const createHumanIcons = () => {
      for (let i = 0; i < 8; i++) {
        const icon = document.createElement('div')
        icon.className = 'human-icon'
        icon.style.cssText = `
          position: absolute;
          width: 20px;
          height: 20px;
          animation: humanGlow 4s ease-in-out infinite;
          left: ${Math.random() * 100}%;
          top: ${Math.random() * 100}%;
          animation-delay: ${Math.random() * 4}s;
        `
        
        const head = document.createElement('div')
        head.style.cssText = `
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 8px;
          height: 8px;
          background: #f59e0b;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.8);
        `
        
        const body = document.createElement('div')
        body.style.cssText = `
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 12px;
          height: 10px;
          background: #f59e0b;
          border-radius: 0 0 6px 6px;
          box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
        `
        
        icon.appendChild(head)
        icon.appendChild(body)
        container.appendChild(icon)
      }
    }

    // Generate industrial hexagons
    const createIndustrialHexagons = () => {
      for (let i = 0; i < 6; i++) {
        const hex = document.createElement('div')
        hex.className = 'industrial-hex'
        hex.style.cssText = `
          position: absolute;
          width: 80px;
          height: 80px;
          background: transparent;
          border: 2px solid rgba(34, 197, 94, 0.3);
          transform: rotate(30deg);
          animation: industrialRotate 12s linear infinite;
          left: ${Math.random() * 100}%;
          top: ${Math.random() * 100}%;
          animation-delay: ${Math.random() * 12}s;
        `
        
        const before = document.createElement('div')
        before.style.cssText = `
          position: absolute;
          width: 80px;
          height: 80px;
          background: transparent;
          border: 2px solid rgba(59, 130, 246, 0.25);
          transform: rotate(60deg);
        `
        
        const after = document.createElement('div')
        after.style.cssText = `
          position: absolute;
          width: 80px;
          height: 80px;
          background: transparent;
          border: 2px solid rgba(245, 158, 11, 0.2);
          transform: rotate(-60deg);
        `
        
        hex.appendChild(before)
        hex.appendChild(after)
        container.appendChild(hex)
      }
    }

    // Generate assessment metric bars
    const createMetricBars = () => {
      for (let i = 0; i < 10; i++) {
        const bar = document.createElement('div')
        bar.className = 'metric-bar'
        bar.style.cssText = `
          position: absolute;
          height: 4px;
          background: linear-gradient(90deg, #ef4444 0%, #f59e0b 33%, #22c55e 66%, #3b82f6 100%);
          border-radius: 2px;
          animation: metricsFlow 5s ease-in-out infinite;
          box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
          left: ${Math.random() * 100}%;
          top: ${Math.random() * 100}%;
          animation-delay: ${Math.random() * 5}s;
        `
        container.appendChild(bar)
      }
    }

    // Generate eco flow lines
    const createEcoFlowLines = () => {
      const interval = setInterval(() => {
        const line = document.createElement('div')
        line.className = 'eco-flow-line'
        line.style.cssText = `
          position: absolute;
          height: 2px;
          background: linear-gradient(90deg, transparent, #22c55e 20%, #3b82f6 50%, #22c55e 80%, transparent);
          animation: ecoDataFlow 4s linear infinite;
          opacity: 0.7;
          top: ${Math.random() * 100}%;
          width: ${Math.random() * 400 + 150}px;
        `
        container.appendChild(line)
        
        setTimeout(() => {
          if (line.parentNode) line.remove()
        }, 4000)
      }, 2000)

      return () => clearInterval(interval)
    }

    // Generate eco particles
    const createEcoParticles = () => {
      const interval = setInterval(() => {
        const particle = document.createElement('div')
        particle.className = 'eco-particle'
        particle.style.cssText = `
          position: absolute;
          width: 3px;
          height: 3px;
          background: #22c55e;
          border-radius: 50%;
          box-shadow: 0 0 6px #22c55e;
          animation: ecoParticleFloat 10s linear infinite;
          left: ${Math.random() * 100}%;
        `
        container.appendChild(particle)
        
        setTimeout(() => {
          if (particle.parentNode) particle.remove()
        }, 10000)
      }, 1200)

      return () => clearInterval(interval)
    }

    // Initialize all elements
    createResilienceNodes()
    createHumanIcons()
    createIndustrialHexagons()
    createMetricBars()
    const cleanupFlowLines = createEcoFlowLines()
    const cleanupParticles = createEcoParticles()

    // Mouse interaction
    const handleMouseMove = (e) => {
      const mouseX = e.clientX / window.innerWidth
      const mouseY = e.clientY / window.innerHeight
      
      // Adjust grid based on mouse position
      const grid = container.querySelector('.sustainability-grid')
      if (grid) {
        grid.style.transform = `translate(${mouseX * 15}px, ${mouseY * 15}px)`
      }
    }

    container.addEventListener('mousemove', handleMouseMove)

    return () => {
      cleanupFlowLines()
      cleanupParticles()
      container.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <>
      <style>
        {`
          @keyframes sustainabilityPulse {
            0%, 100% { opacity: 0.4; }
            33% { opacity: 0.8; }
            66% { opacity: 0.6; }
          }
          
          @keyframes resilienceFloat {
            0%, 100% { transform: translateY(0px) scale(1); }
            25% { transform: translateY(-15px) scale(1.1); }
            75% { transform: translateY(8px) scale(0.95); }
          }
          
          @keyframes resiliencePulse {
            0%, 100% { transform: scale(1); opacity: 0.4; }
            50% { transform: scale(2); opacity: 0.8; }
          }
          
          @keyframes humanGlow {
            0%, 100% { opacity: 0.6; filter: brightness(1); }
            50% { opacity: 1; filter: brightness(1.3); }
          }
          
          @keyframes ecoDataFlow {
            0% { transform: translateX(-100%); opacity: 0; }
            15% { opacity: 0.7; }
            85% { opacity: 0.7; }
            100% { transform: translateX(100vw); opacity: 0; }
          }
          
          @keyframes industrialRotate {
            0% { transform: rotate(30deg); opacity: 0.3; }
            50% { opacity: 0.7; }
            100% { transform: rotate(390deg); opacity: 0.3; }
          }
          
          @keyframes metricsFlow {
            0%, 100% { width: 50px; opacity: 0.4; filter: blur(0px); }
            50% { width: 200px; opacity: 0.9; filter: blur(1px); }
          }
          
          @keyframes coreAssessment {
            0%, 100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 0.6; }
            33% { transform: translate(-50%, -50%) scale(1.1) rotate(120deg); opacity: 0.9; }
            66% { transform: translate(-50%, -50%) scale(0.95) rotate(240deg); opacity: 0.8; }
          }
          
          @keyframes ecoParticleFloat {
            0% { transform: translateY(100vh) translateX(0px) scale(0); opacity: 0; }
            10% { opacity: 1; transform: translateY(90vh) translateX(20px) scale(1); }
            90% { opacity: 0.8; transform: translateY(10vh) translateX(100px) scale(1.2); }
            100% { transform: translateY(-10px) translateX(150px) scale(0); opacity: 0; }
          }
        `}
      </style>
      
      <div 
        ref={containerRef}
        className="absolute inset-0 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0a0f0a 0%, #1a2e1a 20%, #16213e 50%, #2e3a1a 80%, #0f1f23 100%)'
        }}
      >
        {/* Sustainability Grid */}
        <div 
          className="sustainability-grid absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(34, 197, 94, 0.15) 1px, transparent 1px),
              linear-gradient(90deg, rgba(34, 197, 94, 0.15) 1px, transparent 1px),
              linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px, 60px 60px, 20px 20px, 20px 20px',
            animation: 'sustainabilityPulse 6s ease-in-out infinite'
          }}
        />
        
        {/* Central Assessment Symbol */}
        <div 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          style={{
            width: '120px',
            height: '120px',
            border: '3px solid rgba(34, 197, 94, 0.4)',
            borderRadius: '50%',
            animation: 'coreAssessment 6s ease-in-out infinite'
          }}
        >
          <div 
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            style={{
              width: '80px',
              height: '80px',
              border: '2px solid rgba(59, 130, 246, 0.5)',
              borderRadius: '50%',
              animation: 'coreAssessment 6s ease-in-out infinite reverse'
            }}
          />
          <div 
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            style={{
              width: '40px',
              height: '40px',
              border: '2px solid rgba(245, 158, 11, 0.6)',
              borderRadius: '50%',
              animation: 'coreAssessment 6s ease-in-out infinite'
            }}
          />
        </div>
      </div>
    </>
  )
}

const Home = () => {
  const [showNavbar, setShowNavbar] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const handleScroll = () => {
      setShowNavbar(window.scrollY > 400)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Scroll Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-none border-b border-gray-200 transition-all duration-300 ${
        showNavbar ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}>
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Digital Twin Platform</span>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              >
                Dashboard
              </Button>
              <Button
                onClick={() => navigate('/assessment')}
                className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white"
              >
                Create Assessment
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Animated Background */}
      <div className="relative min-h-screen">
        <AnimatedBackground />
        
        {/* Content overlay */}
        <div className="relative z-10 container mx-auto px-6 py-20 min-h-screen flex items-center">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium mb-8 border border-white/20">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Next-Generation Assessment Platform
            </div>
            
            <h1 className="text-6xl font-bold mb-6 text-white leading-tight">
              Digital Twin
              <span className="block bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                Assessment Platform
              </span>
            </h1>
            
            <p className="text-xl text-gray-200 mb-12 leading-relaxed max-w-3xl mx-auto">
              Comprehensive evaluation framework for digital twin systems across sustainability, 
              human centricity, and resilience dimensions with advanced analytics and insights.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                onClick={() => navigate('/assessment')}
                className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-sm"
              >
                Start Assessment
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="outline"
                size="lg"
                onClick={() => navigate('/dashboard')}
                className="border-2 border-white/30 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 hover:border-white/50 px-8 py-3 rounded-xl font-semibold transition-all duration-300"
              >
                View Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Assessment Domains */}
      <div className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Assessment Domains</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Comprehensive evaluation across three critical dimensions of digital twin systems
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {assessmentDomains.map((domain, index) => {
            const IconComponent = domain.icon
            return (
              <Card 
                key={domain.id} 
                className={`group cursor-pointer border-2 ${domain.borderColor} bg-gradient-to-br ${domain.bgGradient} hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] rounded-2xl overflow-hidden`}
                onClick={() => { navigate(`/assessment/${domain.id}`)}}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-4 rounded-2xl bg-gradient-to-br ${domain.gradient} shadow-lg`}>
                      <IconComponent className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  
                  <CardTitle className="text-2xl font-bold text-gray-900 mb-2 group-hover:bg-gradient-to-r group-hover:from-gray-900 group-hover:to-gray-700 group-hover:bg-clip-text transition-all duration-300">
                    {domain.title}
                  </CardTitle>
                  
                  <CardDescription className="text-gray-600 leading-relaxed text-base">
                    {domain.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-700 mb-3">
                      {domain.id === 'sustainability' ? 'Assessment Types:' : 'Key Features:'}
                    </p>
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
                      Explore {domain.title}
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Features Overview */}
      <div className="bg-gray-50 py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Choose Our Platform</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Advanced assessment capabilities designed for comprehensive digital twin evaluation
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Comprehensive Analysis</h3>
              <p className="text-gray-600">Multi-dimensional assessment across sustainability, human factors, and system resilience</p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <Activity className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Real-time Insights</h3>
              <p className="text-gray-600">Advanced analytics with real-time monitoring and performance tracking capabilities</p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-green-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">User-Centric Design</h3>
              <p className="text-gray-600">Intuitive interface designed for researchers, engineers, and decision-makers</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home