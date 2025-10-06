import React from 'react';
import { CriterionResponse } from '@/types/admin';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Edit,
  Trash2,
  Shield,
  Calendar,
  Key,
  Layers,
  CheckCircle,
  AlertCircle,
  Leaf,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface CriteriaListProps {
  criteria: CriterionResponse[];
  loading: boolean;
  error: Error | null;
  onEdit: (criterion: CriterionResponse) => void;
  onDelete: (criterion: CriterionResponse) => void;
  deletingIds?: string[];
}

// Helper to build a nice title from domain key with translation support
const prettyDomain = (d: string, t: (key: string) => string) => {
  if (!d) return t('common.other');
  const domainKey = `sustainability.${d}` as const;
  return t(domainKey);
};

export function CriteriaList({ criteria, loading, error, onEdit, onDelete, deletingIds = [] }: CriteriaListProps) {
  const { t } = useLanguage();

  // Prevent double-click issues
  const handleDeleteClick = (criterion: CriterionResponse, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent deletion if already in progress
    if (deletingIds.includes(criterion.id)) {
      return;
    }

    onDelete(criterion);
  };

  const getDomainConfig = (domain: string) => {
    switch (domain) {
      case 'environmental':
        return {
          color: 'bg-green-50 text-green-700 border-green-200',
          icon: <div className="w-2 h-2 bg-green-500 rounded-full" />,
        };
      case 'economic':
        return {
          color: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: <div className="w-2 h-2 bg-blue-500 rounded-full" />,
        };
      case 'social':
        return {
          color: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: <div className="w-2 h-2 bg-purple-500 rounded-full" />,
        };
      default:
        return {
          color: 'bg-gray-50 text-gray-700 border-gray-200',
          icon: <div className="w-2 h-2 bg-gray-500 rounded-full" />,
        };
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center animate-pulse">
            <Leaf className="w-4 h-4 text-gray-400" />
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
              <h3 className="font-medium text-red-900 mb-2">{t('sustainability.failedLoadCriteria')}</h3>
              <p className="text-red-700 text-sm">{error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (criteria.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center mb-6 mx-auto">
          <Leaf className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('sustainability.noCriteriaFound')}</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          {t('sustainability.getStartedCriterion')}
        </p>
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm font-medium border border-green-200">
          <CheckCircle className="w-4 h-4" />
          {t('sustainability.readyToCreateCriteria')}
        </div>
      </div>
    );
  }

  // Group criteria by domain
  const grouped = criteria.reduce<Record<string, CriterionResponse[]>>((acc, c) => {
    const domainKey = c.domain || 'other';
    if (!acc[domainKey]) acc[domainKey] = [];
    acc[domainKey].push(c);
    return acc;
  }, {});

  // Preferred display order for domains
  const domainOrder = ['environmental', 'economic', 'social'];
  const orderedDomains = [
    ...domainOrder.filter((d) => grouped[d] && grouped[d].length > 0),
    ...Object.keys(grouped).filter((d) => !domainOrder.includes(d)),
  ];

  // Collapse state so user can hide domains they don't need
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>(() =>
    orderedDomains.reduce((acc, d) => {
      acc[d] = false; // default: expanded
      return acc;
    }, {} as Record<string, boolean>)
  );

  const toggleDomain = (d: string) => {
    setCollapsed((p) => ({ ...p, [d]: !p[d] }));
  };

  // Render a single criterion item (keeps main render tidy)
  const renderCriterion = (criterion: CriterionResponse) => {
    const domainConfig = getDomainConfig(criterion.domain);
    const isDeleting = deletingIds.includes(criterion.id);

    return (
      <div
        key={criterion.id}
        className={`group p-6 hover:bg-gray-50 transition-colors ${isDeleting ? 'opacity-50' : ''}`}
      >
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            {/* Title and Badges */}
            <div className="flex items-center gap-3 mb-3">
              <h4 className="text-lg font-semibold text-gray-900">{criterion.name}</h4>

              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${domainConfig.color}`}>
                  {domainConfig.icon}
                  {prettyDomain(criterion.domain, t)}
                </span>

                {criterion.is_default && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
                    <Shield className="w-3 h-3" />
                    {t('humanCentricity.default')}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <p className="text-gray-600 mb-4 text-sm leading-relaxed">{criterion.description}</p>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">{t('sustainability.key')}</p>
                  <p className="text-sm font-medium text-gray-700">{criterion.criterion_key}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">{t('sustainability.levels')}</p>
                  <p className="text-sm font-medium text-gray-700">{criterion.level_count}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">{t('humanCentricity.created')}</p>
                  <p className="text-sm font-medium text-gray-700">{new Date(criterion.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">{t('humanCentricity.updated')}</p>
                  <p className="text-sm font-medium text-gray-700">{new Date(criterion.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Custom Levels */}
            {criterion.custom_levels && criterion.custom_levels.length > 0 && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs font-medium text-gray-700 mb-2">{t('sustainability.customLevelLabels')}:</p>
                <div className="flex flex-wrap gap-1">
                  {criterion.custom_levels.map((level, idx) => (
                    <span key={idx} className="inline-block px-2 py-1 bg-white text-xs text-gray-600 rounded border border-gray-200">
                      {level}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(criterion)}
              disabled={isDeleting}
              className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Edit className="w-4 h-4" />
              {t('manager.edit')}
            </button>

            <button
              onClick={(e) => handleDeleteClick(criterion, e)}
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
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Leaf className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('sustainability.criteria')}</h3>
              <p className="text-sm text-gray-600">
                {t('sustainability.criteriaConfigured').replace('{count}', criteria.length.toString())}
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
          const cfg = getDomainConfig(domainKey);
          const isCollapsed = !!collapsed[domainKey];

          return (
            <div key={domainKey} className="bg-white rounded-lg border border-gray-100">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium border ${cfg.color}`}>
                    {cfg.icon}
                    <span>{prettyDomain(domainKey, t)}</span>
                    <span className="ml-2 text-xs text-gray-500">{items.length}</span>
                  </div>

                  <p className="text-sm text-gray-500">{t('humanCentricity.groupedView')}</p>
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
                  {items.map((c) => renderCriterion(c))}
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