import React from 'react'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Clock, Play, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
  size?: 'sm' | 'default' | 'lg'
  showIcon?: boolean
  animated?: boolean
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  className, 
  size = 'default',
  showIcon = true,
  animated = true 
}) => {
  const getStatusConfig = (status: string) => {
    const normalizedStatus = status.toUpperCase()
    
    switch (normalizedStatus) {
      case 'COMPLETED':
        return {
          label: 'Completed',
          icon: CheckCircle,
          className: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 shadow-lg hover:shadow-emerald-500/25',
          iconClassName: 'text-white'
        }
      
      case 'IN_PROGRESS':
      case 'STARTED':
        return {
          label: 'In Progress',
          icon: animated ? Loader2 : Play,
          className: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-lg hover:shadow-blue-500/25',
          iconClassName: animated ? 'text-white animate-spin' : 'text-white'
        }
      
      case 'PROCESSING':
        return {
          label: 'Processing',
          icon: Loader2,
          className: 'bg-gradient-to-r from-orange-500 to-amber-600 text-white border-0 shadow-lg hover:shadow-orange-500/25',
          iconClassName: 'text-white animate-spin'
        }
      
      case 'PENDING':
      case 'CREATED':
        return {
          label: 'Pending',
          icon: Clock,
          className: 'bg-gradient-to-r from-gray-500 to-slate-600 text-white border-0 shadow-lg hover:shadow-gray-500/25',
          iconClassName: 'text-white'
        }
      
      case 'FAILED':
      case 'ERROR':
        return {
          label: 'Failed',
          icon: AlertCircle,
          className: 'bg-gradient-to-r from-red-500 to-rose-600 text-white border-0 shadow-lg hover:shadow-red-500/25',
          iconClassName: 'text-white'
        }
      
      default:
        return {
          label: status,
          icon: Clock,
          className: 'bg-gradient-to-r from-gray-400 to-gray-500 text-white border-0 shadow-lg',
          iconClassName: 'text-white'
        }
    }
  }

  const config = getStatusConfig(status)
  const IconComponent = config.icon

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    default: 'px-3 py-1.5 text-sm font-medium',
    lg: 'px-4 py-2 text-base font-semibold'
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    default: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  return (
    <Badge 
      className={cn(
        'inline-flex items-center gap-2 rounded-full transition-all duration-200 hover:scale-105',
        config.className,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && IconComponent && (
        <IconComponent 
          className={cn(iconSizes[size], config.iconClassName)}
        />
      )}
      <span className="font-medium">{config.label}</span>
    </Badge>
  )
}

// Specific status badge variants for common use cases
export const CompletedBadge: React.FC<Omit<StatusBadgeProps, 'status'>> = (props) => (
  <StatusBadge status="COMPLETED" {...props} />
)

export const InProgressBadge: React.FC<Omit<StatusBadgeProps, 'status'>> = (props) => (
  <StatusBadge status="IN_PROGRESS" {...props} />
)

export const ProcessingBadge: React.FC<Omit<StatusBadgeProps, 'status'>> = (props) => (
  <StatusBadge status="PROCESSING" {...props} />
)

export const PendingBadge: React.FC<Omit<StatusBadgeProps, 'status'>> = (props) => (
  <StatusBadge status="PENDING" {...props} />
)