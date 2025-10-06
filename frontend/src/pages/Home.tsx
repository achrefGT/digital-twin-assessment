import { Button } from "@/components/ui/enhanced-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useNavigate } from "react-router-dom"
import { Leaf, DollarSign, Globe, Users, Shield, Activity, ArrowRight, CheckCircle, Sparkles, Brain, List } from "lucide-react"
import { useState, useEffect } from "react"
import { UserNavigation } from "@/components/UserNavigation"
import AnimatedBackground from "@/components/AnimatedBackground"
import { LanguageSwitcher } from "@/components/ui/language-switcher"
import { useLanguage } from "@/contexts/LanguageContext"

const Home = () => {
  const [showNavbarButtons, setShowNavbarButtons] = useState(false)
  const navigate = useNavigate()
  const { t } = useLanguage()

  const assessmentDomains = [
    {
      id: "sustainability",
      title: t('domain.sustainability.title'),
      tagline: t('domain.sustainability.tagline'),
      description: t('domain.sustainability.description'),
      icon: Sparkles,
      gradient: "from-green-500 to-emerald-600",
      bgGradient: "from-green-50 to-emerald-50",
      borderColor: "border-green-200 hover:border-green-400",
      features: [t('domain.sustainability.environmental'), t('domain.sustainability.economic'), t('domain.sustainability.social')]
    },
    {
      id: "human_centricity",
      title: t('domain.humanCentricity.title'),
      tagline: t('domain.humanCentricity.tagline'),
      description: t('domain.humanCentricity.description'),
      icon: Brain,
      gradient: "from-blue-500 to-cyan-600",
      bgGradient: "from-blue-50 to-cyan-50",
      borderColor: "border-blue-200 hover:border-blue-400",
      features: [t('domain.humanCentricity.uxTrust'), t('domain.humanCentricity.workload'), t('domain.humanCentricity.performance')]
    },
    {
      id: "resilience",
      title: t('domain.resilience.title'),
      tagline: t('domain.resilience.tagline'), 
      description: t('domain.resilience.description'),
      icon: Shield,
      gradient: "from-purple-500 to-violet-600",
      bgGradient: "from-purple-50 to-violet-50",
      borderColor: "border-purple-200 hover:border-purple-400",
      features: [t('domain.resilience.riskScenarios'), t('domain.resilience.impactAnalysis'), t('domain.resilience.resilienceMetrics')]
    }
  ]

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY
      const triggerPoint = 300
      
      // Show navbar action buttons after scroll trigger point
      if (scrollPosition > triggerPoint) {
        setShowNavbarButtons(true)
      } else {
        setShowNavbarButtons(false)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar: visible from the start, profile always shown; action buttons animate in after scroll */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 transition-all duration-300">
        <style>{`
          /* CTA / navbar animations */
          .nav-button { 
            transition: transform .36s cubic-bezier(.2,.9,.2,1), opacity .36s; 
            transform: translateY(-8px); 
            opacity: 0; 
          }
          .nav-button.show { 
            transform: translateY(0); 
            opacity: 1; 
          }
          
          /* Hero CTA animations - matching navbar style but using non-Tailwind state class names */
          .hero-ctas {
            transition: transform .36s cubic-bezier(.2,.9,.2,1), opacity .36s;
            transform: translateY(0);
            opacity: 1;
          }
          /* hidden state (animates out) */
          .hero-ctas.hide {
            transform: translateY(-12px) scale(.98);
            opacity: 0;
            pointer-events: none;
          }
          /* visible state (animates in) */
          .hero-ctas.show {
            transform: translateY(0) scale(1);
            opacity: 1;
            pointer-events: auto;
          }
          
          /* Individual CTA button animations - matching navbar exactly */
          .hero-cta-button {
            transition: transform .36s cubic-bezier(.2,.9,.2,1), opacity .36s;
            transform: translateY(-8px);
            opacity: 0;
          }
          
          /* when container has .show, reveal buttons with no override to display */
          .hero-ctas.show .hero-cta-button {
            transform: translateY(0);
            opacity: 1;
          }

          /* small stagger so the second button appears slightly after the first */
          .hero-ctas.show .hero-cta-button:nth-child(1) {
            transition-delay: 0ms;
          }
          .hero-ctas.show .hero-cta-button:nth-child(2) {
            transition-delay: 50ms;
          }
          .hero-ctas.show .hero-cta-button:nth-child(3) {
            transition-delay: 100ms;
          }
        `}</style>

        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div 
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => navigate('/')}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-blue-600 rounded-lg flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                <Sparkles className="w-5 h-5 text-white group-hover:rotate-12 transition-transform duration-300" />
              </div>
              <span className="text-l font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent group-hover:from-green-600 group-hover:to-blue-600 transition-all duration-300">
                Digital Twin Assesor
              </span>
            </div>

            {/* Navigation Actions */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3" aria-hidden={!showNavbarButtons}>
                <Button
                  size="sm"
                  onClick={showNavbarButtons ? () => navigate('/assessment') : undefined}
                  className={`group relative px-4 py-2.5 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden nav-button ${
                    showNavbarButtons ? 'show' : ''
                  }`}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
                    pointerEvents: showNavbarButtons ? 'auto' : 'none'
                  }}
                  aria-label="Create assessment"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center gap-2">
                    <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" />
                    <span>{t('assessments.create')}</span>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={showNavbarButtons ? () => navigate('/assessments') : undefined}
                  className={`group relative px-4 py-2.5 rounded-xl font-semibold transition-all duration-300 hover:scale-105 bg-white/10 border-2 border-gray-200 text-gray-900 hover:text-gray-900 backdrop-blur-sm hover:bg-gray-50 hover:border-gray-300 nav-button ${
                    showNavbarButtons ? 'show' : ''
                  }`}
                  style={{
                    pointerEvents: showNavbarButtons ? 'auto' : 'none'
                  }}
                  aria-label="View assessments"
                >
                  <div className="relative flex items-center gap-2">
                    <List className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
                    <span>{t('assessments.title')}</span>
                  </div>
                </Button>
              </div>

              <LanguageSwitcher />
              <UserNavigation />
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
             <h1 className="text-6xl font-bold mb-6 mt-4 text-white leading-tight">
              <span className="block">{t('home.assessmentPlatform')}</span>
              <span className="block bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                {t('home.title')}
              </span>
            </h1>
            
            <p className="text-xl text-gray-200 mb-12 leading-relaxed max-w-3xl mx-auto">
              {t('home.subtitle')}
            </p>
            
            {/* Hero CTAs with scroll-based visibility and improved animations */}
            <div
              className={`flex flex-col sm:flex-row gap-4 justify-center hero-ctas ${
                showNavbarButtons ? 'hide' : 'show'
              }`}
              aria-hidden={showNavbarButtons}
            >
              <Button 
                size="lg"
                onClick={() => navigate('/assessment')}
                className="hero-cta-button bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-sm hover:scale-105"
              >
                <div className="relative flex items-center justify-center">
                  <Sparkles className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform duration-300" />
                  {t('home.getStarted')}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </Button>
              
              <Button 
                variant="outline"
                size="lg"
                onClick={() => navigate('/assessments')}
                className="hero-cta-button border-2 border-white/30 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 hover:border-white/50 px-8 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105"
              >
                <div className="relative flex items-center justify-center">
                  <List className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform duration-300" />
                  {t('assessments.title')}
                </div>
              </Button>
              
            </div>
          </div>
        </div>
      </div>

      {/* Assessment Domains */}
      <div className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('home.assessmentDomains')}</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {t('home.comprehensiveEvaluation')}
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
                    {domain.id === 'sustainability' ? t('domain.sustainability.assessmentTypes') : t('domain.humanCentricity.keyFeatures')}
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
                      {t('domain.explore')} {domain.title}
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
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('home.whyChoose')}</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {t('home.advancedAssessment')}
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{t('home.comprehensiveAnalysis')}</h3>
              <p className="text-gray-600">{t('home.comprehensiveAnalysisDesc')}</p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <Activity className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{t('home.realTimeInsights')}</h3>
              <p className="text-gray-600">{t('home.realTimeInsightsDesc')}</p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-green-500 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{t('home.userCentricDesign')}</h3>
              <p className="text-gray-600">{t('home.userCentricDesignDesc')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home