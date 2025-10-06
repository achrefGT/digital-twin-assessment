import React from 'react';
import { Link } from 'react-router-dom';
import { useAdminApi } from '@/hooks/useAdminApi';
import { ServiceHealthMonitor } from './ServiceHealthMonitor';
import { AdminDashboard as AdminDashboardType, ServicesHealthResponse } from '@/types/admin';
import { ArrowRight, CheckCircle, Leaf, Shield, Users } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext'

export function AdminDashboard() {
  const { dashboard, servicesHealth } = useAdminApi();
  const { t } = useLanguage()

  if (dashboard.isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded-lg w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-100 rounded-xl h-48 animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Type the dashboard data properly
  const dashboardData = dashboard.data as AdminDashboardType | undefined;
  const servicesHealthData = servicesHealth.data as ServicesHealthResponse | undefined;

  const serviceCards = [
    {
      title: t('domain.sustainability.title'),
      description: t('admin.sustainabilityDesc'),
      href: '/admin/sustainability',
      icon: <Leaf className="w-6 h-6" />,
      color: 'green',
      stats: dashboardData?.configuration_summary?.sustainability_criteria,
      serviceKey: 'sustainability'
    },
    {
      title: t('domain.resilience.title'),
      description: t('admin.resilienceDesc'),
      href: '/admin/resilience',
      icon: <Shield className="w-6 h-6" />,
      color: 'purple',
      stats: dashboardData?.configuration_summary?.resilience_scenarios,
      serviceKey: 'resilience'
    },
    {
      title: t('domain.humanCentricity.title'),
      description: t('admin.humanCentricityDesc'),
      href: '/admin/human-centricity',
      icon: <Users className="w-6 h-6" />,
      color: 'blue',
      stats: dashboardData?.configuration_summary?.human_centricity_statements,
      serviceKey: 'human_centricity'
    }
  ];

  const getServiceStatus = (serviceKey: string) => {
    return servicesHealthData?.services?.[serviceKey]?.status || 'unknown';
  };

  const getColorClasses = (color: string) => {
    const colors = {
      green: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        icon: 'bg-green-100 text-green-600',
        status: 'text-green-700'
      },
      purple: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        icon: 'bg-purple-100 text-purple-600',
        status: 'text-purple-700'
      },
      blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        icon: 'bg-blue-100 text-blue-600',
        status: 'text-blue-700'
      }
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'unhealthy':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('admin.dashboard')}
        </h1>
        <p className="text-gray-600">
          {t('admin.managePlatform')}
        </p>
      </div>


      {/* Service Cards */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('admin.managementModules')}</h2>

        {/* NOTE: added auto-rows-fr so each grid cell gets equal height */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-fr">
          {serviceCards.map((service) => {
            const serviceStatus = getServiceStatus(service.serviceKey);
            const colorClasses = getColorClasses(service.color);

            // make Link a block that fills the grid cell (h-full)
            return (
              <Link key={service.title} to={service.href} className="group block h-full">
                <div className={`
                  ${colorClasses.bg} border ${colorClasses.border} rounded-xl p-6 
                  transition-all duration-200 hover:shadow-md group-hover:scale-[1.02]

                  /* make card fill height and use column flex so footer sits at bottom */
                  h-full flex flex-col justify-between
                `}>
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 ${colorClasses.icon} rounded-lg flex items-center justify-center`}>
                        {service.icon}
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(serviceStatus)}`}>
                        {serviceStatus}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {service.title}
                    </h3>

                    {/* allow description to grow if needed */}
                    <p className="text-sm text-gray-600 mb-6 leading-relaxed flex-1">
                      {service.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    {service.stats && (
                      <span className="text-xs text-gray-500">
                        {service.stats}
                      </span>
                    )}
                    <div className="flex items-center text-sm font-medium text-gray-700 group-hover:text-gray-900 ml-auto">
                      {t('admin.manage')}
                      <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Available Actions */}
      {dashboardData?.available_actions && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            {t('admin.availableActions')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(dashboardData.available_actions)
              .filter(([service]) => service !== 'system') // Filter out system
              .map(([service, actions]) => (
              <div key={service} className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3 capitalize">
                  {service.replace('_', ' ')}
                </h3>
                <div className="space-y-2">
                  {Array.isArray(actions) ? actions.map((action, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      <span className="text-sm text-gray-600">{action}</span>
                    </div>
                  )) : (
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      <span className="text-sm text-gray-600">{String(actions)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service Health Overview */}
      <ServiceHealthMonitor />

      
    </div>
  );
}