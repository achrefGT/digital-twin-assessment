import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { AssessmentsList } from '@/components/dashboard/AssessmentsList'
import { Assessment } from '@/services/assessmentApi'

export default function AssessmentsListPage() {
  const navigate = useNavigate()

  const handleSelectAssessment = (assessment: Assessment) => {
    // Navigate to the specific assessment dashboard
    navigate(`/dashboard/${assessment.assessment_id}`)
  }

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
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">Assessments List</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Assessments List */}
      <AssessmentsList onSelectAssessment={handleSelectAssessment} />
    </div>
  )
}