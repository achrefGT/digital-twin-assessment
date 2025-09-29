import React from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatementManager } from '@/components/admin/human-centricity/StatementManager';

export default function HumanCentricityPage() {
  return (
    <AdminLayout currentSection="human-centricity">
      <div className="space-y-6">
        <StatementManager />
      </div>
    </AdminLayout>
  );
}