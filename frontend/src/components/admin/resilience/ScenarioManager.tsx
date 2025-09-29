import React, { useState, useMemo } from 'react';
import { useAdminApi } from '@/hooks/useAdminApi';
import { ScenariosList } from './ScenariosList';
import { ScenarioEditor } from './ScenarioEditor';
import { ResilienceDomain, ScenarioResponse } from '@/types/admin';
import { 
  Plus, 
  RefreshCw, 
  Layers, 
  BarChart3, 
  Shield,
  Copy,
  Zap,
  Activity,
  Heart
} from 'lucide-react';

export function ScenarioManager() {
  const { resilienceScenarios, mutations, isDeleting } = useAdminApi();
  const [selectedDomain, setSelectedDomain] = useState<ResilienceDomain | 'all'>('all');
  const [editingScenario, setEditingScenario] = useState<ScenarioResponse | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const domains: { 
    value: ResilienceDomain | 'all'; 
    label: string;
    color: string;
    bgColor: string;
    icon: React.ReactNode;
  }[] = [
    { 
      value: 'all', 
      label: 'All Domains',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      icon: <BarChart3 className="w-4 h-4" />
    },
    { 
      value: 'Robustness', 
      label: 'Robustness',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      icon: <Shield className="w-4 h-4" />
    },
    { 
      value: 'Redundancy', 
      label: 'Redundancy',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      icon: <Copy className="w-4 h-4" />
    },
    { 
      value: 'Adaptability', 
      label: 'Adaptability',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      icon: <Layers className="w-4 h-4" />
    },
    { 
      value: 'Rapidity', 
      label: 'Rapidity',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      icon: <Zap className="w-4 h-4" />
    },
    { 
      value: 'PHM', 
      label: 'PHM',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      icon: <Activity className="w-4 h-4" />
    }
  ];

  const handleCreate = () => {
    setEditingScenario(null);
    setShowEditor(true);
  };

  const handleEdit = (scenario: ScenarioResponse) => {
    setEditingScenario(scenario);
    setShowEditor(true);
  };

  const handleDelete = (scenario: ScenarioResponse) => {
    // Check if already deleting
    if (isDeleting(scenario.id)) {
      return;
    }

    const confirmMessage = `Are you sure you want to delete this scenario?\n\nThis action cannot be undone.`;
    
    if (window.confirm(confirmMessage)) {
      mutations.deleteResilienceScenario.mutate(scenario.id);
    }
  };

  const handleReset = async (domain?: ResilienceDomain) => {
    const domainText = domain ? ` for ${domain}` : '';
    const confirmMessage = `Are you sure you want to reset all scenarios${domainText}?\n\nThis will delete all existing scenarios and restore defaults. This cannot be undone.`;
    
    if (window.confirm(confirmMessage)) {
      mutations.resetResilienceScenarios.mutate(domain);
    }
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    setEditingScenario(null);
  };

  // Filter scenarios based on selected domain with proper type safety
  const filteredScenarios = useMemo(() => {
    if (!resilienceScenarios.data || !Array.isArray(resilienceScenarios.data)) {
      return [];
    }
    return resilienceScenarios.data.filter((scenario: ScenarioResponse) =>
      selectedDomain === 'all' || scenario.domain === selectedDomain
    );
  }, [resilienceScenarios.data, selectedDomain]);

  // Calculate domain stats with proper type safety
  const domainStats = useMemo(() => {
    if (!resilienceScenarios.data || !Array.isArray(resilienceScenarios.data)) {
      return { Robustness: 0, Redundancy: 0, Adaptability: 0, Rapidity: 0, PHM: 0 };
    }
    
    return resilienceScenarios.data.reduce((acc: Record<ResilienceDomain, number>, scenario: ScenarioResponse) => {
      acc[scenario.domain] = (acc[scenario.domain] || 0) + 1;
      return acc;
    }, { Robustness: 0, Redundancy: 0, Adaptability: 0, Rapidity: 0, PHM: 0 });
  }, [resilienceScenarios.data]);

  // Get list of currently deleting IDs for UI state
  const deletingIds = useMemo(() => {
    if (!resilienceScenarios.data || !Array.isArray(resilienceScenarios.data)) {
      return [];
    }
    return resilienceScenarios.data
      .filter(scenario => isDeleting(scenario.id))
      .map(scenario => scenario.id);
  }, [resilienceScenarios.data, isDeleting]);

  const isResetLoading = mutations.resetResilienceScenarios.isPending;
  const hasActiveOperations = deletingIds.length > 0 || isResetLoading;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Resilience Scenarios
        </h1>
        <p className="text-gray-600">
          Manage robustness, redundancy, adaptability, rapidity, and PHM scenarios for comprehensive assessments
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Domain Filter */}
          <div className="flex gap-2 flex-wrap">
            {domains.map((domain) => (
              <button
                key={domain.value}
                onClick={() => setSelectedDomain(domain.value)}
                disabled={hasActiveOperations}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                  ${selectedDomain === domain.value 
                    ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                {domain.icon}
                <span>{domain.label}</span>
                {domain.value !== 'all' && (
                  <span className="bg-white px-2 py-0.5 rounded-full text-xs">
                    {domainStats[domain.value as ResilienceDomain] || 0}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreate}
              disabled={hasActiveOperations}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm"
            >
              <Plus className="w-5 h-5" />
              <span>Add Scenario</span>
            </button>
            <button
              onClick={() => handleReset(selectedDomain === 'all' ? undefined : selectedDomain)}
              disabled={hasActiveOperations}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm"
            >
              <RefreshCw className={`w-5 h-5 ${isResetLoading ? 'animate-spin' : ''}`} />
              <span>{isResetLoading ? 'Resetting...' : 'Reset to Default'}</span>
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {deletingIds.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              Deleting {deletingIds.length} scenario{deletingIds.length > 1 ? 's' : ''}...
            </p>
          </div>
        )}

        {isResetLoading && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800">
              Resetting scenarios{selectedDomain !== 'all' ? ` for ${selectedDomain}` : ''}...
            </p>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="font-medium text-gray-900">
              {selectedDomain === 'all' ? 'Total Scenarios' : `${selectedDomain} Scenarios`}
            </h3>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {filteredScenarios.length}
          </div>
          <div className="text-sm text-gray-600">
            All scenarios
          </div>
        </div>
        
        {domains.slice(1, 4).map((domain) => {
          const count = domainStats[domain.value as ResilienceDomain] || 0;
          return (
            <div 
              key={domain.value} 
              className={`
                ${domain.bgColor} border border-gray-200 rounded-lg p-4 cursor-pointer transition-all
                ${selectedDomain === domain.value ? 'ring-2 ring-blue-500 shadow-md' : 'hover:shadow-sm'}
                ${hasActiveOperations ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              onClick={() => !hasActiveOperations && setSelectedDomain(domain.value)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={domain.color}>{domain.icon}</div>
                <h3 className={`font-medium text-sm ${domain.color}`}>
                  {domain.label}
                </h3>
              </div>
              <div className={`text-2xl font-bold ${domain.color}`}>{count}</div>
              <div className={`text-sm ${domain.color} opacity-75`}>scenarios defined</div>
            </div>
          );
        })}
      </div>

      {/* Additional Domain Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {domains.slice(4).map((domain) => {
          const count = domainStats[domain.value as ResilienceDomain] || 0;
          return (
            <div 
              key={domain.value} 
              className={`
                ${domain.bgColor} border border-gray-200 rounded-lg p-4 cursor-pointer transition-all
                ${selectedDomain === domain.value ? 'ring-2 ring-blue-500 shadow-md' : 'hover:shadow-sm'}
                ${hasActiveOperations ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              onClick={() => !hasActiveOperations && setSelectedDomain(domain.value)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={domain.color}>{domain.icon}</div>
                <h3 className={`font-medium text-sm ${domain.color}`}>
                  {domain.label}
                </h3>
              </div>
              <div className={`text-2xl font-bold ${domain.color}`}>{count}</div>
              <div className={`text-sm ${domain.color} opacity-75`}>scenarios defined</div>
            </div>
          );
        })}
      </div>

      {/* Scenarios List */}
      <ScenariosList
        scenarios={filteredScenarios}
        loading={resilienceScenarios.isLoading}
        error={resilienceScenarios.error}
        onEdit={handleEdit}
        onDelete={handleDelete}
        deletingIds={deletingIds}
      />

      {/* Editor Modal */}
      {showEditor && (
        <ScenarioEditor
          scenario={editingScenario}
          onClose={handleEditorClose}
        />
      )}
    </div>
  );
}