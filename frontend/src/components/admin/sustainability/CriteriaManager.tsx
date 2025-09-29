import React, { useState, useMemo } from 'react';
import { useAdminApi } from '@/hooks/useAdminApi';
import { CriteriaList } from './CriteriaList';
import { CriterionEditor } from './CriterionEditor';
import { SustainabilityDomain, CriterionResponse } from '@/types/admin';
import { Plus, RefreshCw, Leaf, BarChart3, DollarSign, Users } from 'lucide-react';

export function CriteriaManager() {
  const { sustainabilityCriteria, mutations, isDeleting } = useAdminApi();
  const [selectedDomain, setSelectedDomain] = useState<SustainabilityDomain | 'all'>('all');
  const [editingCriterion, setEditingCriterion] = useState<CriterionResponse | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const domains: { 
    value: SustainabilityDomain | 'all'; 
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
      value: 'environmental', 
      label: 'Environmental',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      icon: <Leaf className="w-4 h-4" />
    },
    { 
      value: 'economic', 
      label: 'Economic',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      icon: <DollarSign className="w-4 h-4" />
    },
    { 
      value: 'social', 
      label: 'Social',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      icon: <Users className="w-4 h-4" />
    }
  ];

  const handleCreate = () => {
    setEditingCriterion(null);
    setShowEditor(true);
  };

  const handleEdit = (criterion: CriterionResponse) => {
    setEditingCriterion(criterion);
    setShowEditor(true);
  };

  const handleDelete = (criterion: CriterionResponse) => {
    // Check if already deleting
    if (isDeleting(criterion.id)) {
      return;
    }

    const confirmMessage = `Are you sure you want to delete "${criterion.name}"?\n\nThis action cannot be undone.`;
    
    if (window.confirm(confirmMessage)) {
      mutations.deleteSustainabilityCriterion.mutate(criterion.id);
    }
  };

  const handleReset = async (domain?: SustainabilityDomain) => {
    const domainText = domain ? ` for ${domain}` : '';
    const confirmMessage = `Are you sure you want to reset all criteria${domainText}?\n\nThis will delete all existing criteria and restore defaults. This cannot be undone.`;
    
    if (window.confirm(confirmMessage)) {
      mutations.resetSustainabilityCriteria.mutate(domain);
    }
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    setEditingCriterion(null);
  };

  // Filter criteria based on selected domain with proper type safety
  const filteredCriteria = useMemo(() => {
    if (!sustainabilityCriteria.data || !Array.isArray(sustainabilityCriteria.data)) {
      return [];
    }
    return sustainabilityCriteria.data.filter((criterion: CriterionResponse) =>
      selectedDomain === 'all' || criterion.domain === selectedDomain
    );
  }, [sustainabilityCriteria.data, selectedDomain]);

  // Calculate domain stats with proper type safety
  const domainStats = useMemo(() => {
    if (!sustainabilityCriteria.data || !Array.isArray(sustainabilityCriteria.data)) {
      return { environmental: 0, economic: 0, social: 0 };
    }
    
    return sustainabilityCriteria.data.reduce((acc: Record<SustainabilityDomain, number>, criterion: CriterionResponse) => {
      acc[criterion.domain] = (acc[criterion.domain] || 0) + 1;
      return acc;
    }, { environmental: 0, economic: 0, social: 0 });
  }, [sustainabilityCriteria.data]);

  // Get list of currently deleting IDs for UI state
  const deletingIds = useMemo(() => {
    if (!sustainabilityCriteria.data || !Array.isArray(sustainabilityCriteria.data)) {
      return [];
    }
    return sustainabilityCriteria.data
      .filter(criterion => isDeleting(criterion.id))
      .map(criterion => criterion.id);
  }, [sustainabilityCriteria.data, isDeleting]);

  const isResetLoading = mutations.resetSustainabilityCriteria.isPending;
  const hasActiveOperations = deletingIds.length > 0 || isResetLoading;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Sustainability Criteria
        </h1>
        <p className="text-gray-600">
          Manage environmental, economic, and social sustainability criteria for comprehensive assessments
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
                    {domainStats[domain.value as SustainabilityDomain] || 0}
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
              <Plus className="w-4 h-4" />
              <span>Add Scenario</span>
            </button>
            <button
              onClick={() => handleReset(selectedDomain === 'all' ? undefined : selectedDomain)}
              disabled={hasActiveOperations}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isResetLoading ? 'animate-spin' : ''}`} />
              <span>{isResetLoading ? 'Resetting...' : 'Reset to Default'}</span>
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {deletingIds.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              Deleting {deletingIds.length} criterion{deletingIds.length > 1 ? 's' : ''}...
            </p>
          </div>
        )}

        {isResetLoading && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800">
              Resetting criteria{selectedDomain !== 'all' ? ` for ${selectedDomain}` : ''}...
            </p>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Leaf className="w-5 h-5 text-green-600" />
            <h3 className="font-medium text-gray-900">
              {selectedDomain === 'all' ? 'Total Criteria' : `${selectedDomain.charAt(0).toUpperCase() + selectedDomain.slice(1)} Criteria`}
            </h3>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {filteredCriteria.length}
          </div>
          <div className="text-sm text-gray-600">
            Active criteria
          </div>
        </div>
        
        {domains.slice(1).map((domain) => {
          const count = domainStats[domain.value as SustainabilityDomain] || 0;
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
              <div className={`text-sm ${domain.color} opacity-75`}>criteria defined</div>
            </div>
          );
        })}
      </div>

      {/* Criteria List */}
      <CriteriaList
        criteria={filteredCriteria}
        loading={sustainabilityCriteria.isLoading}
        error={sustainabilityCriteria.error}
        onEdit={handleEdit}
        onDelete={handleDelete}
        deletingIds={deletingIds}
      />

      {/* Editor Modal */}
      {showEditor && (
        <CriterionEditor
          criterion={editingCriterion}
          onClose={handleEditorClose}
        />
      )}
    </div>
  );
}