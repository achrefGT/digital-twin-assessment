// Create this as src/components/UserNavigation.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';
import { UserRole } from '@/auth/auth.types';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  LogOut, 
  Settings, 
  Shield, 
  Crown,
  Users,
  ChevronDown,
  LogIn
} from 'lucide-react';

interface UserNavigationProps {
  className?: string;
}

export const UserNavigation: React.FC<UserNavigationProps> = ({ className = '' }) => {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-3 h-3" />;
      case 'assessor':
        return <Users className="w-3 h-3" />;
      default:
        return <User className="w-3 h-3" />;
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'assessor':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getUserInitials = (user: any) => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
        <div className="w-16 h-4 bg-gray-200 rounded animate-pulse hidden sm:block" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Button
          variant="outline"
          onClick={() => navigate('/auth/login')}
          className="border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
        >
          <LogIn className="w-4 h-4 mr-2" />
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Role Badge */}
      <Badge className={`${getRoleColor(user.role)} border font-medium text-xs px-2 py-1 hidden sm:flex items-center gap-1`}>
        {getRoleIcon(user.role)}
        {user.role.toUpperCase()}
      </Badge>

      {/* User Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 h-auto p-2 hover:bg-gray-100 rounded-xl"
          >
            <Avatar className="w-8 h-8">
              <AvatarImage src={user.avatar_url} alt={user.username} />
              <AvatarFallback className="bg-gradient-to-br from-green-500 to-blue-500 text-white text-sm font-semibold">
                {getUserInitials(user)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-semibold text-gray-900">
                {user.first_name && user.last_name 
                  ? `${user.first_name} ${user.last_name}` 
                  : user.username
                }
              </div>
              <div className="text-xs text-gray-500">{user.email}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarImage src={user.avatar_url} alt={user.username} />
                <AvatarFallback className="bg-gradient-to-br from-green-500 to-blue-500 text-white font-semibold">
                  {getUserInitials(user)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold text-gray-900">
                  {user.first_name && user.last_name 
                    ? `${user.first_name} ${user.last_name}` 
                    : user.username
                  }
                </div>
                <div className="text-sm text-gray-500">{user.email}</div>
                <Badge className={`${getRoleColor(user.role)} border text-xs mt-1 inline-flex items-center gap-1`}>
                  {getRoleIcon(user.role)}
                  {user.role}
                </Badge>
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
            <User className="w-4 h-4 mr-3" />
            View Profile
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => navigate('/dashboard')} className="cursor-pointer">
            <Settings className="w-4 h-4 mr-3" />
            Dashboard
          </DropdownMenuItem>

          {user.role === 'admin' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer">
                <Crown className="w-4 h-4 mr-3" />
                Admin Panel
              </DropdownMenuItem>
            </>
          )}

          {user.role === 'assessor' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/assessor')} className="cursor-pointer">
                <Users className="w-4 h-4 mr-3" />
                Assessor Tools
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem 
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="cursor-pointer text-red-600 focus:text-red-600"
          >
            {isLoggingOut ? (
              <>
                <div className="w-4 h-4 mr-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                Signing out...
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4 mr-3" />
                Sign Out
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};