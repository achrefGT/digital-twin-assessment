import React, { useState } from 'react';
import { StatementResponse } from '@/types/admin';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Edit,
  Trash2,
  Shield,
  Calendar,
  BarChart3,
  Type,
  MessageSquare,
  Activity,
  Brain,
  Users,
  Heart,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  TrendingDown,
  TrendingUp,
  Settings
} from 'lucide-react';

interface StatementsListProps {
  statements: StatementResponse[];
  loading: boolean;
  error: Error | null;
  onEdit: (statement: StatementResponse) => void;
  onDelete: (statement: StatementResponse) => void;
  deletingIds?: string[];
}

const getDomainConfig = (domain: string, t: (key: string) => string) => {
  const domainMap: Record<string, string> = {
    'Core_Usability': 'humanCentricity.coreUsability',
    'Trust_Transparency': 'humanCentricity.trustTransparency',
    'Workload_Comfort': 'humanCentricity.workloadComfort',
    'Cybersickness': 'humanCentricity.cybersickness',
    'Emotional_Response': 'humanCentricity.emotionalResponse',
    'Performance': 'humanCentricity.performance'
  };

  const displayName = t(domainMap[domain] || 'humanCentricity.other');

  switch (domain) {
    case 'Core_Usability':
      return {
        color: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: <div className="w-2 h-2 bg-blue-500 rounded-full" />,
        displayName,
        primaryIcon: <BarChart3 className="w-4 h-4" />,
        scaleInfo: t('humanCentricity.likertRange')
      };
    case 'Trust_Transparency':
      return {
        color: 'bg-green-50 text-green-700 border-green-200',
        icon: <div className="w-2 h-2 bg-green-500 rounded-full" />,
        displayName,
        primaryIcon: <Shield className="w-4 h-4" />,
        scaleInfo: t('humanCentricity.likertRange')
      };
    case 'Workload_Comfort':
      return {
        color: 'bg-purple-50 text-purple-700 border-purple-200',
        icon: <div className="w-2 h-2 bg-purple-500 rounded-full" />,
        displayName,
        primaryIcon: <Users className="w-4 h-4" />,
        scaleInfo: t('humanCentricity.sliderRange')
      };
    case 'Cybersickness':
      return {
        color: 'bg-red-50 text-red-700 border-red-200',
        icon: <div className="w-2 h-2 bg-red-500 rounded-full" />,
        displayName,
        primaryIcon: <AlertCircle className="w-4 h-4" />,
        scaleInfo: t('humanCentricity.severityRange')
      };
    case 'Emotional_Response':
      return {
        color: 'bg-orange-50 text-orange-700 border-orange-200',
        icon: <div className="w-2 h-2 bg-orange-500 rounded-full" />,
        displayName,
        primaryIcon: <Heart className="w-4 h-4" />,
        scaleInfo: t('humanCentricity.samRange')
      };
    case 'Performance':
      return {
        color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        icon: <div className="w-2 h-2 bg-indigo-500 rounded-full" />,
        displayName,
        primaryIcon: <Activity className="w-4 h-4" />,
        scaleInfo: t('humanCentricity.numericMetrics')
      };
    default:
      return {
        color: 'bg-gray-50 text-gray-700 border-gray-200',
        icon: <div className="w-2 h-2 bg-gray-500 rounded-full" />,
        displayName: t('humanCentricity.other'),
        primaryIcon: <MessageSquare className="w-4 h-4" />,
        scaleInfo: 'Variable'
      };
  }
};

const getWidgetConfig = (widget: string, t: (key: string) => string) => {
  switch (widget) {
    case 'likert':
      return {
        icon: <BarChart3 className="w-4 h-4" />,
        label: t('humanCentricity.likertScale'),
        color: 'text-blue-600'
      };
    case 'slider':
      return {
        icon: <Activity className="w-4 h-4" />,
        label: t('humanCentricity.slider'),
        color: 'text-purple-600'
      };
    case 'numeric':
      return {
        icon: <BarChart3 className="w-4 h-4" />,
        label: t('humanCentricity.numericInput'),
        color: 'text-green-600'
      };
    case 'sam':
      return {
        icon: <Brain className="w-4 h-4" />,
        label: t('humanCentricity.samScale'),
        color: 'text-orange-600'
      };
    case 'text':
      return {
        icon: <Type className="w-4 h-4" />,
        label: t('humanCentricity.textInput'),
        color: 'text-gray-600'
      };
    default:
      return {
        icon: <MessageSquare className="w-4 h-4" />,
        label: t('humanCentricity.custom'),
        color: 'text-gray-600'
      };
  }
};

