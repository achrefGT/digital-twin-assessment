import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Crown,
  User,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  ShieldCheck
} from 'lucide-react';
import { AdminAPI } from '@/services/adminApi';
import { useAuth } from '@/auth/useAuth';
import { useLanguage } from '@/contexts/LanguageContext'

interface UserType {
  user_id: string;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'user' | 'super_admin';
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  last_login: string | null;
}

interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  roles: Record<string, number>;
  recent_registrations: number;
  recently_active: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export function UserManager() {
  const { t } = useLanguage()
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserType[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [processingUser, setProcessingUser] = useState<string | null>(null);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  const fetchUsers = async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await AdminAPI.getAllUsers(
        token,
        pagination.page,
        pagination.limit,
        roleFilter || undefined,
        searchTerm || undefined
      );
      
      setUsers(response.users);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!token) return;
    
    try {
      const response = await AdminAPI.getUserStats(token);
      setStats(response);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    if (!token) return;
    
    setProcessingUser(userId);
    setError(null);
    try {
      await AdminAPI.updateUserRole(userId, newRole, token);
      
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.user_id === userId 
            ? { ...user, role: newRole as 'admin' | 'user' | 'super_admin' }
            : user
        )
      );
      
      await fetchStats();
    } catch (err: any) {
      setError(err.message || 'Failed to update user role');
      await fetchUsers();
    } finally {
      setProcessingUser(null);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [pagination.page, roleFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (pagination.page !== 1) {
        setPagination(prev => ({ ...prev, page: 1 }));
      } else {
        fetchUsers();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <ShieldCheck className="w-4 h-4 text-purple-600" />;
      case 'admin':
        return <Crown className="w-4 h-4 text-yellow-600" />;
      default:
        return <User className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'admin':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      default:
        return 'User';
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesStatus = showInactive || user.is_active;
    return matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
          {t('admin.users')}
        </h1>
        <p className="text-gray-600">{t('admin.manageUserRoles')}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">{t('common.error')}</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t('admin.totalUsers')}</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_users}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t('admin.activeUsers')}</p>
                <p className="text-2xl font-bold text-green-700">{stats.active_users}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t('admin.admins')}</p>
                <p className="text-2xl font-bold text-yellow-700">
                  {(stats.roles.admin || 0) + (stats.roles.super_admin || 0)}
                </p>
              </div>
              <Crown className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{t('admin.sevenDayActive')}</p>
                <p className="text-2xl font-bold text-purple-700">{stats.recently_active}</p>
              </div>
              <Clock className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('admin.searchUsers')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">{t('admin.allRoles')}</option>
            <option value="super_admin">{t('admin.superAdmin')}</option>
            <option value="admin">{t('common.admin')}</option>
            <option value="user">{t('admin.user')}</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">{t('admin.loadingUsers')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.user')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.role')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('admin.lastLogin')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-bold">
                            {(user.first_name?.[0] || user.username[0]).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.first_name && user.last_name 
                              ? `${user.first_name} ${user.last_name}`
                              : user.username}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                          {user.username !== (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.username) && (
                            <div className="text-xs text-gray-400">@{user.username}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(user.role)}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                          {getRoleDisplayName(user.role)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {user.is_active ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-700">{t('admin.active')}</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <span className="text-sm text-red-700">{t('admin.inactive')}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.last_login 
                        ? new Date(user.last_login).toLocaleDateString()
                        : t('admin.never')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {user.role === 'user' && (
                          <button
                            onClick={() => updateUserRole(user.user_id, 'admin')}
                            disabled={processingUser === user.user_id}
                            className="px-3 py-1.5 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                            title={t('admin.promoteToAdmin')}
                          >
                            <Crown className="w-3.5 h-3.5" />
                            {t('admin.promote')}
                          </button>
                        )}
                        {user.role === 'admin' && isSuperAdmin && (
                          <button
                            onClick={() => updateUserRole(user.user_id, 'user')}
                            disabled={processingUser === user.user_id}
                            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                            title={t('admin.demoteToUser')}
                          >
                            <User className="w-3.5 h-3.5" />
                            {t('admin.demote')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && !loading && (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">{t('admin.noUsersFound')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={pagination.page === 1}
            className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('common.previous')}
          </button>
          
          <span className="px-4 py-2 text-sm text-gray-600">
            {t('common.page')} {pagination.page} {t('common.of')} {pagination.pages}
          </span>
          
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
            disabled={pagination.page === pagination.pages}
            className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  );
}