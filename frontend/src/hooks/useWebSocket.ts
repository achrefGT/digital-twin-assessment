import { useState, useEffect, useRef, useCallback } from 'react'

// ==================== INTERFACES ====================

export interface WebSocketMessage {
  // Core fields
  type: 'score_update' | 'assessment_completed' | 'recommendations_ready' | 'error' | 'connected' | 'ping' | 'pong' | 'test_message' | 'shutdown'
  assessment_id: string
  timestamp: string
  
  // Backend metadata (added by Redis Pub/Sub)
  gateway_instance?: string
  redis_published_at?: string
  data_source?: 'kafka' | 'direct'
  
  // Score fields
  domain?: string
  score_value?: number
  scores?: Record<string, any>
  overall_score?: number
  completion_percentage?: number
  status?: string
  domain_scores?: Record<string, number>
  
  // Weighting info
  weights_used?: Record<string, number>
  weights_type?: 'equal' | 'objective' | 'subjective'
  final_weights_used?: Record<string, number>
  weights_info?: any
  
  // Recommendation fields
  recommendations?: Array<{
    recommendation_id: string
    domain: string
    category: string
    title: string
    description: string
    priority: 'high' | 'medium' | 'low'
    estimated_impact?: string
    implementation_effort?: string
    source: string
    criterion_id?: string
    confidence_score?: number
    status?: 'pending' | 'in_progress' | 'completed' | 'rejected'
    notes?: string
  }>
  recommendation_set_id?: string
  source?: string
  generation_time_ms?: number
  model_used?: string
  
  // Error fields
  error_type?: string
  error_message?: string
  error_details?: Record<string, any>
  error?: string
  
  // Queueing
  queued_at?: string
  
  // Other
  user_id?: string
  message?: string
  [key: string]: any
}

export interface ConnectionStatus {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  lastMessage: Date | null
  reconnectAttempts: number
}

interface ConnectionState {
  ws: WebSocket | null
  listeners: Set<(message: WebSocketMessage) => void>
  statusListeners: Set<(status: ConnectionStatus) => void>
  messageHistory: WebSocketMessage[]
  reconnectTimeoutRef: NodeJS.Timeout | null
  reconnectAttempts: number
  pingIntervalRef: NodeJS.Timeout | null
  status: ConnectionStatus
  isReconnecting: boolean
}

// ==================== CONFIGURATION ====================

const WS_CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 5,
  BASE_RECONNECT_DELAY: 1000, // 1 second
  MAX_RECONNECT_DELAY: 30000, // 30 seconds
  PING_INTERVAL: 30000, // 30 seconds
  MESSAGE_HISTORY_SIZE: 50, // Per assessment
  PONG_TIMEOUT: 5000, // 5 seconds to wait for pong
} as const

// ==================== WEBSOCKET MANAGER ====================

/**
 * Global WebSocket connection manager with support for multiple concurrent connections.
 * Each assessment gets its own WebSocket connection to prevent conflicts.
 */
