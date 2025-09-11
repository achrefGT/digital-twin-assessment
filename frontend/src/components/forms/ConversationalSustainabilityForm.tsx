import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/enhanced-button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Leaf, DollarSign, Users, MessageCircle, SkipForward, CheckCircle, ArrowRight } from "lucide-react"

const ConversationalSustainabilityForm = ({ onSubmit, initialData }: any) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [chatHistory, setChatHistory] = useState<Array<{
    type: 'question' | 'answer' | 'system',
    content: string,
    timestamp: Date,
    questionId?: string,
    value?: string
  }>>([])
  const [isComplete, setIsComplete] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const questions = [
    // Environmental Questions
    {
      id: 'digital_twin_realism',
      category: 'environmental',
      icon: <Leaf className="w-4 h-4" />,
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      text: "Let's start with your digital twin setup. How realistic is your current digital twin model?",
      options: [
        { value: "static_plan", label: "Static plan, no link with reality" },
        { value: "simple_3d", label: "Simple 3D shapes" },
        { value: "basic_movements", label: "Model with basic movements" },
        { value: "representative_simulation", label: "Representative simulation: processes realistically simulated" },
        { value: "high_fidelity", label: "High-fidelity model: detailed physical model, very close to reality" },
        { value: "real_time_connection", label: "Real-time connection: complete digital replica, synchronized in real time" }
      ]
    },
    {
      id: 'flow_tracking',
      category: 'environmental',
      icon: <Leaf className="w-4 h-4" />,
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      text: "How well do you track material and energy flows in your system?",
      options: [
        { value: "nothing_tracked", label: "Nothing is tracked" },
        { value: "single_flow", label: "A single flow measured (e.g., electricity)" },
        { value: "multiple_flows", label: "Multiple flows measured separately (e.g., water + energy)" },
        { value: "global_balance", label: "Global balances of main flows (total inputs/outputs)" },
        { value: "detailed_traceability", label: "Detailed traceability workstation by workstation, inside the plant" },
        { value: "complete_supply_chain", label: "Complete tracking including supply chain (upstream/downstream)" }
      ]
    },
    {
      id: 'energy_visibility',
      category: 'environmental',
      icon: <Leaf className="w-4 h-4" />,
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      text: "What's your level of energy consumption visibility?",
      options: [
        { value: "no_data", label: "No data" },
        { value: "annual_bills", label: "Annual bills" },
        { value: "monthly_readings", label: "Monthly readings" },
        { value: "continuous_equipment", label: "Continuous monitoring of major equipment" },
        { value: "real_time_majority", label: "Real-time monitoring of most systems" },
        { value: "precise_subsystem_counting", label: "Precise subsystem and equipment-level metering" }
      ]
    },
    {
      id: 'environmental_scope',
      category: 'environmental',
      icon: <Leaf className="w-4 h-4" />,
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      text: "Which environmental indicators do you currently track?",
      options: [
        { value: "no_indicators", label: "No indicators tracked" },
        { value: "energy_only", label: "Energy only" },
        { value: "energy_carbon", label: "Energy + carbon emissions" },
        { value: "add_water", label: "Add water (consumption, discharges)" },
        { value: "multi_indicators", label: "Multi-indicators: energy, carbon, water, waste, materials" },
        { value: "complete_lifecycle", label: "Full lifecycle analysis (production → use → end of life)" }
      ]
    },
    {
      id: 'simulation_prediction',
      category: 'environmental',
      icon: <Leaf className="w-4 h-4" />,
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      text: "What simulation and prediction capabilities do you have?",
      options: [
        { value: "observation_only", label: "Observation only" },
        { value: "simple_reports", label: "Simple reports and alerts" },
        { value: "basic_change_tests", label: "Basic change tests (e.g., rate, schedules)" },
        { value: "predictive_scenarios", label: "Predictive scenarios with comparisons" },
        { value: "assisted_optimization", label: "Assisted optimization: system proposes several optimal solutions" },
        { value: "autonomous_optimization", label: "Autonomous optimization: twin automatically adjusts parameters" }
      ]
    },

    // Economic Questions
    {
      id: 'digitalization_budget',
      category: 'economic',
      icon: <DollarSign className="w-4 h-4" />,
      color: 'from-purple-500 to-violet-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      text: "Now let's talk economics. How would you describe your digitalization budget?",
      options: [
        { value: "no_budget", label: "No budget allocated for digitizing the system" },
        { value: "minimal_budget", label: "Minimal budget - Basic modeling of the physical system" },
        { value: "correct_budget", label: "Correct budget - Faithful reproduction of main equipment" },
        { value: "large_budget", label: "Large budget - Complete digital copy of the system" },
        { value: "very_large_budget", label: "Very large budget - Ultra-precise twin with advanced sensors" },
        { value: "maximum_budget", label: "Maximum budget - Perfect real-time connected replica" }
      ]
    },
    {
      id: 'savings_realized',
      category: 'economic',
      icon: <DollarSign className="w-4 h-4" />,
      color: 'from-purple-500 to-violet-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      text: "What level of savings have you realized from your digital twin implementation?",
      options: [
        { value: "no_savings", label: "No savings" },
        { value: "small_savings", label: "Small savings" },
        { value: "correct_savings", label: "Correct savings" },
        { value: "good_savings", label: "Good savings" },
        { value: "very_good_savings", label: "Very good savings" },
        { value: "exceptional_savings", label: "Exceptional savings" }
      ]
    },
    {
      id: 'performance_improvement',
      category: 'economic',
      icon: <DollarSign className="w-4 h-4" />,
      color: 'from-purple-500 to-violet-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      text: "How would you rate the performance improvement from your digital twin?",
      options: [
        { value: "no_improvement", label: "No improvement" },
        { value: "small_improvement", label: "Small improvement" },
        { value: "correct_improvement", label: "Correct improvement" },
        { value: "good_improvement", label: "Good improvement" },
        { value: "very_good_improvement", label: "Very good improvement" },
        { value: "exceptional_improvement", label: "Exceptional improvement" }
      ]
    },
    {
      id: 'roi_timeframe',
      category: 'economic',
      icon: <DollarSign className="w-4 h-4" />,
      color: 'from-purple-500 to-violet-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      text: "What's your return on investment (ROI) timeframe?",
      options: [
        { value: "not_calculated_over_5y", label: "Not calculated or more than 5 years" },
        { value: "profitable_3_5y", label: "Profitable between 3 and 5 years" },
        { value: "profitable_2_3y", label: "Profitable between 2 and 3 years" },
        { value: "profitable_18_24m", label: "Profitable between 18 and 24 months" },
        { value: "profitable_12_18m", label: "Profitable between 12 and 18 months" },
        { value: "profitable_under_12m", label: "Profitable in less than 12 months" }
      ]
    },

    // Social Questions
    {
      id: 'employee_impact',
      category: 'social',
      icon: <Users className="w-4 h-4" />,
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      text: "Finally, let's discuss social impact. How has your digital twin affected your workforce?",
      options: [
        { value: "job_suppression_over_10", label: "Job cuts (over 10% of workforce affected)" },
        { value: "some_suppressions_5_10", label: "Some job cuts (5–10% of workforce)" },
        { value: "stable_some_training", label: "Stable workforce, some training" },
        { value: "same_jobs_all_trained", label: "Same number of jobs + training for all concerned" },
        { value: "new_positions_5_10", label: "New positions created (5–10% more jobs)" },
        { value: "strong_job_creation", label: "Strong creation of qualified jobs (over 10% increase)" }
      ]
    },
    {
      id: 'workplace_safety',
      category: 'social',
      icon: <Users className="w-4 h-4" />,
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      text: "What improvements have you seen in workplace safety?",
      options: [
        { value: "no_change", label: "No change in risks" },
        { value: "slight_reduction_under_10", label: "Slight reduction of incidents (<10%)" },
        { value: "moderate_reduction_10_25", label: "Moderate risk reduction (10–25%)" },
        { value: "good_improvement_25_50", label: "Good improvement in safety (25–50%)" },
        { value: "strong_reduction_50_75", label: "Strong reduction in accidents (50–75%)" },
        { value: "near_elimination_over_75", label: "Near elimination of risks (>75% reduction)" }
      ]
    },
    {
      id: 'regional_benefits',
      category: 'social',
      icon: <Users className="w-4 h-4" />,
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      text: "What regional or community benefits has your project created?",
      options: [
        { value: "no_local_impact", label: "No local impact: no local purchases/partnerships identified" },
        { value: "some_local_purchases", label: "Some additional local purchases" },
        { value: "partnership_1_2_companies", label: "Partnership with 1–2 local companies" },
        { value: "institutional_collaboration", label: "Institutional collaboration: active collaboration with local universities/schools" },
        { value: "notable_local_creation", label: "Notable local creation: new local jobs linked to the project" },
        { value: "major_impact", label: "Major impact: new local jobs or significant financial benefits" }
      ]
    }
  ]

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatHistory])

  // Initialize with first question
  useEffect(() => {
    if (chatHistory.length === 0) {
      addSystemMessage("Welcome! I'll guide you through a sustainability assessment for your digital twin system. Feel free to skip any question you're not ready to answer.")
      setTimeout(() => {
        addQuestion(0)
      }, 1000)
    }
  }, [])

  const addSystemMessage = (content: string) => {
    setChatHistory(prev => [...prev, {
      type: 'system',
      content,
      timestamp: new Date()
    }])
  }

  const addQuestion = (index: number) => {
    if (index < questions.length) {
      const question = questions[index]
      setChatHistory(prev => [...prev, {
        type: 'question',
        content: question.text,
        timestamp: new Date(),
        questionId: question.id
      }])
    }
  }

  const addAnswer = (questionId: string, value: string, label: string) => {
    setChatHistory(prev => [...prev, {
      type: 'answer',
      content: label,
      timestamp: new Date(),
      questionId,
      value
    }])
  }

  const handleAnswer = (questionId: string, value: string) => {
    const question = questions.find(q => q.id === questionId)
    const option = question?.options.find(o => o.value === value)
    
    if (!option) return

    // Add answer to chat history
    addAnswer(questionId, value, option.label)
    
    // Update answers state
    setAnswers(prev => ({ ...prev, [questionId]: value }))
    
    // Move to next question or complete
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        const nextIndex = currentQuestionIndex + 1
        setCurrentQuestionIndex(nextIndex)
        addQuestion(nextIndex)
      } else {
        completeAssessment()
      }
    }, 1500)
  }

  const handleSkip = () => {
    const currentQuestion = questions[currentQuestionIndex]
    setChatHistory(prev => [...prev, {
      type: 'answer',
      content: "Skipped this question",
      timestamp: new Date(),
      questionId: currentQuestion.id
    }])

    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        const nextIndex = currentQuestionIndex + 1
        setCurrentQuestionIndex(nextIndex)
        addQuestion(nextIndex)
      } else {
        completeAssessment()
      }
    }, 1000)
  }

  const completeAssessment = () => {
    setIsComplete(true)
    addSystemMessage("Assessment completed! Thank you for your responses. Your data is being processed...")
    
    // Prepare data for submission
    const environmental = {
      digital_twin_realism: answers.digital_twin_realism || "",
      flow_tracking: answers.flow_tracking || "",
      energy_visibility: answers.energy_visibility || "",
      environmental_scope: answers.environmental_scope || "",
      simulation_prediction: answers.simulation_prediction || ""
    }

    const economic = {
      digitalization_budget: answers.digitalization_budget || "",
      savings_realized: answers.savings_realized || "",
      performance_improvement: answers.performance_improvement || "",
      roi_timeframe: answers.roi_timeframe || ""
    }

    const social = {
      employee_impact: answers.employee_impact || "",
      workplace_safety: answers.workplace_safety || "",
      regional_benefits: answers.regional_benefits || ""
    }

    const finalData = {
      environmental,
      economic,
      social,
      assessments: {
        ...initialData?.assessments,
        Environmental: { data: environmental },
        Economic: { data: economic },
        Social: { data: social }
      }
    }

    setTimeout(() => {
      onSubmit(finalData)
    }, 2000)
  }

  const getCurrentQuestion = () => {
    return questions[currentQuestionIndex]
  }

  const getCategoryStats = () => {
    const environmentalAnswers = questions.filter(q => q.category === 'environmental').filter(q => answers[q.id]).length
    const economicAnswers = questions.filter(q => q.category === 'economic').filter(q => answers[q.id]).length
    const socialAnswers = questions.filter(q => q.category === 'social').filter(q => answers[q.id]).length
    
    return { environmentalAnswers, economicAnswers, socialAnswers }
  }

  const stats = getCategoryStats()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Overview */}
      <Card className="bg-gradient-to-r from-slate-50 to-gray-50 border-2">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Conversational Assessment</h3>
                <p className="text-sm text-gray-600">Question {currentQuestionIndex + 1} of {questions.length}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{Object.keys(answers).length} answered</p>
              <p className="text-xs text-gray-500">{questions.length - Object.keys(answers).length} remaining</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full"></div>
              <span className="text-sm text-gray-600">Environmental ({stats.environmentalAnswers}/5)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-br from-purple-500 to-violet-600 rounded-full"></div>
              <span className="text-sm text-gray-600">Economic ({stats.economicAnswers}/4)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full"></div>
              <span className="text-sm text-gray-600">Social ({stats.socialAnswers}/3)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <Card className="border-2 shadow-lg">
        <CardContent className="p-0">
          <div className="h-96 overflow-y-auto p-6 space-y-4" style={{ maxHeight: '400px' }}>
            {chatHistory.map((message, index) => (
              <div key={index} className={`flex ${message.type === 'answer' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                  message.type === 'system' 
                    ? 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 text-center mx-auto text-sm'
                    : message.type === 'question'
                    ? 'bg-gradient-to-r from-blue-50 to-cyan-50 text-gray-800 border border-blue-200'
                    : message.content === "Skipped this question"
                    ? 'bg-gradient-to-r from-yellow-100 to-orange-100 text-gray-700 border border-yellow-200'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                }`}>
                  <p className={`text-sm ${message.type === 'system' ? 'font-medium' : ''}`}>
                    {message.content}
                  </p>
                  {message.type !== 'system' && (
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Answer Interface */}
          {!isComplete && currentQuestionIndex < questions.length && (
            <div className="border-t bg-gray-50 p-6">
              {(() => {
                const currentQuestion = getCurrentQuestion()
                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 bg-gradient-to-br ${currentQuestion.color} rounded-lg flex items-center justify-center`}>
                        {currentQuestion.icon}
                      </div>
                      <Badge className={`${currentQuestion.bgColor} ${currentQuestion.borderColor} border text-gray-700`}>
                        {currentQuestion.category}
                      </Badge>
                    </div>
                    
                    <Select onValueChange={(value) => handleAnswer(currentQuestion.id, value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose your answer..." />
                      </SelectTrigger>
                      <SelectContent>
                        {currentQuestion.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="flex justify-between">
                      <Button 
                        variant="outline" 
                        onClick={handleSkip}
                        className="flex items-center gap-2"
                      >
                        <SkipForward className="w-4 h-4" />
                        Skip Question
                      </Button>
                      
                      <p className="text-sm text-gray-500 flex items-center">
                        {currentQuestionIndex + 1} of {questions.length}
                      </p>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Completion State */}
          {isComplete && (
            <div className="border-t bg-gradient-to-r from-green-50 to-emerald-50 p-6 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Assessment Completed!</h3>
              <p className="text-gray-600">Processing your responses and generating insights...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ConversationalSustainabilityForm