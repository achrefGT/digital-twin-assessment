import React from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { UserManager } from '@/components/admin/UserManagement';

export default function UsersAdminPage() {
  return (
    <AdminLayout currentSection="users">
      <UserManager />
    </AdminLayout>
  );
}