class WebSocketManager {
  private static instance: WebSocketManager
  private connections: Map<string, ConnectionState> = new Map()

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager()
    }
    return WebSocketManager.instance
  }

  /**
   * Get WebSocket URL with environment-aware protocol and host
   * 
   * Priority:
   * 1. VITE_WS_URL (explicit WebSocket URL)
   * 2. VITE_API_BASE_URL (derive from API base)
   * 3. window.location (fallback)
   */
  private getWebSocketUrl(assessmentId: string): string {
    let wsUrl = ''
    
    try {
      // Check for explicit WebSocket URL
      const explicitWsUrl = import.meta.env?.VITE_WS_URL
      if (explicitWsUrl) {
        return `${explicitWsUrl}/ws/${assessmentId}`
      }
      
      // Derive from API base URL
      const apiBaseUrl = import.meta.env?.VITE_API_BASE_URL
      if (apiBaseUrl) {
        // Remove http/https and replace with ws/wss
        const cleanUrl = apiBaseUrl.replace(/^https?:\/\//, '')
        const protocol = apiBaseUrl.startsWith('https') ? 'wss:' : 'ws:'
        return `${protocol}//${cleanUrl}/api/ws/${assessmentId}`
      }
    } catch (e) {
      console.warn('[WebSocket] Environment variable access failed, using fallback')
    }
    
    // Fallback: derive from current location
    // In development: ws://localhost:8000 (API Gateway)
    // In production: Use current host
    const isDevelopment = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1'
    
    if (isDevelopment) {
      // Connect to local API Gateway on port 8000
      return `ws://localhost:8000/api/ws/${assessmentId}`
    }
    
    // Production: use current host with appropriate protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    
    wsUrl = `${protocol}//${host}/api/ws/${assessmentId}`
    console.log(`[WebSocket] Connecting to: ${wsUrl}`)
    
    return wsUrl
  }

  /**
   * Get or create connection state for an assessment
   */
  private getOrCreateConnection(assessmentId: string): ConnectionState {
    if (!this.connections.has(assessmentId)) {
      this.connections.set(assessmentId, {
        ws: null,
        listeners: new Set(),
        statusListeners: new Set(),
        messageHistory: [],
        reconnectTimeoutRef: null,
        reconnectAttempts: 0,
        pingIntervalRef: null,
        isReconnecting: false,
        status: {
          isConnected: false,
          isConnecting: false,
          error: null,
          lastMessage: null,
          reconnectAttempts: 0
        }
      })
    }
    return this.connections.get(assessmentId)!
  }

  /**
   * Update connection status and notify listeners
   */
  private updateStatus(assessmentId: string, update: Partial<ConnectionStatus>) {
    const conn = this.getOrCreateConnection(assessmentId)
    conn.status = { ...conn.status, ...update }
    
    // Notify all status listeners
    conn.statusListeners.forEach(listener => {
      try {
        listener(conn.status)
      } catch (error) {
        console.error('❌ Error in status listener:', error)
      }
    })
  }

  /**
   * Notify all message listeners and add to history
   */
  private notifyMessage(assessmentId: string, message: WebSocketMessage) {
    const conn = this.getOrCreateConnection(assessmentId)
    
    console.log(`📢 [${assessmentId}] Broadcasting message to ${conn.listeners.size} listeners:`, message.type)
    
    // Add to message history (with size limit per assessment)
    conn.messageHistory.push(message)
    if (conn.messageHistory.length > WS_CONFIG.MESSAGE_HISTORY_SIZE) {
      conn.messageHistory = conn.messageHistory.slice(-WS_CONFIG.MESSAGE_HISTORY_SIZE)
    }
    
    // Notify all listeners
    conn.listeners.forEach(listener => {
      try {
        listener(message)
      } catch (error) {
        console.error('❌ Error in message listener:', error)
      }
    })
    
    // Update last message timestamp
    this.updateStatus(assessmentId, { lastMessage: new Date() })
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(assessmentId: string, ws: WebSocket) {
    const conn = this.getOrCreateConnection(assessmentId)

    ws.onopen = () => {
      console.log(`✅ [${assessmentId}] WebSocket connected`)
      
      this.updateStatus(assessmentId, {
        isConnected: true,
        isConnecting: false,
        error: null,
        reconnectAttempts: conn.reconnectAttempts
      })
      
      conn.reconnectAttempts = 0
      conn.isReconnecting = false

      // Start ping interval to keep connection alive
      conn.pingIntervalRef = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          console.log(`🏓 [${assessmentId}] Sending ping`)
          ws.send(JSON.stringify({ 
            type: 'ping', 
            timestamp: new Date().toISOString(),
            assessment_id: assessmentId
          }))
        }
      }, WS_CONFIG.PING_INTERVAL)

      // Request replay of any missed messages
      if (conn.status.lastMessage) {
        console.log(`🔄 [${assessmentId}] Requesting replay of missed messages`)
        ws.send(JSON.stringify({
          type: 'replay_request',
          last_message_timestamp: conn.status.lastMessage.toISOString(),
          assessment_id: assessmentId
        }))
      }
    }

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        
        // Handle ping/pong
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ 
            type: 'pong', 
            timestamp: new Date().toISOString(),
            assessment_id: assessmentId
          }))
          return
        }
        
        if (message.type === 'pong') {
          console.log(`🏓 [${assessmentId}] Received pong`)
          return
        }

        // Handle server shutdown
        if (message.type === 'shutdown') {
          console.warn(`⚠️ [${assessmentId}] Server shutting down:`, message.message)
          this.updateStatus(assessmentId, { 
            error: 'Server is shutting down',
            isConnected: false 
          })
          return
        }

        // Log queued messages
        if (message.queued_at) {
          console.log(`📦 [${assessmentId}] Received QUEUED message:`, {
            type: message.type,
            queued_at: message.queued_at,
            domain: message.domain
          })
        }

        // Log Redis Pub/Sub messages
        if (message.gateway_instance) {
          console.log(`📡 [${assessmentId}] Message from gateway instance:`, message.gateway_instance)
        }

        console.log(`📨 [${assessmentId}] Received message:`, message.type)
        this.notifyMessage(assessmentId, message)
        
      } catch (error) {
        console.error(`❌ [${assessmentId}] Failed to parse message:`, error)
      }
    }

    ws.onclose = (event) => {
      console.log(`🔌 [${assessmentId}] WebSocket closed:`, event.code, event.reason)
      
      // Clear ping interval
      if (conn.pingIntervalRef) {
        clearInterval(conn.pingIntervalRef)
        conn.pingIntervalRef = null
      }

      this.updateStatus(assessmentId, {
        isConnected: false,
        isConnecting: false
      })

      // Attempt reconnection if not a clean close and under retry limit
      const shouldReconnect = 
        event.code !== 1000 && // Not a normal closure
        event.code !== 1001 && // Not going away
        conn.reconnectAttempts < WS_CONFIG.MAX_RECONNECT_ATTEMPTS &&
        !conn.isReconnecting

      if (shouldReconnect) {
        this.scheduleReconnect(assessmentId)
      } else if (conn.reconnectAttempts >= WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
        this.updateStatus(assessmentId, { 
          error: `Connection failed after ${WS_CONFIG.MAX_RECONNECT_ATTEMPTS} attempts`
        })
      }
    }

    ws.onerror = (error) => {
      console.error(`❌ [${assessmentId}] WebSocket error:`, error)
      this.updateStatus(assessmentId, { error: 'WebSocket connection error' })
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(assessmentId: string) {
    const conn = this.getOrCreateConnection(assessmentId)
    
    if (conn.isReconnecting) {
      console.log(`⏳ [${assessmentId}] Reconnection already scheduled`)
      return
    }

    conn.isReconnecting = true
    conn.reconnectAttempts++

    // Calculate delay with exponential backoff
    const delay = Math.min(
      WS_CONFIG.BASE_RECONNECT_DELAY * Math.pow(2, conn.reconnectAttempts - 1),
      WS_CONFIG.MAX_RECONNECT_DELAY
    )

    console.log(
      `🔄 [${assessmentId}] Reconnecting in ${delay}ms ` +
      `(attempt ${conn.reconnectAttempts}/${WS_CONFIG.MAX_RECONNECT_ATTEMPTS})`
    )

    this.updateStatus(assessmentId, {
      isConnecting: true,
      reconnectAttempts: conn.reconnectAttempts
    })

    conn.reconnectTimeoutRef = setTimeout(() => {
      console.log(`🔌 [${assessmentId}] Attempting reconnection...`)
      this.connect(assessmentId)
    }, delay)
  }

  /**
   * Connect to WebSocket for a specific assessment
   */
  connect(assessmentId: string) {
    const conn = this.getOrCreateConnection(assessmentId)

    // If already connected and healthy, don't reconnect
    if (conn.ws?.readyState === WebSocket.OPEN) {
      console.log(`📌 [${assessmentId}] Already connected`)
      return
    }

    // If connecting, don't start another connection
    if (conn.ws?.readyState === WebSocket.CONNECTING) {
      console.log(`⏳ [${assessmentId}] Connection already in progress`)
      return
    }

    // Clear any existing reconnection timeout
    if (conn.reconnectTimeoutRef) {
      clearTimeout(conn.reconnectTimeoutRef)
      conn.reconnectTimeoutRef = null
    }

    // Close existing connection if any
    if (conn.ws) {
      try {
        conn.ws.close(1000, 'Reconnecting')
      } catch (error) {
        console.warn(`⚠️ [${assessmentId}] Error closing old connection:`, error)
      }
    }

    console.log(`🔌 [${assessmentId}] Connecting to WebSocket...`)
    this.updateStatus(assessmentId, { 
      isConnecting: true, 
      error: null,
      reconnectAttempts: conn.reconnectAttempts
    })

    try {
      const wsUrl = this.getWebSocketUrl(assessmentId)
      console.log(`🔗 [${assessmentId}] URL:`, wsUrl)
      
      const ws = new WebSocket(wsUrl)
      conn.ws = ws
      
      this.setupWebSocketHandlers(assessmentId, ws)
      
    } catch (error) {
      console.error(`❌ [${assessmentId}] Failed to create WebSocket:`, error)
      this.updateStatus(assessmentId, { 
        error: 'Failed to create WebSocket connection',
        isConnecting: false
      })
      
      // Schedule retry
      if (conn.reconnectAttempts < WS_CONFIG.MAX_RECONNECT_ATTEMPTS) {
        this.scheduleReconnect(assessmentId)
      }
    }
  }

  /**
   * Disconnect WebSocket for a specific assessment
   */
  disconnect(assessmentId: string, clearHistory = false) {
    console.log(`🔌 [${assessmentId}] Disconnecting...`)
    
    const conn = this.connections.get(assessmentId)
    if (!conn) return

    // Clear reconnection timeout
    if (conn.reconnectTimeoutRef) {
      clearTimeout(conn.reconnectTimeoutRef)
      conn.reconnectTimeoutRef = null
    }

    // Clear ping interval
    if (conn.pingIntervalRef) {
      clearInterval(conn.pingIntervalRef)
      conn.pingIntervalRef = null
    }

    // Set max attempts to prevent auto-reconnection
    conn.reconnectAttempts = WS_CONFIG.MAX_RECONNECT_ATTEMPTS
    conn.isReconnecting = false

    // Close WebSocket
    if (conn.ws) {
      try {
        conn.ws.close(1000, 'Manual disconnect')
      } catch (error) {
        console.warn(`⚠️ [${assessmentId}] Error during disconnect:`, error)
      }
      conn.ws = null
    }

    // Clear message history if requested
    if (clearHistory) {
      conn.messageHistory = []
    }

    this.updateStatus(assessmentId, {
      isConnected: false,
      isConnecting: false,
      error: null,
      lastMessage: clearHistory ? null : conn.status.lastMessage,
      reconnectAttempts: 0
    })
  }

  /**
   * Send a message to a specific assessment's WebSocket
   */
  sendMessage(assessmentId: string, message: any) {
    const conn = this.connections.get(assessmentId)
    
    if (!conn?.ws) {
      console.warn(`⚠️ [${assessmentId}] Cannot send - no connection`)
      return false
    }

    if (conn.ws.readyState !== WebSocket.OPEN) {
      console.warn(`⚠️ [${assessmentId}] Cannot send - connection not open (state: ${conn.ws.readyState})`)
      return false
    }

    try {
      const payload = typeof message === 'string' 
        ? message 
        : JSON.stringify(message)
      
      console.log(`📤 [${assessmentId}] Sending message:`, message)
      conn.ws.send(payload)
      return true
      
    } catch (error) {
      console.error(`❌ [${assessmentId}] Failed to send message:`, error)
      return false
    }
  }

  /**
   * Add a message listener for a specific assessment
   */
  addMessageListener(
    assessmentId: string, 
    callback: (message: WebSocketMessage) => void
  ): () => void {
    const conn = this.getOrCreateConnection(assessmentId)
    
    console.log(`➕ [${assessmentId}] Adding message listener (total: ${conn.listeners.size + 1})`)
    conn.listeners.add(callback)
    
    // Send message history to new listener
    if (conn.messageHistory.length > 0) {
      console.log(`📋 [${assessmentId}] Sending ${conn.messageHistory.length} cached messages to new listener`)
      
      // Send asynchronously to avoid blocking
      setTimeout(() => {
        conn.messageHistory.forEach(msg => {
          try {
            callback(msg)
          } catch (error) {
            console.error('❌ Error sending cached message:', error)
          }
        })
      }, 0)
    }
    
    // Return unsubscribe function
    return () => {
      console.log(`➖ [${assessmentId}] Removing message listener (remaining: ${conn.listeners.size - 1})`)
      conn.listeners.delete(callback)
      
      // Cleanup connection if no more listeners
      if (conn.listeners.size === 0 && conn.statusListeners.size === 0) {
        console.log(`🗑️ [${assessmentId}] No more listeners, scheduling cleanup`)
        // Disconnect after a delay to allow for reconnection
        setTimeout(() => {
          const currentConn = this.connections.get(assessmentId)
          if (currentConn && 
              currentConn.listeners.size === 0 && 
              currentConn.statusListeners.size === 0) {
            console.log(`🗑️ [${assessmentId}] Cleaning up unused connection`)
            this.disconnect(assessmentId, true)
            this.connections.delete(assessmentId)
          }
        }, 30000) // 30 second grace period
      }
    }
  }

  /**
   * Add a status listener for a specific assessment
   */
  addStatusListener(
    assessmentId: string,
    callback: (status: ConnectionStatus) => void
  ): () => void {
    const conn = this.getOrCreateConnection(assessmentId)
    
    console.log(`➕ [${assessmentId}] Adding status listener (total: ${conn.statusListeners.size + 1})`)
    conn.statusListeners.add(callback)
    
    // Immediately call with current status
    try {
      callback(conn.status)
    } catch (error) {
      console.error('❌ Error calling status listener:', error)
    }
    
    // Return unsubscribe function
    return () => {
      console.log(`➖ [${assessmentId}] Removing status listener (remaining: ${conn.statusListeners.size - 1})`)
      conn.statusListeners.delete(callback)
    }
  }

  /**
   * Get current connection status
   */
  getStatus(assessmentId: string): ConnectionStatus {
    const conn = this.connections.get(assessmentId)
    return conn?.status || {
      isConnected: false,
      isConnecting: false,
      error: null,
      lastMessage: null,
      reconnectAttempts: 0
    }
  }

  /**
   * Get message history for an assessment
   */
  getMessageHistory(assessmentId: string): WebSocketMessage[] {
    const conn = this.connections.get(assessmentId)
    return conn?.messageHistory || []
  }

  /**
   * Clear message history for an assessment
   */
  clearMessageHistory(assessmentId: string) {
    const conn = this.connections.get(assessmentId)
    if (conn) {
      console.log(`🗑️ [${assessmentId}] Clearing message history`)
      conn.messageHistory = []
    }
  }

  /**
   * Get statistics for all connections
   */
  getStats() {
    const stats = {
      totalConnections: this.connections.size,
      connections: Array.from(this.connections.entries()).map(([id, conn]) => ({
        assessmentId: id,
        status: conn.status,
        listeners: conn.listeners.size,
        statusListeners: conn.statusListeners.size,
        messageHistory: conn.messageHistory.length,
        wsState: conn.ws?.readyState
      }))
    }
    
    console.log('📊 WebSocket Manager Stats:', stats)
    return stats
  }
}

