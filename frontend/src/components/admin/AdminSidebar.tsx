import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AdminSection } from '@/types/admin';
import { Sparkles, ArrowLeft, Settings, Activity, Leaf, Shield, Users, Grid3x3, UserCog, Heart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface AdminSidebarProps {
  currentSection?: AdminSection;
  user: any;
}

export function AdminSidebar({ currentSection, user }: AdminSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage()

  const navigationItems = [
    {
      key: 'dashboard' as AdminSection,
      label: t('admin.dashboard'),
      href: '/admin',
      icon: <Grid3x3 className="w-5 h-5" />
    },
    {
      key: 'users' as AdminSection,
      label: t('admin.users'),
      href: '/admin/users',
      icon: <UserCog className="w-5 h-5" />
    },
    {
      key: 'sustainability' as AdminSection,
      label: t('domain.sustainability.title'),
      href: '/admin/sustainability',
      icon: <Leaf className="w-5 h-5" />
    },
    {
      key: 'resilience' as AdminSection,
      label: t('domain.resilience.title'),
      href: '/admin/resilience',
      icon: <Shield className="w-5 h-5" />
    },
    {
      key: 'human-centricity' as AdminSection,
      label: t('domain.humanCentricity.title'),
      href: '/admin/human-centricity',
      icon: <Heart className="w-5 h-5" />
    }
  ];

  const isActive = (itemKey: AdminSection) => {
    if (itemKey === 'dashboard') {
      return location.pathname === '/admin' || currentSection === 'dashboard';
    }
    return location.pathname.startsWith(`/admin/${itemKey}`) || currentSection === itemKey;
  };

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-white/95 backdrop-blur-md shadow-xl border-r border-white/20">
      {/* Back Button */}
      <div className="p-4 border-b border-white/10">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-all duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('admin.backToSite')}
        </button>
      </div>

      {/* Logo/Brand */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              {t('admin.panel')}
            </h2>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-4">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const active = isActive(item.key);
            return (
              <li key={item.key}>
                <NavLink
                  to={item.href}
                  className={`
                    group flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                    ${active
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  <span className={`transition-colors duration-200 ${active ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {active && (
                    <div className="ml-auto w-1.5 h-1.5 bg-blue-600 rounded-full" />
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">
              {(user.first_name?.[0] || user.username[0]).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.first_name || user.username}
            </p>
            <p className="text-xs text-gray-500">
              {t('admin.adminAccess')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}