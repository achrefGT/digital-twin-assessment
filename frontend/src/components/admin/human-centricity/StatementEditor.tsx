import React, { useState, useEffect } from 'react';
import { useAdminApi } from '@/hooks/useAdminApi';
import { StatementResponse, HumanCentricityDomain, StatementCreate, StatementUpdate } from '@/types/admin';
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
  Calendar
} from 'lucide-react';

interface StatementEditorProps {
  statement?: StatementResponse | null;
  onClose: () => void;
}

export function StatementEditor({ statement, onClose }: StatementEditorProps) {
  const { mutations } = useAdminApi();
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
      newErrors.statement_text = 'Statement text is required';
    } else if (formData.statement_text.trim().length < 5) {
      newErrors.statement_text = 'Statement text must be at least 5 characters';
    } else if (formData.statement_text.trim().length > 500) {
      newErrors.statement_text = 'Statement text must be less than 500 characters';
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
      label: 'Core Usability', 
      description: 'Basic usability and interface design principles',
      color: 'border-blue-200 bg-blue-50',
      icon: <BarChart3 className="w-5 h-5 text-blue-600" />,
      widget: 'Likert Scale'
    },
    { 
      value: 'Trust_Transparency', 
      label: 'Trust & Transparency', 
      description: 'System transparency and user trust factors',
      color: 'border-green-200 bg-green-50',
      icon: <Shield className="w-5 h-5 text-green-600" />,
      widget: 'Likert Scale'
    },
    { 
      value: 'Workload_Comfort', 
      label: 'Workload & Comfort', 
      description: 'Cognitive load and physical comfort assessment',
      color: 'border-purple-200 bg-purple-50',
      icon: <Brain className="w-5 h-5 text-purple-600" />,
      widget: 'Slider (0-100)'
    },
    { 
      value: 'Cybersickness', 
      label: 'Cybersickness', 
      description: 'Motion sickness and discomfort in digital environments',
      color: 'border-red-200 bg-red-50',
      icon: <AlertCircle className="w-5 h-5 text-red-600" />,
      widget: 'Likert Scale'
    },
    { 
      value: 'Emotional_Response', 
      label: 'Emotional Response', 
      description: 'User emotional reactions and engagement patterns',
      color: 'border-orange-200 bg-orange-50',
      icon: <Activity className="w-5 h-5 text-orange-600" />,
      widget: 'SAM Scale'
    },
    { 
      value: 'Performance', 
      label: 'Performance', 
      description: 'Task performance and efficiency metrics',
      color: 'border-indigo-200 bg-indigo-50',
      icon: <Hash className="w-5 h-5 text-indigo-600" />,
      widget: 'Numeric Input'
    }
  ];

  const selectedDomain = domains.find(d => d.value === formData.domain_key);

  // Get domain scale info
  const getDomainScaleInfo = (domain: HumanCentricityDomain) => {
    const scaleMap: Record<HumanCentricityDomain, string> = {
      'Core_Usability': '1-7 Likert (Strongly Disagree to Strongly Agree)',
      'Trust_Transparency': '1-7 Likert (Strongly Disagree to Strongly Agree)',
      'Workload_Comfort': '0-100 Slider (Very Low to Very High)',
      'Cybersickness': '1-5 Severity (None to Very Severe)',
      'Emotional_Response': '1-5 SAM (Valence & Arousal)',
      'Performance': 'Numeric metrics (time, errors, help requests)'
    };
    return scaleMap[domain];
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
                  {isEdit ? 'Edit Statement' : 'Create New Statement'}
                </h2>
                <p className="text-sm text-gray-600">
                  {isEdit ? 'Modify the human centricity statement' : 'Add a custom assessment statement to a domain'}
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
                Assessment Domain *
              </label>
              <p className="text-sm text-gray-600 mt-1">
                Select which domain this statement belongs to. Each domain has a fixed scale.
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
                    onChange={(e) => setFormData(prev => ({ ...prev, domain_key: e.target.value as HumanCentricityDomain }))}
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
                    <h4 className="text-sm font-medium text-blue-900 mb-1">Domain Configuration</h4>
                    <div className="space-y-1">
                      <p className="text-sm text-blue-700">
                        <span className="font-medium">Scale:</span> {getDomainScaleInfo(formData.domain_key)}
                      </p>
                      <p className="text-sm text-blue-700">
                        <span className="font-medium">Widget:</span> {selectedDomain?.widget}
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
              Statement Text *
            </label>
            <p className="text-sm text-gray-600 mb-3">
              Write a clear, actionable statement or question. This will be presented to users during assessment.
            </p>
            <textarea
              value={formData.statement_text}
              onChange={(e) => setFormData(prev => ({ ...prev, statement_text: e.target.value }))}
              rows={4}
              className={`
                w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none text-base
                ${errors.statement_text ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}
              `}
              placeholder="Enter the assessment statement or question...&#10;&#10;Example: 'The system interface was easy to navigate and understand'"
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
                {formData.statement_text.length}/500 characters
              </span>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h4 className="text-sm font-medium text-blue-900 mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Statement Preview
            </h4>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-1 rounded ${selectedDomain?.color || 'bg-gray-100 text-gray-700'}`}>
                  {selectedDomain?.label || 'Select Domain'}
                </span>
              </div>
              <p className="text-gray-900 mb-3">
                {formData.statement_text || 'Enter your statement text above to see preview...'}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Widget: {selectedDomain?.widget || 'Auto-detect'}</span>
                <span>•</span>
                <span>Scale: {formData.domain_key ? getDomainScaleInfo(formData.domain_key) : 'Select domain'}</span>
              </div>
            </div>
          </div>

          {/* Statement info for edit mode */}
          {isEdit && statement && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-5 h-5 text-gray-600" />
                <h4 className="font-medium text-gray-900">Statement Information</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">ID:</span>
                  <span className="font-medium text-gray-900">{statement.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium text-gray-900">{statement.statement_type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium text-gray-900">{new Date(statement.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Updated:</span>
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
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={mutations.createHumanCentricityStatement.isPending || mutations.updateHumanCentricityStatement.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
            >
              <Save className="w-4 h-4" />
              {(mutations.createHumanCentricityStatement.isPending || mutations.updateHumanCentricityStatement.isPending)
                ? 'Saving...' 
                : (isEdit ? 'Update Statement' : 'Create Statement')
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}