const PerformanceConfigDisplay = ({ config, t }: { config: Record<string, any>; t: (key: string) => string }) => {
  const normalizationLabel = config.normalization === 'inverse' ? t('humanCentricity.lowerIsBetter') : t('humanCentricity.higherIsBetter');
  const NormIcon = config.normalization === 'inverse' ? TrendingDown : TrendingUp;
  
  return (
    <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
      <div className="flex items-center gap-2 mb-2">
        <Settings className="w-4 h-4 text-indigo-600" />
        <p className="text-xs font-medium text-indigo-900">{t('humanCentricity.performanceConfiguration')}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded p-2 border border-indigo-100">
          <p className="text-xs text-gray-500 mb-1">{t('humanCentricity.range')}</p>
          <p className="text-sm font-medium text-gray-900">
            {config.min ?? 'N/A'} - {config.max ?? 'N/A'}
          </p>
        </div>
        <div className="bg-white rounded p-2 border border-indigo-100">
          <p className="text-xs text-gray-500 mb-1">{t('humanCentricity.normalization')}</p>
          <div className="flex items-center gap-1">
            <NormIcon className="w-3 h-3 text-indigo-600" />
            <p className="text-sm font-medium text-gray-900">{normalizationLabel}</p>
          </div>
        </div>
        {config.unit && (
          <div className="bg-white rounded p-2 border border-indigo-100">
            <p className="text-xs text-gray-500 mb-1">Unit</p>
            <p className="text-sm font-medium text-gray-900">{config.unit}</p>
          </div>
        )}
      </div>
      {config.step && (
        <div className="mt-2 text-xs text-indigo-700">
          <span className="font-medium">Step:</span> {config.step}
        </div>
      )}
    </div>
  );
};

