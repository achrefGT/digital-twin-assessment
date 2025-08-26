import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AssessmentDashboard } from '@/components/dashboard/AssessmentDashboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Plus, Activity, Sparkles, CheckCircle, BarChart3 } from 'lucide-react'
import { useAssessment } from '@/hooks/useAssessment'

export default function Dashboard() {
  const navigate = useNavigate()
  const { currentAssessment, isLoading, clearAssessment, createAssessment } = useAssessment()

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading Dashboard</h3>
          <p className="text-gray-600">Fetching your assessment data...</p>
        </div>
      </div>
    )
  }

  // If no assessment exists, show create assessment prompt
  if (!currentAssessment) {
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
                  <ArrowLeft className="w-5 h-5 text-black" />
                </Button>
                <div className="h-6 w-px bg-gray-300" />
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-bold text-gray-900">Dashboard</span>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-gray-50" />
          <div className="relative container mx-auto px-6 py-16">
            <div className="max-w-2xl mx-auto text-center">
              
              {/* Hero Section */}
              <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-8">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                Assessment Required
              </div>
              
              <h1 className="text-4xl font-bold text-gray-900 mb-6">
                No Assessment
                <span className="block bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Found
                </span>
              </h1>
              
              <p className="text-xl text-gray-600 mb-12 leading-relaxed">
                You need to create an assessment before viewing the dashboard. 
                Get started with your digital twin evaluation today.
              </p>
              
              {/* Action Cards */}
              <div className="grid md:grid-cols-2 gap-6 mb-12">
                <Card className="group cursor-pointer border-2 border-green-200 hover:border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 hover:shadow-xl transition-all duration-500 hover:scale-[1.02] rounded-2xl overflow-hidden">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Plus className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:bg-gradient-to-r group-hover:from-gray-900 group-hover:to-gray-700 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
                      Create Assessment
                    </h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                      Start a new comprehensive assessment to evaluate your digital twin system
                    </p>
                    <Button 
                      onClick={() => {
                        clearAssessment()
                        navigate('/assessment')
                      }}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      Create New Assessment
                    </Button>
                  </CardContent>
                </Card>

                <Card className="group cursor-pointer border-2 border-blue-200 hover:border-blue-400 bg-gradient-to-br from-blue-50 to-cyan-50 hover:shadow-xl transition-all duration-500 hover:scale-[1.02] rounded-2xl overflow-hidden">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl mx-auto mb-4 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Activity className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:bg-gradient-to-r group-hover:from-gray-900 group-hover:to-gray-700 group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
                      Explore Domains
                    </h3>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                      Learn about sustainability, human centricity, and resilience assessments
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => navigate('/')}
                      className="w-full border-2 border-blue-200 hover:border-blue-300 text-blue-700 hover:bg-blue-100 hover:text-blue-700 font-semibold rounded-xl transition-all duration-300"
                    >
                      View Assessment Domains
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Information Section */}
              <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">💡 Getting Started</h3>
                <p className="text-gray-600 leading-relaxed">
                  The dashboard provides real-time insights into your digital twin assessment progress. 
                  Create an assessment to unlock comprehensive analytics, scoring, and domain-specific evaluations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Modern Header with assessment info and actions */}
        <nav className="border-b border-gray-200 bg-white/95 backdrop-blur-sm">
          <div className="container mx-auto px-6">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/')}
                  className="-ml-2 p-2 hover:translate-x-[-4px] transition-transform duration-200 hover:bg-white"
                >
                  <ArrowLeft className="w-5 h-5 text-black" />
                </Button>
                <div className="h-6 w-px bg-gray-300" />
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xl font-bold text-gray-900">Dashboard</span>
                </div>
              </div>
            </div>
          </div>
        </nav>
      
      {/* Dashboard Content - Remove extra background since AssessmentDashboard handles it */}
      <AssessmentDashboard assessmentId={currentAssessment.assessment_id} />
    </div>
  )
}
<div className="flex items-center gap-3">
  <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
    <BarChart3 className="w-5 h-5 text-white" />
  </div>
  <span className="text-xl font-bold text-gray-900">Dashboard</span>
</div>