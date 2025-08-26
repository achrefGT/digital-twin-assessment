import { useState, useEffect, useRef, useCallback } from 'react'

// Updated interface to match backend WebSocket message structure
export interface WebSocketMessage {
  type: 'score_update' | 'assessment_completed' | 'error' | 'connected' | 'ping' | 'pong' | 'test_message'
  assessment_id: string
  timestamp: string
  domain?: string
  score_value?: number
  scores?: Record<string, any>
  overall_score?: number
  completion_percentage?: number
  status?: string
  domain_scores?: Record<string, number>
  final_weights_used?: Record<string, number>
  error?: string
  user_id?: string
  queued_at?: string // For queued messages
  message?: string // For test messages
  [key: string]: any
}

export interface ConnectionStatus {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  lastMessage: Date | null
}

// Global WebSocket connection manager to persist across components
class WebSocketManager {
  private static instance: WebSocketManager
  private ws: WebSocket | null = null
  private currentAssessmentId: string | null = null
  private listeners: Set<(message: WebSocketMessage) => void> = new Set()
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set()
  private reconnectTimeoutRef: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private pingIntervalRef: NodeJS.Timeout | null = null
  private messageHistory: WebSocketMessage[] = [] // Store recent messages
  private maxHistorySize = 50 // Keep last 50 messages
  
  private connectionStatus: ConnectionStatus = {
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null
  }

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager()
    }
    return WebSocketManager.instance
  }

  private updateStatus(update: Partial<ConnectionStatus>) {
    this.connectionStatus = { ...this.connectionStatus, ...update }
    this.statusListeners.forEach(listener => listener(this.connectionStatus))
  }

  private notifyMessage(message: WebSocketMessage) {
    console.log('📢 Broadcasting message to', this.listeners.size, 'listeners:', message.type)
    
    // Add to message history (keep recent messages for new subscribers)
    this.messageHistory.push(message)
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize)
    }
    
    this.listeners.forEach(listener => {
      try {
        listener(message)
      } catch (error) {
        console.error('❌ Error in message listener:', error)
      }
    })
  }

  connect(assessmentId: string) {
    // If already connected to the same assessment, don't reconnect
    if (this.ws?.readyState === WebSocket.OPEN && this.currentAssessmentId === assessmentId) {
      console.log('🔌 Already connected to assessment:', assessmentId)
      return
    }

    // If connecting to a different assessment, close existing connection
    if (this.currentAssessmentId && this.currentAssessmentId !== assessmentId) {
      console.log('🔄 Switching assessment from', this.currentAssessmentId, 'to', assessmentId)
      this.disconnect(false) // Don't clear assessment ID
    }

    this.currentAssessmentId = assessmentId
    console.log('🔌 WebSocket connecting to assessment:', assessmentId)
    this.updateStatus({ isConnecting: true, error: null })

    const wsUrl = `ws://localhost:8000/api/ws/${assessmentId}`
    console.log('🔌 WebSocket URL:', wsUrl)
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      console.log('✅ WebSocket connected to assessment:', assessmentId)
      this.updateStatus({
        isConnected: true,
        isConnecting: false,
        error: null,
        lastMessage: null
      })
      this.reconnectAttempts = 0

      // Start ping interval to keep connection alive
      this.pingIntervalRef = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send('ping')
        }
      }, 30000) // Ping every 30 seconds
    }

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        console.log('📨 WebSocket message received for assessment', assessmentId, ':', message)
        
        // Handle ping/pong
        if (message.type === 'ping') {
          this.ws?.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }))
          return
        }
        
        if (message.type === 'pong') {
          return // Just acknowledge pong
        }

        // Log queued messages specifically
        if (message.queued_at) {
          console.log('🎯 Received QUEUED message:', {
            type: message.type,
            queued_at: message.queued_at,
            assessment_id: message.assessment_id,
            domain: message.domain
          })
        }

        // Always notify message listeners, regardless of message type
        console.log('🔔 Notifying', this.listeners.size, 'message listeners of', message.type, 'message')
        this.notifyMessage(message)
        this.updateStatus({ lastMessage: new Date() })
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error)
      }
    }

    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket closed for assessment', assessmentId, ':', event.code, event.reason)
      this.updateStatus({
        isConnected: false,
        isConnecting: false
      })

      // Clear ping interval
      if (this.pingIntervalRef) {
        clearInterval(this.pingIntervalRef)
        this.pingIntervalRef = null
      }

      // Attempt reconnection unless it was a clean close or manual disconnect
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts && this.currentAssessmentId) {
        this.reconnectAttempts++
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
        
        console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
        this.reconnectTimeoutRef = setTimeout(() => {
          if (this.currentAssessmentId) { // Only reconnect if we still have an assessment
            this.connect(this.currentAssessmentId)
          }
        }, delay)
      } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.updateStatus({ error: 'Max reconnection attempts reached' })
      }
    }

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error for assessment', assessmentId, ':', error)
      this.updateStatus({ error: 'WebSocket connection error' })
    }
  }

  disconnect(clearAssessment = true) {
    console.log('🔌 Disconnecting WebSocket for assessment:', this.currentAssessmentId)
    if (this.reconnectTimeoutRef) {
      clearTimeout(this.reconnectTimeoutRef)
      this.reconnectTimeoutRef = null
    }
    if (this.pingIntervalRef) {
      clearInterval(this.pingIntervalRef)
      this.pingIntervalRef = null
    }
    
    // Set max reconnect attempts to prevent reconnection
    this.reconnectAttempts = this.maxReconnectAttempts
    
    this.ws?.close(1000, 'Manual disconnect')
    this.updateStatus({
      isConnected: false,
      isConnecting: false,
      error: null,
      lastMessage: null
    })

    if (clearAssessment) {
      this.currentAssessmentId = null
    }
  }

  sendMessage(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('📤 Sending WebSocket message:', message)
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('⚠️ Cannot send message - WebSocket not connected')
    }
  }

  addMessageListener(callback: (message: WebSocketMessage) => void) {
    console.log('➕ Adding message listener. Total listeners will be:', this.listeners.size + 1)
    this.listeners.add(callback)
    
    // Send recent messages to new listeners if they're for the current assessment
    if (this.currentAssessmentId && this.messageHistory.length > 0) {
      console.log('📋 Sending', this.messageHistory.length, 'cached messages to new listener')
      const relevantMessages = this.messageHistory.filter(msg => 
        msg.assessment_id === this.currentAssessmentId
      )
      console.log('📋 Found', relevantMessages.length, 'relevant cached messages for assessment:', this.currentAssessmentId)
      setTimeout(() => {
        relevantMessages.forEach(msg => {
          try {
            callback(msg)
          } catch (error) {
            console.error('❌ Error sending cached message to listener:', error)
          }
        })
      }, 0)
    }
    
    return () => {
      console.log('➖ Removing message listener. Total listeners will be:', this.listeners.size - 1)
      this.listeners.delete(callback)
    }
  }

  addStatusListener(callback: (status: ConnectionStatus) => void) {
    console.log('➕ Adding status listener. Total status listeners will be:', this.statusListeners.size + 1)
    this.statusListeners.add(callback)
    // Immediately call with current status
    callback(this.connectionStatus)
    return () => {
      console.log('➖ Removing status listener. Total status listeners will be:', this.statusListeners.size - 1)
      this.statusListeners.delete(callback)
    }
  }

  getCurrentStatus(): ConnectionStatus {
    return this.connectionStatus
  }

  getCurrentAssessmentId(): string | null {
    return this.currentAssessmentId
  }

  getMessageHistory(assessmentId?: string): WebSocketMessage[] {
    if (assessmentId) {
      return this.messageHistory.filter(msg => msg.assessment_id === assessmentId)
    }
    return [...this.messageHistory]
  }

  clearMessageHistory() {
    console.log('🗑️ Clearing message history')
    this.messageHistory = []
  }
}

