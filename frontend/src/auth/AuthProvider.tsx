import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { AuthContextType, User, RegisterData, ProfileUpdateData } from './auth.types';
import authService from './authService';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { t } = useLanguage();

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  // Session timeout checker
  useEffect(() => {
    if (!token) return;

    const checkTokenExpiry = () => {
      if (authService.isTokenExpired()) {
        console.warn('🕐 Token expired, logging out automatically');
        logout();
      }
    };

    // Check immediately
    checkTokenExpiry();

    // Check every minute
    const interval = setInterval(checkTokenExpiry, 60000);
    return () => clearInterval(interval);
  }, [token]);

  // Clear all assessment-related data from localStorage
  const clearAllAssessmentData = () => {
    try {
      const keys = Object.keys(localStorage);
      
      // Assessment-related keys to clear
      const assessmentKeys = keys.filter(key => 
        key.startsWith('currentAssessment') ||
        key.startsWith('lastAssessmentId') ||
        key.startsWith('assessmentProgress_') ||
        key.startsWith('domainData_') ||
        key === 'currentAssessment' ||
        key === 'lastAssessmentId'
      );
      
      // Remove all assessment-related data
      assessmentKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ Removed: ${key}`);
      });
      
      console.log(`🗑️ Cleared ${assessmentKeys.length} assessment data items on logout`);
    } catch (error) {
      console.error('⚠️ Failed to clear assessment data:', error);
    }
  };

  const initializeAuth = async () => {
    try {
      const { accessToken, refreshToken: storedRefreshToken } = authService.getStoredTokens();
      
      if (accessToken && storedRefreshToken) {
        if (authService.isTokenExpired()) {
          // Try to refresh the token
          await handleRefreshToken(storedRefreshToken);
        } else {
          // Use existing token
          setToken(accessToken);
          setRefreshToken(storedRefreshToken);
          await fetchUserProfile(accessToken);
        }
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      await logout();
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserProfile = async (authToken: string) => {
    try {
      const userData = await authService.getCurrentUser(authToken);
      setUser(userData);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      throw error;
    }
  };

  const handleRefreshToken = async (currentRefreshToken: string) => {
    try {
      const tokens = await authService.refreshToken(currentRefreshToken);
      authService.saveTokens(tokens);
      
      setToken(tokens.access_token);
      setRefreshToken(tokens.refresh_token);
      
      await fetchUserProfile(tokens.access_token);
    } catch (error) {
      console.error('Token refresh failed:', error);
      await logout();
      throw error;
    }
  };

  const login = async (username: string, password: string) => {
    try {
      // Clear any existing assessment data before login
      clearAllAssessmentData();
      
      const tokens = await authService.login({ username, password });
      
      // Save tokens
      authService.saveTokens(tokens);
      setToken(tokens.access_token);
      setRefreshToken(tokens.refresh_token);
      
      // Fetch user profile
      await fetchUserProfile(tokens.access_token);
      
      toast({
        title: t('notification.auth.loginSuccess'),
        description: t('notification.auth.loginDesc'),
      });
    } catch (error) {
      console.error('Login failed:', error);
      toast({
        title: t('notification.error.title'),
        description: t('notification.auth.loginFailed'),
        variant: 'destructive',
      });
      throw error;
    }
  };

  const register = async (userData: RegisterData): Promise<User> => {
    try {
      const newUser = await authService.register(userData);
      
      toast({
        title: t('notification.success.title'),
        description: t('notification.auth.registerSuccess'),
      });
      
      return newUser;
    } catch (error) {
      console.error('Registration failed:', error);
      toast({
        title: t('notification.error.title'),
        description: t('notification.auth.registerFailed'),
        variant: 'destructive',
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Clear authentication tokens
      authService.clearTokens();
      
      // Clear all assessment-related data
      clearAllAssessmentData();
      
      // Clear auth state
      setUser(null);
      setToken(null);
      setRefreshToken(null);
      
      toast({
        title: t('auth.logout'),
        description: t('notification.auth.logoutSuccess'),
      });
    }
  };

  const refreshAccessToken = async () => {
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    try {
      await handleRefreshToken(refreshToken);
      
      toast({
        title: t('notification.info.title'),
        description: t('notification.auth.tokenRefreshed'),
      });
    } catch (error) {
      toast({
        title: t('notification.error.title'),
        description: t('notification.auth.tokenExpired'),
        variant: 'destructive',
      });
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      await authService.changePassword(token, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      
      toast({
        title: t('notification.success.title'),
        description: t('notification.auth.passwordChanged'),
      });
    } catch (error) {
      console.error('Password change failed:', error);
      toast({
        title: t('notification.error.title'),
        description: t('notification.auth.passwordChangeFailed'),
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateProfile = async (profileData: ProfileUpdateData): Promise<User> => {
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      console.log('Updating profile with data:', profileData);
      
      const updatedUser = await authService.updateProfile(token, profileData);
      
      // Update the user state with the new data
      setUser(updatedUser);
      
      toast({
        title: t('notification.success.title'),
        description: t('notification.auth.profileUpdated'),
      });
      
      return updatedUser;
    } catch (error) {
      console.error('Profile update failed:', error);
      toast({
        title: t('notification.error.title'),
        description: t('notification.auth.profileUpdateFailed'),
        variant: 'destructive',
      });
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    token,
    refreshToken,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    register,
    logout,
    refreshAccessToken,
    changePassword,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};