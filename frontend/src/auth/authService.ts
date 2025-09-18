import { 
  User, 
  LoginRequest, 
  LoginResponse, 
  RegisterData, 
  RefreshTokenRequest,
  PasswordChangeRequest,
  ProfileUpdateData,
  AuthError 
} from './auth.types';

const API_BASE_URL = 'http://localhost:8000';

class AuthService {
  private static instance: AuthService;
  
  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      console.log(`Making request to: ${url}`, {
        method: config.method,
        headers: config.headers,
        body: options.body
      });

      const response = await fetch(url, config);
      
      if (!response.ok) {
        let errorData: any;
        
        try {
          // Try to parse JSON error response
          errorData = await response.json();
          console.error('Full API Error Response:', {
            status: response.status,
            statusText: response.statusText,
            errorData,
            rawErrorData: JSON.stringify(errorData, null, 2)
          });
        } catch (jsonError) {
          // If JSON parsing fails, create a basic error
          errorData = {
            detail: `HTTP ${response.status}: ${response.statusText}`,
            status_code: response.status,
          };
        }
        
        // Extract the actual error message with better handling
        let errorMessage: string;
        
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.detail) {
          // Handle both string details and array details (validation errors)
          if (Array.isArray(errorData.detail)) {
            // FastAPI validation errors come as an array
            errorMessage = errorData.detail.map((err: any) => {
              if (typeof err === 'string') return err;
              if (err.msg && err.loc) {
                const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : err.loc;
                return `${field}: ${err.msg}`;
              }
              if (err.msg) return err.msg;
              return JSON.stringify(err);
            }).join(', ');
          } else {
            errorMessage = String(errorData.detail);
          }
        } else if (errorData.message) {
          errorMessage = String(errorData.message);
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        console.error('Processed error message:', errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('API Success Response:', data);
      return data;
      
    } catch (error) {
      console.error('Request failed:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Network error occurred');
    }
  }

  private getAuthHeaders(token: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${token}`,
    };
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    return this.makeRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(userData: RegisterData): Promise<User> {
    return this.makeRequest<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  clearAllUserData(): void {
    // Clear tokens
    this.clearTokens();
    
    // Clear all localStorage data (more aggressive approach)
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('assessment') || 
          key.startsWith('currentAssessment') || 
          key.startsWith('lastAssessmentId') ||
          key.startsWith('domainData_')) {
        localStorage.removeItem(key);
      }
    });
  }

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    return this.makeRequest<LoginResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  async getCurrentUser(token: string): Promise<User> {
    return this.makeRequest<User>('/auth/me', {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });
  }

  async updateProfile(
    token: string, 
    profileData: ProfileUpdateData
  ): Promise<User> {
    // Clean and validate data
    const cleanData: ProfileUpdateData = {};
    
    // Handle first_name - convert empty strings to null, preserve undefined
    if (profileData.first_name !== undefined) {
      cleanData.first_name = profileData.first_name.trim() === '' ? null : profileData.first_name.trim();
    }
    
    // Handle last_name - convert empty strings to null, preserve undefined  
    if (profileData.last_name !== undefined) {
      cleanData.last_name = profileData.last_name.trim() === '' ? null : profileData.last_name.trim();
    }
    
    console.log('Sending profile update request:', {
      originalData: profileData,
      cleanedData: cleanData,
      endpoint: '/auth/profile',
      token_preview: token.substring(0, 20) + '...'
    });
    
    return this.makeRequest<User>('/auth/profile', {
      method: 'PUT',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(cleanData),
    });
  }

  async changePassword(
    token: string, 
    passwordData: PasswordChangeRequest
  ): Promise<{ message: string }> {
    // Validate locally first
    if (!passwordData.current_password) {
      throw new Error('Current password is required');
    }
    
    if (!passwordData.new_password) {
      throw new Error('New password is required');
    }
    
    if (passwordData.new_password.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }
    
    console.log('Sending password change request:', {
      current_password_length: passwordData.current_password.length,
      new_password_length: passwordData.new_password.length,
      endpoint: '/auth/change-password',
      token_preview: token.substring(0, 20) + '...'
    });
    
    return this.makeRequest<{ message: string }>('/auth/change-password', {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(passwordData),
    });
  }

  // Utility methods for token management
  saveTokens(tokens: LoginResponse): void {
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
    localStorage.setItem('token_expires_at', 
      (Date.now() + tokens.expires_in * 1000).toString()
    );
  }

  getStoredTokens(): { accessToken: string | null; refreshToken: string | null } {
    return {
      accessToken: localStorage.getItem('access_token'),
      refreshToken: localStorage.getItem('refresh_token'),
    };
  }

  clearTokens(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_expires_at');
  }

  isTokenExpired(): boolean {
    const expiresAt = localStorage.getItem('token_expires_at');
    if (!expiresAt) return true;
    return Date.now() > parseInt(expiresAt);
  }
}

export default AuthService.getInstance();