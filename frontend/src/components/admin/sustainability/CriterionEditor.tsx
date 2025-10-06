import React, { useState, useEffect } from 'react';
import { useAdminApi } from '@/hooks/useAdminApi';
import { CriterionResponse, SustainabilityDomain, CriterionCreate, CriterionUpdate } from '@/types/admin';
import { useLanguage } from '@/contexts/LanguageContext';
import { X, Save, AlertCircle, Info, Key, FileText, Shield, Calendar } from 'lucide-react';

interface CriterionEditorProps {
  criterion?: CriterionResponse | null;
  onClose: () => void;
}

export function CriterionEditor({ criterion, onClose }: CriterionEditorProps) {
  const { t } = useLanguage();
  const { mutations } = useAdminApi();
  const isEdit = !!criterion;
  
  const [formData, setFormData] = useState<CriterionCreate>({
    name: '',
    description: '',
    domain: 'environmental',
    level_count: 5,
    custom_levels: [],
    is_default: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customLevelsInput, setCustomLevelsInput] = useState('');

  useEffect(() => {
    if (criterion) {
      setFormData({
        name: criterion.name,
        description: criterion.description,
        domain: criterion.domain,
        level_count: criterion.level_count,
        custom_levels: criterion.custom_levels || [],
        is_default: criterion.is_default
      });
      setCustomLevelsInput(criterion.custom_levels?.join('; ') || '');
    }
  }, [criterion]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('manager.nameRequired');
    } else if (formData.name.trim().length < 3) {
      newErrors.name = t('manager.nameMinLength').replace('{min}', '3');
    }

    if (!formData.description.trim()) {
      newErrors.description = t('manager.descriptionRequired');
    } else if (formData.description.trim().length < 10) {
      newErrors.description = t('manager.descriptionMinLength').replace('{min}', '10');
    }

    if (formData.level_count < 2 || formData.level_count > 10) {
      newErrors.level_count = t('manager.levelCountRange').replace('{min}', '2').replace('{max}', '10');
    }

    if (customLevelsInput.trim()) {
      const levels = customLevelsInput.split(';').map(l => l.trim()).filter(l => l);
      if (levels.length !== formData.level_count) {
        newErrors.custom_levels = t('sustainability.customLevelsMustMatch').replace('{count}', formData.level_count.toString());
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    const customLevels = customLevelsInput.trim() 
      ? customLevelsInput.split(';').map(l => l.trim()).filter(l => l)
      : [];

    const submitData = {
      ...formData,
      name: formData.name.trim(),
      description: formData.description.trim(),
      custom_levels: customLevels.length > 0 ? customLevels : undefined
    };

    try {
      if (isEdit && criterion) {
        const updateData: CriterionUpdate = {
          name: submitData.name,
          description: submitData.description,
          level_count: submitData.level_count,
          custom_levels: submitData.custom_levels
        };
        await mutations.updateSustainabilityCriterion.mutateAsync({
          id: criterion.id,
          data: updateData
        });
      } else {
        await mutations.createSustainabilityCriterion.mutateAsync(submitData);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save criterion:', error);
    }
  };

  const domains: { 
    value: SustainabilityDomain; 
    label: string; 
    description: string;
    color: string;
  }[] = [
    { 
      value: 'environmental', 
      label: t('sustainability.environmental'), 
      description: t('sustainability.naturalEnvironment'),
      color: 'border-green-200 bg-green-50'
    },
    { 
      value: 'economic', 
      label: t('sustainability.economic'), 
      description: t('sustainability.financialSustainability'),
      color: 'border-blue-200 bg-blue-50'
    },
    { 
      value: 'social', 
      label: t('sustainability.social'), 
      description: t('sustainability.socialResponsibility'),
      color: 'border-purple-200 bg-purple-50'
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {isEdit ? t('sustainability.editCriterion') : t('sustainability.createNewCriterion')}
                </h2>
                <p className="text-sm text-gray-600">
                  {isEdit ? t('sustainability.modifyCriterion') : t('sustainability.defineCriterion')}
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
            <label className="text-lg font-semibold text-gray-900">
              {t('sustainability.domainSelection')} *
            </label>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {domains.map(domain => (
                <label
                  key={domain.value}
                  className={`
                    cursor-pointer p-4 rounded-lg border-2 transition-colors
                    ${formData.domain === domain.value 
                      ? `${domain.color} border-current` 
                      : 'bg-white border-gray-200 hover:border-gray-300'
                    }
                    ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <input
                    type="radio"
                    name="domain"
                    value={domain.value}
                    checked={formData.domain === domain.value}
                    onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value as SustainabilityDomain }))}
                    disabled={isEdit}
                    className="sr-only"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{domain.label}</h3>
                    <p className="text-sm text-gray-600">{domain.description}</p>
                  </div>
                </label>
              ))}
            </div>
            
            {isEdit && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-700">
                  {t('sustainability.domainCannotChange')}
                </p>
              </div>
            )}
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {t('sustainability.criterionName')} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`
                  w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
                  ${errors.name ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}
                `}
                placeholder={t('sustainability.enterCriterionName')}
              />
              {errors.name && (
                <div className="flex items-center gap-2 mt-1 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{errors.name}</span>
                </div>
              )}
            </div>

            {/* Level Count */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {t('sustainability.assessmentLevels')} *
              </label>
              <input
                type="number"
                min="2"
                max="10"
                value={formData.level_count}
                onChange={(e) => setFormData(prev => ({ ...prev, level_count: parseInt(e.target.value) }))}
                className={`
                  w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
                  ${errors.level_count ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}
                `}
              />
              {errors.level_count && (
                <div className="flex items-center gap-2 mt-1 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">{errors.level_count}</span>
                </div>
              )}
              <p className="text-sm text-gray-600 mt-1">{t('sustainability.numberOfLevels')}</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              {t('sustainability.description')} *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              className={`
                w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none
                ${errors.description ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}
              `}
              placeholder={t('sustainability.describeCriterion')}
            />
            {errors.description && (
              <div className="flex items-center gap-2 mt-1 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{errors.description}</span>
              </div>
            )}
          </div>

          {/* Custom Levels */}
          <div className="space-y-3">
            <div>
              <label className="block text-lg font-semibold text-gray-900 mb-2">
                {t('sustainability.customLevelLabels')} <span className="text-gray-500 font-normal text-base">({t('form.optional')})</span>
              </label>
              <p className="text-gray-600 mb-3">
                {t('sustainability.defineCustomLabels')}
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <textarea
                value={customLevelsInput}
                onChange={(e) => setCustomLevelsInput(e.target.value)}
                rows={3}
                className={`
                  w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-base resize-none
                  ${errors.custom_levels ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}
                `}
                placeholder={t('sustainability.enterLevelLabels') + ':\n' + t('sustainability.exampleLevels') + '\n\n' + t('sustainability.alternativeExample')}
              />
              
              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{t('sustainability.requiredLevels')}:</span> {formData.level_count}
                  {customLevelsInput.trim() && (
                    <>
                      <span className="mx-2">•</span>
                      <span className="font-medium">{t('sustainability.currentLevels')}:</span> {customLevelsInput.split(';').map(l => l.trim()).filter(l => l).length}
                    </>
                  )}
                </div>
                
                {customLevelsInput.trim() && (
                  <button
                    type="button"
                    onClick={() => setCustomLevelsInput('')}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    {t('sustainability.clearAll')}
                  </button>
                )}
              </div>
            </div>
            
            {errors.custom_levels && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-900">{t('sustainability.invalidCustomLevels')}</p>
                  <p className="text-sm text-red-700">{errors.custom_levels}</p>
                </div>
              </div>
            )}
            
            {customLevelsInput.trim() && !errors.custom_levels && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-2">{t('sustainability.previewLevels')}:</h4>
                <div className="flex flex-wrap gap-2">
                  {customLevelsInput.split(';').map((level, index) => {
                    const trimmedLevel = level.trim();
                    if (!trimmedLevel) return null;
                    return (
                      <span 
                        key={index}
                        className="inline-flex items-center px-3 py-1 bg-white border border-blue-300 rounded-lg text-sm font-medium text-blue-800"
                      >
                        {t('sustainability.level')} {index + 1}: {trimmedLevel}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">{t('sustainability.examplesForDomains')}:</h4>
              <div className="space-y-2 text-sm text-gray-700">
                <div>
                  <span className="font-medium text-green-700">{t('sustainability.environmental')}:</span> 
                  <span className="ml-2">{t('sustainability.environmentalExample')}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">{t('sustainability.economic')}:</span> 
                  <span className="ml-2">{t('sustainability.economicExample')}</span>
                </div>
                <div>
                  <span className="font-medium text-purple-700">{t('sustainability.social')}:</span> 
                  <span className="ml-2">{t('sustainability.socialExample')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Auto-generated key info for new criteria */}
          {!isEdit && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-start gap-3">
                <Key className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-1">{t('sustainability.automaticKeyGeneration')}</h4>
                  <p className="text-sm text-blue-700">
                    {t('sustainability.keyGenerationDesc')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Default checkbox (only for new criteria) */}
          {!isEdit && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                  className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                />
                <div>
                  <span className="font-medium text-gray-900">{t('sustainability.markDefaultCriterion')}</span>
                  <p className="text-sm text-gray-600">{t('sustainability.defaultCriteriaDesc')}</p>
                </div>
              </label>
            </div>
          )}

          {/* Criterion info for edit mode */}
          {isEdit && criterion && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-5 h-5 text-gray-600" />
                <h4 className="font-medium text-gray-900">{t('sustainability.criterionInformation')}</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">ID:</span>
                  <span className="font-medium text-gray-900">{criterion.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{t('sustainability.key')}:</span>
                  <span className="font-medium text-gray-900">{criterion.criterion_key}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{t('humanCentricity.default')}:</span>
                  <span className="font-medium text-gray-900">{criterion.is_default ? t('common.yes') : t('common.no')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{t('humanCentricity.created')}:</span>
                  <span className="font-medium text-gray-900">{new Date(criterion.created_at).toLocaleDateString()}</span>
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
              {t('manager.cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={mutations.createSustainabilityCriterion.isPending || mutations.updateSustainabilityCriterion.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              <Save className="w-4 h-4" />
              {(mutations.createSustainabilityCriterion.isPending || mutations.updateSustainabilityCriterion.isPending)
                ? t('manager.saving') 
                : (isEdit ? t('sustainability.updateCriterion') : t('sustainability.createCriterion'))
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}