export const useWebSocket = (assessmentId: string) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null
  })
  
  const [messages, setMessages] = useState<WebSocketMessage[]>([])
  const manager = WebSocketManager.getInstance()

  // Connect to WebSocket when assessment ID changes
  useEffect(() => {
    if (assessmentId) {
      console.log('🔄 Assessment ID changed, connecting WebSocket:', assessmentId)
      manager.connect(assessmentId)
      
      // Load existing messages for this assessment
      const existingMessages = manager.getMessageHistory(assessmentId)
      console.log('📋 Loading', existingMessages.length, 'existing messages for assessment:', assessmentId)
      setMessages(existingMessages)
    }

    // Don't disconnect on unmount - let the connection persist
    return () => {
      console.log('🔌 useWebSocket hook unmounting, but keeping connection alive')
    }
  }, [assessmentId])

  // Subscribe to status updates
  useEffect(() => {
    const unsubscribe = manager.addStatusListener(setConnectionStatus)
    return () => {
      unsubscribe()
    }
  }, [])

  // Subscribe to messages
  useEffect(() => {
    const unsubscribe = manager.addMessageListener((message) => {
      console.log('🎯 useWebSocket hook received message:', message.type, 'for assessment:', message.assessment_id)
      setMessages(prev => {
        const newMessages = [...prev, message]
        console.log('📊 Total messages now:', newMessages.length)
        return newMessages
      })
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const disconnect = useCallback(() => {
    manager.disconnect(true)
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  const sendMessage = useCallback((message: any) => {
    manager.sendMessage(message)
  }, [])

  // Subscribe to specific events
  const subscribeToEvents = useCallback((events: string[]) => {
    console.log('🔔 Subscribing to events:', events, 'for assessment:', assessmentId)
    sendMessage({
      type: 'subscribe',
      events,
      timestamp: new Date().toISOString()
    })
  }, [sendMessage, assessmentId])

  const connect = useCallback(() => {
    manager.connect(assessmentId)
  }, [assessmentId])

  return {
    connectionStatus,
    messages,
    connect,
    disconnect,
    clearMessages,
    sendMessage,
    subscribeToEvents
  }
}