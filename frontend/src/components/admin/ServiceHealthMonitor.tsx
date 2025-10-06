import React from 'react';
import { useAdminApi } from '@/hooks/useAdminApi';
import { ServicesHealthResponse, ServiceHealth } from '@/types/admin';
import { CheckCircle, AlertCircle, Clock, RefreshCw, Activity } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export function ServiceHealthMonitor() {
  const { servicesHealth } = useAdminApi();
  const { t } = useLanguage();

  if (servicesHealth.isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center animate-pulse">
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">{t('admin.serviceHealth')}</h2>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-lg h-16"></div>
          ))}
        </div>
      </div>
    );
  }

  if (servicesHealth.error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Service Health</h2>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-900 mb-1">{t('admin.failedLoadHealth')}</h3>
              <p className="text-sm text-red-700">
                {t('admin.unableRetrieveHealth')}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Type assertion with proper type checking
  const data = servicesHealth.data as ServicesHealthResponse | undefined;
  const overallStatus = data?.overall_status;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-800',
          badge: 'bg-green-100 text-green-700 border-green-200'
        };
      case 'unhealthy':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          badge: 'bg-red-100 text-red-700 border-red-200'
        };
      case 'degraded':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-800',
          badge: 'bg-yellow-100 text-yellow-700 border-yellow-200'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-800',
          badge: 'bg-gray-100 text-gray-700 border-gray-200'
        };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'unhealthy':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'degraded':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const overallStatusColors = getStatusColor(overallStatus || 'unknown');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Service Health</h2>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {getStatusIcon(overallStatus || 'unknown')}
            <span className={`px-3 py-1 text-sm font-medium rounded-full border ${overallStatusColors.badge}`}>
              {overallStatus || 'Unknown'}
            </span>
          </div>
          
          <button
            onClick={() => servicesHealth.refetch()}
            disabled={servicesHealth.isFetching}
            className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors disabled:opacity-50"
            title={t('admin.refreshHealth')}
          >
            <RefreshCw className={`w-4 h-4 ${servicesHealth.isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.services && Object.entries(data.services).map(([serviceName, service]: [string, ServiceHealth]) => {
          const statusColors = getStatusColor(service.status);
          
          return (
            <div 
              key={serviceName} 
              className={`${statusColors.bg} border ${statusColors.border} rounded-lg p-4`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getStatusIcon(service.status)}
                  <h3 className="font-medium text-gray-900 capitalize">
                    {serviceName.replace('_', ' ')}
                  </h3>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${statusColors.badge}`}>
                  {service.status}
                </span>
              </div>
              
              <div className="text-xs text-gray-600">
                {t('admin.lastCheck')}: {new Date(service.timestamp).toLocaleTimeString()}
              </div>
              
              {service.error && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {service.error}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data?.checked_by && data?.checked_at && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-center text-sm text-gray-500">
            <Clock className="w-4 h-4 mr-2" />
            {t('admin.lastCheckedBy')} {data.checked_by} {t('admin.at')} {new Date(data.checked_at).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}