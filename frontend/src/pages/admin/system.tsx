import React from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ServiceHealthMonitor } from '@/components/admin/ServiceHealthMonitor';
import { useAdminApi } from '@/hooks/useAdminApi';

export default function SystemPage() {
  const { mutations } = useAdminApi();

  const handleValidateConfig = () => {
    mutations.validateConfiguration.mutate();
  };

  return (
    <AdminLayout currentSection="system">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Management</h1>
          <p className="text-gray-600 mt-2">
            Monitor system health and manage configuration
          </p>
        </div>

        {/* Service Health */}
        <ServiceHealthMonitor />

        {/* System Actions */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">System Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={handleValidateConfig}
              disabled={mutations.validateConfiguration.isPending}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left disabled:opacity-50"
            >
              <h3 className="font-medium text-gray-900">Validate Configuration</h3>
              <p className="text-sm text-gray-600 mt-1">
                {mutations.validateConfiguration.isPending 
                  ? 'Validating...' 
                  : 'Check system configuration integrity'
                }
              </p>
            </button>
            
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h3 className="font-medium text-gray-900">System Logs</h3>
              <p className="text-sm text-gray-600 mt-1">View system logs (Coming Soon)</p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}