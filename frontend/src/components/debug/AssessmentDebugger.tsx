// components/debug/AssessmentDebugger.tsx
import React, { useEffect, useState } from 'react'

interface DebugInfo {
  currentUrl: string
  localStorage_assessment: any
  url_assessment_id: string | null
  localStorage_raw: string | null
  timestamp: string
  pathname: string
}

export const AssessmentDebugger: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    currentUrl: '',
    localStorage_assessment: null,
    url_assessment_id: null,
    localStorage_raw: null,
    timestamp: '',
    pathname: ''
  })

  useEffect(() => {
    const checkAssessmentState = () => {
      const currentAssessment = localStorage.getItem('currentAssessment')
      const urlParams = new URLSearchParams(window.location.search)
      const urlAssessmentId = urlParams.get('assessmentId')
      
      setDebugInfo({
        currentUrl: window.location.href,
        localStorage_assessment: currentAssessment ? JSON.parse(currentAssessment) : null,
        url_assessment_id: urlAssessmentId,
        localStorage_raw: currentAssessment,
        timestamp: new Date().toISOString(),
        pathname: window.location.pathname
      })
    }

    checkAssessmentState()
    
    // Check every 2 seconds for changes
    const interval = setInterval(checkAssessmentState, 2000)
    
    // Listen for storage changes
    const handleStorageChange = () => {
      checkAssessmentState()
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg max-w-md text-xs font-mono z-50 max-h-96 overflow-y-auto">
      <div className="font-bold mb-2 text-yellow-400">🔍 Assessment Debug Info</div>
      <div className="space-y-2">
        <div>
          <span className="text-blue-400">Page:</span> {debugInfo.pathname}
        </div>
        <div>
          <span className="text-green-400">localStorage ID:</span> 
          <span className="text-white ml-1">
            {debugInfo.localStorage_assessment?.assessment_id || 'null'}
          </span>
        </div>
        <div>
          <span className="text-purple-400">URL Param ID:</span> 
          <span className="text-white ml-1">
            {debugInfo.url_assessment_id || 'null'}
          </span>
        </div>
        <div>
          <span className="text-orange-400">Last Updated:</span> 
          <span className="text-white ml-1">
            {new Date(debugInfo.timestamp).toLocaleTimeString()}
          </span>
        </div>
        {debugInfo.localStorage_assessment && (
          <div className="mt-3 pt-2 border-t border-gray-600">
            <div className="text-gray-300 mb-1">Assessment Details:</div>
            <div>Status: <span className="text-cyan-400">{debugInfo.localStorage_assessment.status}</span></div>
            <div>Created: <span className="text-cyan-400">{new Date(debugInfo.localStorage_assessment.created_at).toLocaleString()}</span></div>
            {debugInfo.localStorage_assessment.updated_at && (
              <div>Updated: <span className="text-cyan-400">{new Date(debugInfo.localStorage_assessment.updated_at).toLocaleString()}</span></div>
            )}
          </div>
        )}
        <div className="mt-3 pt-2 border-t border-gray-600">
          <details>
            <summary className="text-gray-400 cursor-pointer">Raw localStorage</summary>
            <pre className="text-xs mt-1 bg-gray-800 p-2 rounded overflow-x-auto">
              {debugInfo.localStorage_raw || 'null'}
            </pre>
          </details>
        </div>
      </div>
    </div>
  )
}