import React, { useState, useMemo } from 'react';
import { useAdminApi } from '@/hooks/useAdminApi';
import { useLanguage } from '@/contexts/LanguageContext';
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
  MessageSquare
} from 'lucide-react';

export function StatementManager() {
  const { mutations, isDeleting } = useAdminApi();
  const { t } = useLanguage();
  const [selectedDomain, setSelectedDomain] = useState<HumanCentricityDomain | 'all'>('all');
  const [editingStatement, setEditingStatement] = useState<StatementResponse | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const statementsQuery = useAdminApi().humanCentricityStatements(
    selectedDomain === 'all' ? undefined : selectedDomain,
    false
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
      label: t('humanCentricity.allDomains'),
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      icon: <BarChart3 className="w-4 h-4" />
    },
    { 
      value: 'Core_Usability', 
      label: t('humanCentricity.usability'),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      icon: <Brain className="w-4 h-4" />
    },
    { 
      value: 'Trust_Transparency', 
      label: t('humanCentricity.trust'),
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      icon: <Shield className="w-4 h-4" />
    },
    { 
      value: 'Workload_Comfort', 
      label: t('humanCentricity.workload'),
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      icon: <Activity className="w-4 h-4" />
    },
    { 
      value: 'Cybersickness', 
      label: t('humanCentricity.cybersickness'),
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      icon: <AlertCircle className="w-4 h-4" />
    },
    { 
      value: 'Emotional_Response', 
      label: t('humanCentricity.emotional'),
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      icon: <Heart className="w-4 h-4" />
    },
    { 
      value: 'Performance', 
      label: t('humanCentricity.performance'),
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

    const confirmMessage = t('confirm.delete') + '\n\n"' + statement.statement_text + '"\n\n' + t('notification.warning.cannotUndo');
    
    if (window.confirm(confirmMessage)) {
      mutations.deleteHumanCentricityStatement.mutate(statement.id);
    }
  };

  const handleReset = async (domain?: HumanCentricityDomain) => {
    const domainText = domain ? ` ${t('humanCentricity.forDomain').replace('{domain}', domain.replace('_', ' '))}` : '';
    const confirmMessage = t('confirm.reset') + domainText + '\n\n' + t('notification.warning.cannotUndo');
    
    if (window.confirm(confirmMessage)) {
      if (domain) {
        mutations.resetHumanCentricityDomain.mutate(domain);
      } else {
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

  const filteredStatements = useMemo(() => {
    if (!statementsQuery.data || !Array.isArray(statementsQuery.data)) {
      return [];
    }
    return statementsQuery.data.filter((statement: StatementResponse) =>
      selectedDomain === 'all' || statement.domain_key === selectedDomain
    );
  }, [statementsQuery.data, selectedDomain]);

  const allStatementsQuery = useAdminApi().humanCentricityStatements(undefined, false);
  const allStatements = useMemo(() => {
    if (!allStatementsQuery.data || !Array.isArray(allStatementsQuery.data)) {
      return [];
    }
    return allStatementsQuery.data as StatementResponse[];
  }, [allStatementsQuery.data]);

  const domainStats = useMemo(() => {
    return allStatements.reduce((acc: Record<HumanCentricityDomain, number>, statement: StatementResponse) => {
      acc[statement.domain_key] = (acc[statement.domain_key] || 0) + 1;
      return acc;
    }, {} as Record<HumanCentricityDomain, number>);
  }, [allStatements]);

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
          {t('humanCentricity.statements')}
        </h1>
        <p className="text-gray-600">
          {t('humanCentricity.manageStatements')}
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
              <span>{t('humanCentricity.addStatement')}</span>
            </button>
            <button
              onClick={() => handleReset(selectedDomain === 'all' ? undefined : selectedDomain)}
              disabled={hasActiveOperations}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm"
            >
              <RefreshCw className={`w-5 h-5 ${isResetLoading ? 'animate-spin' : ''}`} />
              <span>{isResetLoading ? t('humanCentricity.resetting') : t('humanCentricity.resetToDefault')}</span>
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {deletingIds.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              {t('humanCentricity.deletingStatements').replace('{count}', deletingIds.length.toString())}
            </p>
          </div>
        )}

        {isResetLoading && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800">
              {t('humanCentricity.resettingStatements')}{selectedDomain !== 'all' ? t('humanCentricity.forDomain').replace('{domain}', selectedDomain.replace('_', ' ')) : ''}...
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
              {selectedDomain === 'all' ? t('humanCentricity.totalStatements') : t('humanCentricity.domainStatements').replace('{domain}', selectedDomain.replace('_', ' '))}
            </h3>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {filteredStatements.length}
          </div>
          <div className="text-sm text-gray-600">
            {t('humanCentricity.allStatements')}
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
              <div className={`text-sm ${domain.color} opacity-75`}>{t('humanCentricity.statementsDefined')}</div>
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
              <div className={`text-sm ${domain.color} opacity-75`}>{t('humanCentricity.statementsDefined')}</div>
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