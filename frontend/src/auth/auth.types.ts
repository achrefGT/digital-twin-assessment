export type UserRole = 'admin' | 'assessor' | 'user';

export interface User {
  user_id: string;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  avatar_url?: string; 
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface TokenData {
  user_id: string;
  username: string;
  email: string;
  role: UserRole;
  scopes: string[];
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<User>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

export interface AuthError {
  detail: string;
  status_code?: number;
}