// ==================== REACT HOOK ====================

/**
 * React hook for WebSocket connection management
 * 
 * @param assessmentId - The assessment to connect to
 * @param autoConnect - Whether to automatically connect on mount (default: true)
 * @returns WebSocket connection state and control functions
 */
export const useWebSocket = (assessmentId: string, autoConnect = true) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null,
    reconnectAttempts: 0
  })
  
  const [messages, setMessages] = useState<WebSocketMessage[]>([])
  const managerRef = useRef(WebSocketManager.getInstance())
  const assessmentIdRef = useRef(assessmentId)

  // Update ref when assessmentId changes
  useEffect(() => {
    assessmentIdRef.current = assessmentId
  }, [assessmentId])

  // Connect/disconnect when assessment ID changes
  useEffect(() => {
    if (!assessmentId) {
      console.warn('⚠️ No assessment ID provided to useWebSocket')
      return
    }

    console.log(`🔄 [${assessmentId}] useWebSocket effect triggered`)
    
    const manager = managerRef.current

    // Load existing message history
    const existingMessages = manager.getMessageHistory(assessmentId)
    if (existingMessages.length > 0) {
      console.log(`📋 [${assessmentId}] Loading ${existingMessages.length} existing messages`)
      setMessages(existingMessages)
    }

    // Auto-connect if enabled
    if (autoConnect) {
      manager.connect(assessmentId)
    }

    // Cleanup: disconnect on unmount OR when assessment changes
    return () => {
      console.log(`🔌 [${assessmentId}] useWebSocket cleanup`)
      // Don't disconnect immediately - let the manager handle cleanup
      // based on listener count
    }
  }, [assessmentId, autoConnect])

  // Subscribe to status updates
  useEffect(() => {
    if (!assessmentId) return

    const manager = managerRef.current
    const unsubscribe = manager.addStatusListener(assessmentId, setConnectionStatus)
    
    return () => {
      unsubscribe()
    }
  }, [assessmentId])

  // Subscribe to messages
  useEffect(() => {
    if (!assessmentId) return

    const manager = managerRef.current
    
    const unsubscribe = manager.addMessageListener(assessmentId, (message) => {
      console.log(`🎯 [${assessmentId}] Hook received message:`, message.type)
      
      setMessages(prev => {
        const newMessages = [...prev, message]
        console.log(`📊 [${assessmentId}] Total messages:`, newMessages.length)
        return newMessages
      })
    })
    
    return () => {
      unsubscribe()
    }
  }, [assessmentId])

  // Control functions
  const connect = useCallback(() => {
    console.log(`🔌 [${assessmentIdRef.current}] Manual connect triggered`)
    managerRef.current.connect(assessmentIdRef.current)
  }, [])

  const disconnect = useCallback((clearHistory = false) => {
    console.log(`🔌 [${assessmentIdRef.current}] Manual disconnect triggered`)
    managerRef.current.disconnect(assessmentIdRef.current, clearHistory)
  }, [])

  const clearMessages = useCallback(() => {
    console.log(`🗑️ [${assessmentIdRef.current}] Clearing messages`)
    setMessages([])
    managerRef.current.clearMessageHistory(assessmentIdRef.current)
  }, [])

  const sendMessage = useCallback((message: any) => {
    return managerRef.current.sendMessage(assessmentIdRef.current, message)
  }, [])

  const subscribeToEvents = useCallback((events: string[]) => {
    console.log(`📢 [${assessmentIdRef.current}] Subscribing to events:`, events)
    return sendMessage({
      type: 'subscribe',
      events,
      assessment_id: assessmentIdRef.current,
      timestamp: new Date().toISOString()
    })
  }, [sendMessage])

  const getStats = useCallback(() => {
    return managerRef.current.getStats()
  }, [])

  return {
    // State
    connectionStatus,
    messages,
    isConnected: connectionStatus.isConnected,
    isConnecting: connectionStatus.isConnecting,
    error: connectionStatus.error,
    lastMessage: connectionStatus.lastMessage,
    
    // Actions
    connect,
    disconnect,
    clearMessages,
    sendMessage,
    subscribeToEvents,
    getStats
  }
}

// ==================== EXPORTS ====================

export default useWebSocket

// Export manager for advanced use cases
export const getWebSocketManager = () => WebSocketManager.getInstance()