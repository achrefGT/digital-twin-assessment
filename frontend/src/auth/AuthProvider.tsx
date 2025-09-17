import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { AuthContextType, User, RegisterData } from './auth.types';
import authService from './authService';
import { useToast } from '@/hooks/use-toast';

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

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

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
      const tokens = await authService.login({ username, password });
      
      // Save tokens
      authService.saveTokens(tokens);
      setToken(tokens.access_token);
      setRefreshToken(tokens.refresh_token);
      
      // Fetch user profile
      await fetchUserProfile(tokens.access_token);
      
      toast({
        title: "Login Successful",
        description: "Welcome back to the platform!",
      });
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (userData: RegisterData): Promise<User> => {
    try {
      const newUser = await authService.register(userData);
      
      toast({
        title: "Registration Successful",
        description: "Account created successfully! Please log in.",
      });
      
      return newUser;
    } catch (error) {
      console.error('Registration failed:', error);
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
      // Clear local state regardless of API call result
      authService.clearTokens();
      setUser(null);
      setToken(null);
      setRefreshToken(null);
      
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    }
  };

  const refreshAccessToken = async () => {
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    await handleRefreshToken(refreshToken);
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
        title: "Password Changed",
        description: "Your password has been updated successfully.",
      });
    } catch (error) {
      console.error('Password change failed:', error);
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};