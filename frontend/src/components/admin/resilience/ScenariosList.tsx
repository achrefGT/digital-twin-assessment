import React from 'react';
import { ScenarioResponse } from '@/types/admin';
import {
  Edit,
  Trash2,
  Shield,
  Calendar,
  FileText,
  AlertCircle,
  Layers,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle,
} from 'lucide-react';

interface ScenariosListProps {
  scenarios: ScenarioResponse[];
  loading: boolean;
  error: Error | null;
  onEdit: (scenario: ScenarioResponse) => void;
  onDelete: (scenario: ScenarioResponse) => void;
  deletingIds?: string[];
}

// Helper to build a nice title from domain key
const prettyDomain = (d: string) => {
  if (!d) return 'Other';
  return d.charAt(0).toUpperCase() + d.slice(1);
};

export function ScenariosList({ scenarios, loading, error, onEdit, onDelete, deletingIds = [] }: ScenariosListProps) {
  // Prevent double-click issues
  const handleDeleteClick = (scenario: ScenarioResponse, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Prevent deletion if already in progress
    if (deletingIds.includes(scenario.id)) {
      return;
    }

    onDelete(scenario);
  };

  const getDomainConfig = (domain: string) => {
    switch (domain) {
      case 'Robustness':
        return {
          color: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: <div className="w-2 h-2 bg-blue-500 rounded-full" />,
        };
      case 'Redundancy':
        return {
          color: 'bg-green-50 text-green-700 border-green-200',
          icon: <div className="w-2 h-2 bg-green-500 rounded-full" />,
        };
      case 'Adaptability':
        return {
          color: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: <div className="w-2 h-2 bg-purple-500 rounded-full" />,
        };
      case 'Rapidity':
        return {
          color: 'bg-orange-50 text-orange-700 border-orange-200',
          icon: <div className="w-2 h-2 bg-orange-500 rounded-full" />,
        };
      case 'PHM':
        return {
          color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: <div className="w-2 h-2 bg-indigo-500 rounded-full" />,
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
            <Layers className="w-4 h-4 text-gray-400" />
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
              <h3 className="font-medium text-red-900 mb-2">Failed to Load Scenarios</h3>
              <p className="text-red-700 text-sm">{error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (scenarios.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center mb-6 mx-auto">
          <Layers className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">No Scenarios Found</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Get started by creating your first resilience scenario. Define assessment scenarios for your digital twin evaluations.
        </p>
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium border border-blue-200">
          <FileText className="w-4 h-4" />
          Ready to create scenarios
        </div>
      </div>
    );
  }

  // Group scenarios by domain
  const grouped = scenarios.reduce<Record<string, ScenarioResponse[]>>((acc, s) => {
    const domainKey = s.domain || 'other';
    if (!acc[domainKey]) acc[domainKey] = [];
    acc[domainKey].push(s);
    return acc;
  }, {});

  // Preferred display order for domains
  const domainOrder = ['Robustness', 'Redundancy', 'Adaptability', 'Rapidity', 'PHM'];
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

  // Render a single scenario item (keeps main render tidy)
  const renderScenario = (scenario: ScenarioResponse) => {
    const domainConfig = getDomainConfig(scenario.domain);
    const isDeleting = deletingIds.includes(scenario.id);

    return (
      <div
        key={scenario.id}
        className={`group p-6 hover:bg-gray-50 transition-colors ${isDeleting ? 'opacity-50' : ''}`}
      >
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            {/* Domain and Default Badges */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${domainConfig.color}`}>
                  {domainConfig.icon}
                  {scenario.domain}
                </span>

                {scenario.is_default && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
                    <Shield className="w-3 h-3" />
                    Default
                  </span>
                )}
              </div>
            </div>

            {/* Scenario Text */}
            <p className="text-gray-900 mb-4 leading-relaxed">{scenario.scenario_text}</p>

            {/* Description */}
            {scenario.description && (
              <p className="text-gray-600 mb-4 text-sm leading-relaxed">{scenario.description}</p>
            )}

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Length</p>
                  <p className="text-sm font-medium text-gray-700">{scenario.scenario_text.length} chars</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Created</p>
                  <p className="text-sm font-medium text-gray-700">{new Date(scenario.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Updated</p>
                  <p className="text-sm font-medium text-gray-700">{new Date(scenario.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(scenario)}
              disabled={isDeleting}
              className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>

            <button
              onClick={(e) => handleDeleteClick(scenario, e)}
              disabled={isDeleting}
              className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {isDeleting ? 'Deleting...' : 'Delete'}
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
              <Shield className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Resilience Scenarios</h3>
              <p className="text-sm text-gray-600">{scenarios.length} scenarios configured</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-gray-200">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Active</span>
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
                    <span>{prettyDomain(domainKey)}</span>
                    <span className="ml-2 text-xs text-gray-500">{items.length}</span>
                  </div>

                  <p className="text-sm text-gray-500">Grouped view</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleDomain(domainKey)}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                    aria-expanded={!isCollapsed}
                  >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    <span className="text-xs">{isCollapsed ? 'Show' : 'Hide'}</span>
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="divide-y divide-gray-100">
                  {items.map((s) => renderScenario(s))}
                </div>
              )}

              {isCollapsed && (
                <div className="px-4 py-3 text-xs text-gray-500">{items.length} scenarios hidden</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}