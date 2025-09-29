import React, { useState, useEffect } from 'react';
import { useAdminApi } from '@/hooks/useAdminApi';
import { ScenarioResponse, ResilienceDomain, ScenarioCreate, ScenarioUpdate } from '@/types/admin';
import { X, Save, AlertCircle, Info, Shield, Calendar, FileText, Clock } from 'lucide-react';

interface ScenarioEditorProps {
  scenario?: ScenarioResponse | null;
  onClose: () => void;
}

export function ScenarioEditor({ scenario, onClose }: ScenarioEditorProps) {
  const { mutations } = useAdminApi();
  const isEdit = !!scenario;
  
  const [formData, setFormData] = useState<ScenarioCreate>({
    domain: 'Robustness',
    scenario_text: '',
    description: '',
    is_default: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (scenario) {
      setFormData({
        domain: scenario.domain,
        scenario_text: scenario.scenario_text,
        description: scenario.description || '',
        is_default: scenario.is_default
      });
    }
  }, [scenario]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.scenario_text.trim()) {
      newErrors.scenario_text = 'Scenario text is required';
    } else if (formData.scenario_text.trim().length < 10) {
      newErrors.scenario_text = 'Scenario text must be at least 10 characters';
    } else if (formData.scenario_text.trim().length > 1000) {
      newErrors.scenario_text = 'Scenario text must be less than 1000 characters';
    }

    if (formData.description && formData.description.trim().length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    const submitData = {
      ...formData,
      scenario_text: formData.scenario_text.trim(),
      description: formData.description?.trim() || undefined
    };

    try {
      if (isEdit && scenario) {
        const updateData: ScenarioUpdate = {
          scenario_text: submitData.scenario_text,
          domain: submitData.domain,
          description: submitData.description
        };
        await mutations.updateResilienceScenario.mutateAsync({
          id: scenario.id,
          data: updateData
        });
      } else {
        await mutations.createResilienceScenario.mutateAsync(submitData);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save scenario:', error);
    }
  };

  const domains: { 
    value: ResilienceDomain; 
    label: string; 
    description: string;
    color: string;
  }[] = [
    { 
      value: 'Robustness', 
      label: 'Robustness', 
      description: 'System ability to maintain function under stress and failure conditions',
      color: 'border-blue-200 bg-blue-50'
    },
    { 
      value: 'Redundancy', 
      label: 'Redundancy', 
      description: 'Backup systems and alternative pathways for critical functions',
      color: 'border-green-200 bg-green-50'
    },
    { 
      value: 'Adaptability', 
      label: 'Adaptability', 
      description: 'System flexibility to adjust and evolve with changing conditions',
      color: 'border-purple-200 bg-purple-50'
    },
    { 
      value: 'Rapidity', 
      label: 'Rapidity', 
      description: 'Speed of response and recovery from disruptions',
      color: 'border-orange-200 bg-orange-50'
    },
    { 
      value: 'PHM', 
      label: 'PHM (Prognostics & Health Management)', 
      description: 'Predictive maintenance and health monitoring capabilities',
      color: 'border-indigo-200 bg-indigo-50'
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
                  {isEdit ? 'Edit Scenario' : 'Create New Scenario'}
                </h2>
                <p className="text-sm text-gray-600">
                  {isEdit ? 'Modify the resilience scenario details' : 'Define a new resilience assessment scenario'}
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
              Resilience Domain *
            </label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {domains.map(domain => (
                <label
                  key={domain.value}
                  className={`
                    cursor-pointer p-4 rounded-lg border-2 transition-colors
                    ${formData.domain === domain.value 
                      ? `${domain.color} border-current` 
                      : 'bg-white border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="domain"
                    value={domain.value}
                    checked={formData.domain === domain.value}
                    onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value as ResilienceDomain }))}
                    className="sr-only"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{domain.label}</h3>
                    <p className="text-sm text-gray-600">{domain.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Scenario Text */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Scenario Description *
            </label>
            <textarea
              value={formData.scenario_text}
              onChange={(e) => setFormData(prev => ({ ...prev, scenario_text: e.target.value }))}
              rows={6}
              className={`
                w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none
                ${errors.scenario_text ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}
              `}
              placeholder={`Describe a ${formData.domain.toLowerCase()} scenario that assessors will evaluate...`}
            />
            {errors.scenario_text && (
              <div className="flex items-center gap-2 mt-1 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{errors.scenario_text}</span>
              </div>
            )}
            <div className="flex justify-between items-center mt-1">
              <p className="text-sm text-gray-600">
                This scenario will be presented to assessors for evaluation
              </p>
              <span className={`text-xs ${formData.scenario_text.length > 900 ? 'text-red-500' : 'text-gray-500'}`}>
                {formData.scenario_text.length}/1000
              </span>
            </div>
          </div>

          {/* Additional Description */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Additional Context <span className="text-gray-500 font-normal">(Optional)</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className={`
                w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none
                ${errors.description ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}
              `}
              placeholder="Additional context or instructions for this scenario..."
            />
            {errors.description && (
              <div className="flex items-center gap-2 mt-1 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{errors.description}</span>
              </div>
            )}
            <div className="flex justify-between items-center mt-1">
              <p className="text-sm text-gray-600">
                Additional context for assessors (optional)
              </p>
              <span className={`text-xs ${(formData.description || '').length > 450 ? 'text-red-500' : 'text-gray-500'}`}>
                {(formData.description || '').length}/500
              </span>
            </div>
          </div>

          {/* Default checkbox (only for new scenarios) */}
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
                  <span className="font-medium text-gray-900">Mark as default scenario</span>
                  <p className="text-sm text-gray-600">Default scenarios cannot be deleted and serve as system baselines</p>
                </div>
              </label>
            </div>
          )}

          {/* Scenario info for edit mode */}
          {isEdit && scenario && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-5 h-5 text-gray-600" />
                <h4 className="font-medium text-gray-900">Scenario Information</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">ID:</span>
                  <span className="font-medium text-gray-900">{scenario.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Domain:</span>
                  <span className="font-medium text-gray-900">{scenario.domain}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Default:</span>
                  <span className="font-medium text-gray-900">{scenario.is_default ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Length:</span>
                  <span className="font-medium text-gray-900">{scenario.scenario_text.length} chars</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium text-gray-900">{new Date(scenario.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Updated:</span>
                  <span className="font-medium text-gray-900">{new Date(scenario.updated_at).toLocaleDateString()}</span>
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
              disabled={mutations.createResilienceScenario.isPending || mutations.updateResilienceScenario.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              <Save className="w-4 h-4" />
              {(mutations.createResilienceScenario.isPending || mutations.updateResilienceScenario.isPending)
                ? 'Saving...' 
                : (isEdit ? 'Update Scenario' : 'Create Scenario')
              }
            </button>
          </div>
        </div>
      </div>
    </div>);
}