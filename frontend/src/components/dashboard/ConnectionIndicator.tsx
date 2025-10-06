import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Wifi, WifiOff, AlertCircle } from 'lucide-react'
import { ConnectionStatus } from '@/hooks/useWebSocket'
import { useLanguage } from '@/contexts/LanguageContext'

interface ConnectionIndicatorProps {
  connectionStatus: ConnectionStatus
}

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  connectionStatus
}) => {
  const { t } = useLanguage()

  const getStatusInfo = () => {
    if (connectionStatus.isConnecting) {
      return {
        icon: AlertCircle,
        text: t('connection.connecting'),
        variant: 'secondary' as const,
        className: 'animate-pulse'
      }
    }
    
    if (connectionStatus.isConnected) {
      return {
        icon: Wifi,
        text: t('connection.connected'),
        variant: 'secondary' as const,
        className: 'text-green-600'
      }
    }
    
    if (connectionStatus.error) {
      return {
        icon: WifiOff,
        text: connectionStatus.error,
        variant: 'destructive' as const,
        className: ''
      }
    }
    
    return {
      icon: WifiOff,
      text: t('connection.disconnected'),
      variant: 'secondary' as const,
      className: ''
    }
  }

  const { icon: Icon, text, variant, className } = getStatusInfo()

  return (
    <div className="flex items-center gap-3">
      {connectionStatus.lastMessage && (
        <div className="text-xs text-muted-foreground">
          {t('connection.lastUpdate')}: {connectionStatus.lastMessage.toLocaleTimeString()}
        </div>
      )}
      <Badge variant={variant} className={`flex items-center gap-2 ${className}`}>
        <Icon className="h-3 w-3" />
        {text}
      </Badge>
    </div>
  )
}