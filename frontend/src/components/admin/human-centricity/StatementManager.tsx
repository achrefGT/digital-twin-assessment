import React, { useState, useMemo } from 'react';
import { useAdminApi } from '@/hooks/useAdminApi';
import { StatementsList } from './StatementsList';
import { StatementEditor } from './StatementEditor';
import { HumanCentricityDomain, StatementResponse } from '@/types/admin';
import { 
  Plus, 
  RefreshCw, 
  Brain, 
  BarChart3,
  Shield,
  Users,
  AlertCircle,
  Heart,
  Activity,
  MessageSquare,
  Loader2
} from 'lucide-react';

export function StatementManager() {
  const { mutations, isDeleting } = useAdminApi();
  const [selectedDomain, setSelectedDomain] = useState<HumanCentricityDomain | 'all'>('all');
  const [editingStatement, setEditingStatement] = useState<StatementResponse | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // Get statements data
  const statementsQuery = useAdminApi().humanCentricityStatements(
    selectedDomain === 'all' ? undefined : selectedDomain,
    false // Always show all statements since we removed the active filter
  );

  const domains: { 
    value: HumanCentricityDomain | 'all'; 
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
      value: 'Core_Usability', 
      label: 'Usability',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      icon: <Brain className="w-4 h-4" />
    },
    { 
      value: 'Trust_Transparency', 
      label: 'Trust',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      icon: <Shield className="w-4 h-4" />
    },
    { 
      value: 'Workload_Comfort', 
      label: 'Workload',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      icon: <Activity className="w-4 h-4" />
    },
    { 
      value: 'Cybersickness', 
      label: 'Cybersickness',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      icon: <AlertCircle className="w-4 h-4" />
    },
    { 
      value: 'Emotional_Response', 
      label: 'Emotional',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      icon: <Heart className="w-4 h-4" />
    },
    { 
      value: 'Performance', 
      label: 'Performance',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      icon: <MessageSquare className="w-4 h-4" />
    }
  ];

  const handleCreate = () => {
    setEditingStatement(null);
    setShowEditor(true);
  };

  const handleEdit = (statement: StatementResponse) => {
    setEditingStatement(statement);
    setShowEditor(true);
  };

  const handleDelete = (statement: StatementResponse) => {
    if (isDeleting && isDeleting(statement.id)) {
      return;
    }

    const confirmMessage = `Are you sure you want to delete this statement?\n\n"${statement.statement_text}"\n\nThis action cannot be undone.`;
    
    if (window.confirm(confirmMessage)) {
      mutations.deleteHumanCentricityStatement.mutate(statement.id);
    }
  };

  const handleReset = async (domain?: HumanCentricityDomain) => {
    const domainText = domain ? ` for ${domain.replace('_', ' ')}` : '';
    const confirmMessage = `Are you sure you want to reset all statements${domainText}?\n\nThis will delete all existing statements and restore defaults. This cannot be undone.`;
    
    if (window.confirm(confirmMessage)) {
      if (domain) {
        mutations.resetHumanCentricityDomain.mutate(domain);
      } else {
        // Reset all domains - you may need to implement this or call reset for each domain
        for (const domainItem of domains.slice(1)) {
          if (domainItem.value !== 'all') {
            mutations.resetHumanCentricityDomain.mutate(domainItem.value as HumanCentricityDomain);
          }
        }
      }
    }
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    setEditingStatement(null);
  };

  // Filter statements based on selected domain with proper type safety
  const filteredStatements = useMemo(() => {
    if (!statementsQuery.data || !Array.isArray(statementsQuery.data)) {
      return [];
    }
    return statementsQuery.data.filter((statement: StatementResponse) =>
      selectedDomain === 'all' || statement.domain_key === selectedDomain
    );
  }, [statementsQuery.data, selectedDomain]);

  // Calculate stats for all domains with proper type safety
  const allStatementsQuery = useAdminApi().humanCentricityStatements(undefined, false);
  const allStatements = useMemo(() => {
    if (!allStatementsQuery.data || !Array.isArray(allStatementsQuery.data)) {
      return [];
    }
    return allStatementsQuery.data as StatementResponse[];
  }, [allStatementsQuery.data]);

  // Calculate domain stats
  const domainStats = useMemo(() => {
    return allStatements.reduce((acc: Record<HumanCentricityDomain, number>, statement: StatementResponse) => {
      acc[statement.domain_key] = (acc[statement.domain_key] || 0) + 1;
      return acc;
    }, {} as Record<HumanCentricityDomain, number>);
  }, [allStatements]);

  // Get list of currently deleting IDs for UI state
  const deletingIds = useMemo(() => {
    if (!allStatements) return [];
    return allStatements
      .filter(statement => isDeleting && isDeleting(statement.id))
      .map(statement => statement.id);
  }, [allStatements, isDeleting]);

  const isResetLoading = mutations.resetHumanCentricityDomain.isPending;
  const hasActiveOperations = deletingIds.length > 0 || isResetLoading;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Human Centricity Statements
        </h1>
        <p className="text-gray-600">
          Manage user experience assessment statements across core usability, trust, comfort, and performance domains
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
                    {domainStats[domain.value as HumanCentricityDomain] || 0}
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
              <span>Add Statement</span>
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
              Deleting {deletingIds.length} statement{deletingIds.length > 1 ? 's' : ''}...
            </p>
          </div>
        )}

        {isResetLoading && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800">
              Resetting statements{selectedDomain !== 'all' ? ` for ${selectedDomain.replace('_', ' ')}` : ''}...
            </p>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="font-medium text-gray-900">
              {selectedDomain === 'all' ? 'Total Statements' : `${selectedDomain.replace('_', ' ')} Statements`}
            </h3>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {filteredStatements.length}
          </div>
          <div className="text-sm text-gray-600">
            All statements
          </div>
        </div>
        
        {domains.slice(1, 4).map((domain) => {
          const count = domainStats[domain.value as HumanCentricityDomain] || 0;
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
              <div className={`text-sm ${domain.color} opacity-75`}>statements defined</div>
            </div>
          );
        })}
      </div>

      {/* Additional Domain Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {domains.slice(4).map((domain) => {
          const count = domainStats[domain.value as HumanCentricityDomain] || 0;
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
              <div className={`text-sm ${domain.color} opacity-75`}>statements defined</div>
            </div>
          );
        })}
      </div>

      {/* Statements List */}
      <StatementsList
        statements={filteredStatements}
        loading={statementsQuery.isLoading}
        error={statementsQuery.error}
        onEdit={handleEdit}
        onDelete={handleDelete}
        deletingIds={deletingIds}
      />

      {/* Editor Modal */}
      {showEditor && (
        <StatementEditor
          statement={editingStatement}
          onClose={handleEditorClose}
        />
      )}
    </div>
  );
}