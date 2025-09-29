import React, { useState, useEffect } from 'react';
import { useAdminApi } from '@/hooks/useAdminApi';
import { CriterionResponse, SustainabilityDomain, CriterionCreate, CriterionUpdate } from '@/types/admin';
import { X, Save, AlertCircle, Info, Layers, Key, FileText, Shield, Calendar } from 'lucide-react';

interface CriterionEditorProps {
  criterion?: CriterionResponse | null;
  onClose: () => void;
}

export function CriterionEditor({ criterion, onClose }: CriterionEditorProps) {
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
      setCustomLevelsInput(criterion.custom_levels?.join(', ') || '');
    }
  }, [criterion]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    if (formData.level_count < 2 || formData.level_count > 10) {
      newErrors.level_count = 'Level count must be between 2 and 10';
    }

    if (customLevelsInput.trim()) {
      const levels = customLevelsInput.split(',').map(l => l.trim()).filter(l => l);
      if (levels.length !== formData.level_count) {
        newErrors.custom_levels = `Custom levels must match level count (${formData.level_count})`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    const customLevels = customLevelsInput.trim() 
      ? customLevelsInput.split(',').map(l => l.trim()).filter(l => l)
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
      label: 'Environmental', 
      description: 'Impact on natural environment and resources',
      color: 'border-green-200 bg-green-50'
    },
    { 
      value: 'economic', 
      label: 'Economic', 
      description: 'Financial sustainability and economic impact',
      color: 'border-blue-200 bg-blue-50'
    },
    { 
      value: 'social', 
      label: 'Social', 
      description: 'Social responsibility and community impact',
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
                  {isEdit ? 'Edit Criterion' : 'Create New Criterion'}
                </h2>
                <p className="text-sm text-gray-600">
                  {isEdit ? 'Modify the sustainability criterion details' : 'Define a new sustainability assessment criterion'}
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
              Domain Selection *
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
                  Domain cannot be changed for existing criteria to maintain data consistency.
                </p>
              </div>
            )}
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Criterion Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`
                  w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
                  ${errors.name ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}
                `}
                placeholder="Enter criterion name"
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
                Assessment Levels *
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
              <p className="text-sm text-gray-600 mt-1">Number of assessment levels (2-10)</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              className={`
                w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none
                ${errors.description ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}
              `}
              placeholder="Describe what this criterion measures and how it should be assessed..."
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
                Custom Level Labels <span className="text-gray-500 font-normal text-base">(Optional)</span>
              </label>
              <p className="text-gray-600 mb-3">
                Define custom labels for each assessment level. This helps evaluators understand what each level represents.
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
                placeholder="Enter level labels separated by commas:&#10;Poor, Fair, Good, Very Good, Excellent&#10;&#10;Or try: Not Sustainable, Partially Sustainable, Moderately Sustainable, Highly Sustainable, Fully Sustainable"
              />
              
              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Required levels:</span> {formData.level_count}
                  {customLevelsInput.trim() && (
                    <>
                      <span className="mx-2">•</span>
                      <span className="font-medium">Current levels:</span> {customLevelsInput.split(',').map(l => l.trim()).filter(l => l).length}
                    </>
                  )}
                </div>
                
                {customLevelsInput.trim() && (
                  <button
                    type="button"
                    onClick={() => setCustomLevelsInput('')}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
            
            {errors.custom_levels && (
              <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-900">Invalid custom levels</p>
                  <p className="text-sm text-red-700">{errors.custom_levels}</p>
                </div>
              </div>
            )}
            
            {customLevelsInput.trim() && !errors.custom_levels && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Preview of your custom levels:</h4>
                <div className="flex flex-wrap gap-2">
                  {customLevelsInput.split(',').map((level, index) => {
                    const trimmedLevel = level.trim();
                    if (!trimmedLevel) return null;
                    return (
                      <span 
                        key={index}
                        className="inline-flex items-center px-3 py-1 bg-white border border-blue-300 rounded-lg text-sm font-medium text-blue-800"
                      >
                        Level {index + 1}: {trimmedLevel}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Examples for different domains:</h4>
              <div className="space-y-2 text-sm text-gray-700">
                <div>
                  <span className="font-medium text-green-700">Environmental:</span> 
                  <span className="ml-2">Not Sustainable, Low Impact, Moderate Impact, Eco-Friendly, Carbon Neutral</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Economic:</span> 
                  <span className="ml-2">Not Viable, Low ROI, Break-even, Profitable, Highly Profitable</span>
                </div>
                <div>
                  <span className="font-medium text-purple-700">Social:</span> 
                  <span className="ml-2">Harmful, Concerning, Neutral, Beneficial, Transformative</span>
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
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Automatic Key Generation</h4>
                  <p className="text-sm text-blue-700">
                    A unique criterion key will be automatically generated based on the selected domain (e.g., ENV_01, ECO_02, SOC_03). 
                    This ensures consistency and prevents conflicts with existing criteria.
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
                  <span className="font-medium text-gray-900">Mark as default criterion</span>
                  <p className="text-sm text-gray-600">Default criteria cannot be deleted and serve as system baselines</p>
                </div>
              </label>
            </div>
          )}

          {/* Criterion info for edit mode */}
          {isEdit && criterion && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-5 h-5 text-gray-600" />
                <h4 className="font-medium text-gray-900">Criterion Information</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">ID:</span>
                  <span className="font-medium text-gray-900">{criterion.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Key:</span>
                  <span className="font-medium text-gray-900">{criterion.criterion_key}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Default:</span>
                  <span className="font-medium text-gray-900">{criterion.is_default ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Created:</span>
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
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={mutations.createSustainabilityCriterion.isPending || mutations.updateSustainabilityCriterion.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              <Save className="w-4 h-4" />
              {(mutations.createSustainabilityCriterion.isPending || mutations.updateSustainabilityCriterion.isPending)
                ? 'Saving...' 
                : (isEdit ? 'Update Criterion' : 'Create Criterion')
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}