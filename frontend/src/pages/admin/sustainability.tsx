import React from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { CriteriaManager } from '@/components/admin/sustainability/CriteriaManager';

export default function SustainabilityPage() {
  return (
    <AdminLayout currentSection="sustainability">
      <div className="space-y-6">
        <CriteriaManager />
      </div>
    </AdminLayout>
  );
}