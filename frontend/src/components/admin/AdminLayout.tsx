import React from 'react';
import { useAuth } from '@/auth/useAuth';
import { Navigate } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminSection } from '@/types/admin';
import { Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentSection?: AdminSection;
}

const isAdminish = (role: string | undefined) => ['admin', 'super_admin'].includes(role ?? '');

export function AdminLayout({ children, currentSection }: AdminLayoutProps) {
  const { user, isLoading } = useAuth();
  const { t } = useLanguage();

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mb-4 animate-pulse mx-auto">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">{t('admin.loadingPanel')}</p>
        </div>
      </div>
    );
  }

  // Redirect if not admin
  if (!user || !isAdminish(user.role)) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="flex">
        {/* Sidebar */}
        <AdminSidebar currentSection={currentSection} user={user} />
        
        {/* Main content */}
        <div className="flex-1 ml-64">
          <main className="p-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}