export function StatementsList({ statements, loading, error, onEdit, onDelete, deletingIds = [] }: StatementsListProps) {
  const { t } = useLanguage();

  const handleDeleteClick = (statement: StatementResponse, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (deletingIds.includes(statement.id)) {
      return;
    }

    onDelete(statement);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center animate-pulse">
            <Brain className="w-4 h-4 text-gray-400" />
          </div>
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-6 bg-gray-200 rounded w-48"></div>
                    <div className="h-5 bg-gray-200 rounded w-20"></div>
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="flex gap-4">
                    <div className="h-3 bg-gray-200 rounded w-24"></div>
                    <div className="h-3 bg-gray-200 rounded w-20"></div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <div className="h-8 w-16 bg-gray-200 rounded-lg"></div>
                  <div className="h-8 w-16 bg-gray-200 rounded-lg"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-medium text-red-900 mb-2">{t('humanCentricity.failedLoadStatements')}</h3>
              <p className="text-red-700 text-sm">{error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (statements.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center mb-6 mx-auto">
          <Brain className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('humanCentricity.noStatementsFound')}</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          {t('humanCentricity.getStartedStatement')}
        </p>
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium border border-blue-200">
          <CheckCircle className="w-4 h-4" />
          {t('humanCentricity.readyToCreate')}
        </div>
      </div>
    );
  }

  // Group statements by domain
  const grouped = statements.reduce<Record<string, StatementResponse[]>>((acc, statement) => {
    const domainKey = statement.domain_key || 'other';
    if (!acc[domainKey]) acc[domainKey] = [];
    acc[domainKey].push(statement);
    return acc;
  }, {});

  const domainOrder = ['Core_Usability', 'Trust_Transparency', 'Workload_Comfort', 'Cybersickness', 'Emotional_Response', 'Performance'];
  const orderedDomains = [
    ...domainOrder.filter((d) => grouped[d] && grouped[d].length > 0),
    ...Object.keys(grouped).filter((d) => !domainOrder.includes(d)),
  ];

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    orderedDomains.reduce((acc, d) => {
      acc[d] = false;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const toggleDomain = (domain: string) => {
    setCollapsed((prev) => ({ ...prev, [domain]: !prev[domain] }));
  };

  const renderStatement = (statement: StatementResponse) => {
    const domainConfig = getDomainConfig(statement.domain_key, t);
    const widgetConfig = getWidgetConfig(statement.widget, t);
    const isDeleting = deletingIds.includes(statement.id);
    const isPerformance = statement.domain_key === 'Performance';

    return (
      <div
        key={statement.id}
        className={`group p-6 hover:bg-gray-50 transition-colors ${isDeleting ? 'opacity-50' : ''}`}
      >
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${domainConfig.color}`}>
                {domainConfig.icon}
                {domainConfig.displayName}
              </span>

              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200`}>
                {widgetConfig.icon}
                {widgetConfig.label}
              </span>

              {statement.is_default && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <Shield className="w-3 h-3" />
                  {t('humanCentricity.default')}
                </span>
              )}
            </div>

            {/* Statement Text */}
            <p className="text-gray-900 mb-4 text-sm leading-relaxed font-medium">
              {statement.statement_text}
            </p>

            {/* Performance Domain Configuration Display */}
            {isPerformance && statement.widget_config && Object.keys(statement.widget_config).length > 0 && (
              <PerformanceConfigDisplay config={statement.widget_config} t={t} />
            )}

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">{t('humanCentricity.type')}</p>
                  <p className="text-sm font-medium text-gray-700">{statement.statement_type}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">{t('humanCentricity.created')}</p>
                  <p className="text-sm font-medium text-gray-700">{new Date(statement.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">{t('humanCentricity.updated')}</p>
                  <p className="text-sm font-medium text-gray-700">{new Date(statement.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Widget Config - Only show for non-Performance domains or if no special config */}
            {!isPerformance && statement.widget_config && Object.keys(statement.widget_config).length > 0 && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs font-medium text-gray-700 mb-2">{t('humanCentricity.widgetConfiguration')}:</p>
                <pre className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                  {JSON.stringify(statement.widget_config, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(statement)}
              disabled={isDeleting}
              className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Edit className="w-4 h-4" />
              {t('manager.edit')}
            </button>

            <button
              onClick={(e) => handleDeleteClick(statement, e)}
              disabled={isDeleting}
              className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {isDeleting ? t('manager.deleting') : t('manager.delete')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('humanCentricity.statements')}</h3>
              <p className="text-sm text-gray-600">
                {t('humanCentricity.statementsConfigured').replace('{count}', statements.length.toString())}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-gray-200">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-gray-700">{t('profile.active')}</span>
          </div>
        </div>
      </div>

      {/* Grouped list */}
      <div className="px-4 py-3 space-y-3">
        {orderedDomains.map((domainKey) => {
          const items = grouped[domainKey] || [];
          const domainConfig = getDomainConfig(domainKey, t);
          const isCollapsed = !!collapsed[domainKey];
          const defaultCount = items.filter(s => s.is_default).length;
          const customCount = items.length - defaultCount;

          return (
            <div key={domainKey} className="bg-white rounded-lg border border-gray-100">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium border ${domainConfig.color}`}>
                    {domainConfig.icon}
                    <span>{domainConfig.displayName}</span>
                    <span className="ml-2 text-xs text-gray-500">{items.length}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{defaultCount} {t('humanCentricity.default').toLowerCase()}</span>
                    {customCount > 0 && <span>• {customCount} {t('humanCentricity.custom').toLowerCase()}</span>}
                  </div>
                  
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                    <BarChart3 className="w-3 h-3" />
                    {domainConfig.scaleInfo}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleDomain(domainKey)}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                    aria-expanded={!isCollapsed}
                  >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    <span className="text-xs">{isCollapsed ? t('humanCentricity.show') : t('humanCentricity.hide')}</span>
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="divide-y divide-gray-100">
                  {items.map((statement) => renderStatement(statement))}
                </div>
              )}

              {isCollapsed && (
                <div className="px-4 py-3 text-xs text-gray-500">
                  {t('humanCentricity.statementsHidden').replace('{count}', items.length.toString())}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}