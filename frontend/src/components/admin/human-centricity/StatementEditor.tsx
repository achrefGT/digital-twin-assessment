import React, { useState, useEffect } from 'react';
import { useAdminApi } from '@/hooks/useAdminApi';
import { useLanguage } from '@/contexts/LanguageContext';
import { StatementResponse, HumanCentricityDomain, StatementCreate, StatementUpdate, PerformanceWidgetConfig } from '@/types/admin';
import { 
  X, 
  Save, 
  AlertCircle, 
  Info, 
  MessageSquare, 
  BarChart3, 
  Hash, 
  Type, 
  Activity, 
  Brain,
  Shield,
  Eye,
  Calendar,
  Settings
} from 'lucide-react';

interface StatementEditorProps {
  statement?: StatementResponse | null;
  onClose: () => void;
}

const isPerformanceConfig = (config: any): config is PerformanceWidgetConfig => {
  return config && ('min' in config || 'max' in config || 'normalization' in config);
};

export function StatementEditor({ statement, onClose }: StatementEditorProps) {
  const { mutations } = useAdminApi();
  const { t } = useLanguage();
  const isEdit = !!statement;
  
  const [formData, setFormData] = useState<StatementCreate>({
    domain_key: 'Core_Usability',
    statement_text: '',
    widget_config: {},
    meta_data: {}
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (statement) {
      setFormData({
        domain_key: statement.domain_key,
        statement_text: statement.statement_text,
        widget_config: statement.widget_config || {},
        meta_data: statement.meta_data || {}
      });
    }
  }, [statement]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.statement_text.trim()) {
      newErrors.statement_text = t('humanCentricity.statementTextRequired');
    } else if (formData.statement_text.trim().length < 5) {
      newErrors.statement_text = t('humanCentricity.statementMinLength');
    } else if (formData.statement_text.trim().length > 500) {
      newErrors.statement_text = t('humanCentricity.statementMaxLength');
    }

    if (formData.domain_key === 'Performance' && formData.widget_config) {
      const config = formData.widget_config;
      
      if (isPerformanceConfig(config)) {
        if (config.min === undefined || config.max === undefined) {
          newErrors.widget_config = t('humanCentricity.performanceMetricsMinMax');
        } else if (config.min >= config.max) {
          newErrors.widget_config = t('humanCentricity.minLessThanMax');
        }
        
        if (!config.normalization || !['direct', 'inverse'].includes(config.normalization)) {
          newErrors.widget_config = t('humanCentricity.normalizationRequired');
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    const submitData = {
      ...formData,
      statement_text: formData.statement_text.trim()
    };

    try {
      if (isEdit && statement) {
        await mutations.updateHumanCentricityStatement.mutateAsync({
          id: statement.id,
          data: submitData as StatementUpdate
        });
      } else {
        await mutations.createHumanCentricityStatement.mutateAsync(submitData);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save statement:', error);
    }
  };

  const domains: { 
    value: HumanCentricityDomain; 
    label: string; 
    description: string;
    color: string;
    icon: React.ReactNode;
    widget: string;
  }[] = [
    { 
      value: 'Core_Usability', 
      label: t('humanCentricity.coreUsability'), 
      description: t('humanCentricity.basicUsability'),
      color: 'border-blue-200 bg-blue-50',
      icon: <BarChart3 className="w-5 h-5 text-blue-600" />,
      widget: t('humanCentricity.likertScale')
    },
    { 
      value: 'Trust_Transparency', 
      label: t('humanCentricity.trustTransparency'), 
      description: t('humanCentricity.systemTransparency'),
      color: 'border-green-200 bg-green-50',
      icon: <Shield className="w-5 h-5 text-green-600" />,
      widget: t('humanCentricity.likertScale')
    },
    { 
      value: 'Workload_Comfort', 
      label: t('humanCentricity.workloadComfort'), 
      description: t('humanCentricity.cognitiveLoad'),
      color: 'border-purple-200 bg-purple-50',
      icon: <Brain className="w-5 h-5 text-purple-600" />,
      widget: t('humanCentricity.slider')
    },
    { 
      value: 'Cybersickness', 
      label: t('humanCentricity.cybersickness'), 
      description: t('humanCentricity.motionSickness'),
      color: 'border-red-200 bg-red-50',
      icon: <AlertCircle className="w-5 h-5 text-red-600" />,
      widget: t('humanCentricity.likertScale')
    },
    { 
      value: 'Emotional_Response', 
      label: t('humanCentricity.emotionalResponse'), 
      description: t('humanCentricity.emotionalReactions'),
      color: 'border-orange-200 bg-orange-50',
      icon: <Activity className="w-5 h-5 text-orange-600" />,
      widget: t('humanCentricity.samScale')
    },
    { 
      value: 'Performance', 
      label: t('humanCentricity.performance'), 
      description: t('humanCentricity.taskPerformance'),
      color: 'border-indigo-200 bg-indigo-50',
      icon: <Hash className="w-5 h-5 text-indigo-600" />,
      widget: t('humanCentricity.numericInput')
    }
  ];

  const selectedDomain = domains.find(d => d.value === formData.domain_key);
  const isPerformanceDomain = formData.domain_key === 'Performance';

  const getDomainScaleInfo = (domain: HumanCentricityDomain) => {
    const scaleMap: Record<HumanCentricityDomain, string> = {
      'Core_Usability': t('humanCentricity.likertRange'),
      'Trust_Transparency': t('humanCentricity.likertRange'),
      'Workload_Comfort': t('humanCentricity.sliderRange'),
      'Cybersickness': t('humanCentricity.severityRange'),
      'Emotional_Response': t('humanCentricity.samRange'),
      'Performance': t('humanCentricity.numericMetrics')
    };
    return scaleMap[domain];
  };

  const handleWidgetConfigChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      widget_config: {
        ...prev.widget_config,
        [field]: value
      }
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {isEdit ? t('humanCentricity.editStatement') : t('humanCentricity.createNewStatement')}
                </h2>
                <p className="text-sm text-gray-600">
                  {isEdit ? t('humanCentricity.modifyStatement') : t('humanCentricity.addCustomStatement')}
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Domain Selection */}
          <div className="space-y-4">
            <div>
              <label className="text-lg font-semibold text-gray-900">
                {t('humanCentricity.assessmentDomain')} *
              </label>
              <p className="text-sm text-gray-600 mt-1">
                {t('humanCentricity.selectDomain')}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {domains.map(domain => (
                <label
                  key={domain.value}
                  className={`
                    cursor-pointer p-4 rounded-lg border-2 transition-colors
                    ${formData.domain_key === domain.value 
                      ? `${domain.color} border-current` 
                      : 'bg-white border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="domain_key"
                    value={domain.value}
                    checked={formData.domain_key === domain.value}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      domain_key: e.target.value as HumanCentricityDomain,
                      widget_config: e.target.value === 'Performance' ? { min: 0, max: 100, normalization: 'inverse' } : {}
                    }))}
                    className="sr-only"
                  />
                  <div className="flex items-start gap-3">
                    {domain.icon}
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{domain.label}</h3>
                      <p className="text-sm text-gray-600">{domain.description}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Domain Scale Info */}
            {formData.domain_key && (
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-900 mb-1">{t('humanCentricity.domainConfiguration')}</h4>
                    <div className="space-y-1">
                      <p className="text-sm text-blue-700">
                        <span className="font-medium">{t('humanCentricity.scale')}:</span> {getDomainScaleInfo(formData.domain_key)}
                      </p>
                      <p className="text-sm text-blue-700">
                        <span className="font-medium">{t('humanCentricity.widget')}:</span> {selectedDomain?.widget}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Statement Text */}
          <div>
            <label className="block text-lg font-semibold text-gray-900 mb-2">
              {t('humanCentricity.statementText')} *
            </label>
            <p className="text-sm text-gray-600 mb-3">
              {t('humanCentricity.writeStatement')}
            </p>
            <textarea
              value={formData.statement_text}
              onChange={(e) => setFormData(prev => ({ ...prev, statement_text: e.target.value }))}
              rows={4}
              className={`
                w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none text-base
                ${errors.statement_text ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}
              `}
              placeholder={t('humanCentricity.enterStatement') + '\n\n' + t('humanCentricity.exampleStatement')}
            />
            <div className="flex justify-between items-center mt-2">
              <div>
                {errors.statement_text && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{errors.statement_text}</span>
                  </div>
                )}
              </div>
              <span className="text-sm text-gray-500">
                {formData.statement_text.length}/500 {t('humanCentricity.characters')}
              </span>
            </div>
          </div>

          {/* Performance Domain Widget Configuration */}
          {isPerformanceDomain && (
            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
              <div className="flex items-start gap-3 mb-4">
                <Settings className="w-5 h-5 text-indigo-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-indigo-900 mb-1">{t('humanCentricity.performanceMetricConfig')}</h4>
                  <p className="text-sm text-indigo-700">{t('humanCentricity.configureRange')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('humanCentricity.minimumValue')} *
                  </label>
                  <input
                    type="number"
                    value={isPerformanceConfig(formData.widget_config) ? formData.widget_config.min : 0}
                    onChange={(e) => handleWidgetConfigChange('min', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0"
                    step="any"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('humanCentricity.maximumValue')} *
                  </label>
                  <input
                    type="number"
                    value={isPerformanceConfig(formData.widget_config) ? formData.widget_config.max : 100}
                    onChange={(e) => handleWidgetConfigChange('max', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="100"
                    step="any"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('humanCentricity.normalization')} *
                  </label>
                  <select
                    value={isPerformanceConfig(formData.widget_config) ? formData.widget_config.normalization : 'inverse'}
                    onChange={(e) => handleWidgetConfigChange('normalization', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="inverse">{t('humanCentricity.inverse')}</option>
                    <option value="direct">{t('humanCentricity.direct')}</option>
                  </select>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-indigo-700">
                    <span className="font-medium">{t('humanCentricity.inverseNormalization')}:</span> {t('humanCentricity.usedForMetrics')}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-indigo-700">
                    <span className="font-medium">{t('humanCentricity.directNormalization')}:</span> {t('humanCentricity.higherBetter')}
                  </p>
                </div>
              </div>

              {errors.widget_config && (
                <div className="mt-3 flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{errors.widget_config}</span>
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h4 className="text-sm font-medium text-blue-900 mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              {t('humanCentricity.statementPreview')}
            </h4>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-1 rounded ${selectedDomain?.color || 'bg-gray-100 text-gray-700'}`}>
                  {selectedDomain?.label || t('humanCentricity.selectDomainPrompt')}
                </span>
              </div>
              <p className="text-gray-900 mb-3">
                {formData.statement_text || t('humanCentricity.enterPreview')}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>{t('humanCentricity.widget')}: {selectedDomain?.widget || t('humanCentricity.autoDetect')}</span>
                <span>•</span>
                <span>{t('humanCentricity.scale')}: {formData.domain_key ? getDomainScaleInfo(formData.domain_key) : t('humanCentricity.selectDomainPrompt')}</span>
              </div>
              {isPerformanceDomain && formData.widget_config && isPerformanceConfig(formData.widget_config) && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">{t('humanCentricity.performanceConfiguration')}:</p>
                  <div className="flex gap-4 text-xs text-gray-700">
                    <span>{t('humanCentricity.range')}: {formData.widget_config.min} - {formData.widget_config.max}</span>
                    <span>•</span>
                    <span>{t('humanCentricity.type')}: {formData.widget_config.normalization === 'inverse' ? t('humanCentricity.lowerIsBetter') : t('humanCentricity.higherIsBetter')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Statement info for edit mode */}
          {isEdit && statement && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-5 h-5 text-gray-600" />
                <h4 className="font-medium text-gray-900">{t('humanCentricity.statementInformation')}</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">ID:</span>
                  <span className="font-medium text-gray-900">{statement.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{t('humanCentricity.type')}:</span>
                  <span className="font-medium text-gray-900">{statement.statement_type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{t('humanCentricity.created')}:</span>
                  <span className="font-medium text-gray-900">{new Date(statement.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{t('humanCentricity.updated')}:</span>
                  <span className="font-medium text-gray-900">{new Date(statement.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-6">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={mutations.createHumanCentricityStatement.isPending || mutations.updateHumanCentricityStatement.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              <Save className="w-4 h-4" />
              {(mutations.createHumanCentricityStatement.isPending || mutations.updateHumanCentricityStatement.isPending)
                ? t('humanCentricity.saving')
                : (isEdit ? t('humanCentricity.updateStatement') : t('humanCentricity.createStatement'))
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}