import React from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ScenarioManager } from '@/components/admin/resilience/ScenarioManager';

export default function ResiliencePage() {
  return (
    <AdminLayout currentSection="resilience">
      <div className="space-y-6">
        <ScenarioManager />
      </div>
    </AdminLayout>
  );
}