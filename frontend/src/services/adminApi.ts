export const API_BASE_URL = 'http://localhost:8000';

export class AdminApiError extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
    this.name = 'AdminApiError';
  }
}

/* ---------- Types ---------- */

export type UserType = {
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
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type UserStats = {
  total_users: number;
  active_users: number;
  inactive_users: number;
  roles: Record<string, number>;
  recent_registrations: number;
  recently_active: number;
};

export type GetAllUsersResponse = {
  users: UserType[];
  pagination: Pagination;
};

/* ---------- AdminAPI ---------- */

export class AdminAPI {
  private static getHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Generic response handler.
   * Returns T (not T | null) by returning an empty object cast to T when no body is present.
   * This keeps callers' return types clean (e.g. Promise<void>, Promise<UserStats>, etc.).
   */
  private static async handleResponse<T = any>(response: Response): Promise<T> {
    if (response.status === 401) {
      throw new AdminApiError('Session expired. Please log in again.', 401, 'UNAUTHORIZED');
    }
    if (response.status === 403) {
      throw new AdminApiError('Admin access required.', 403, 'FORBIDDEN');
    }

    // Treat 204 No Content as success with no body -> return empty object cast to T
    if (response.status === 204) {
      return {} as T;
    }

    // Non-ok responses: try to parse message then throw
    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        // common API shapes: { detail: '...', message: '...' }
        errorMessage = (errorData?.detail as string) || (errorData?.message as string) || errorMessage;
      } catch {
        // ignore parse error
      }
      throw new AdminApiError(errorMessage, response.status);
    }

    // If there's no body, return empty object cast to T
    const text = await response.text();
    if (!text) return {} as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      // If body isn't JSON, return raw text cast to T
      return (text as unknown) as T;
    }
  }

  /* ---------------- System endpoints ---------------- */

  static async getDashboard(token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
      method: 'GET',
      headers: this.getHeaders(token)
    });
    return this.handleResponse<any>(response);
  }

  static async getServicesHealth(token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/services/health`, {
      method: 'GET',
      headers: this.getHeaders(token)
    });
    return this.handleResponse<any>(response);
  }

  static async validateConfiguration(token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/config/validate`, {
      method: 'POST',
      headers: this.getHeaders(token)
    });
    return this.handleResponse<any>(response);
  }

  /* ---------------- Sustainability endpoints ---------------- */

  static async getAllSustainabilityCriteria(token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/sustainability/criteria/all`, {
      method: 'GET',
      headers: this.getHeaders(token)
    });
    return this.handleResponse<any>(response);
  }

  static async getSustainabilityCriteriaByDomain(domain: string, token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/sustainability/criteria/domain/${encodeURIComponent(domain)}`, {
      method: 'GET',
      headers: this.getHeaders(token)
    });
    return this.handleResponse<any>(response);
  }

  static async createSustainabilityCriterion(data: any, token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/sustainability/criteria`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data)
    });
    return this.handleResponse<any>(response);
  }

  static async updateSustainabilityCriterion(id: string, data: any, token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/sustainability/criteria/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(data)
    });
    return this.handleResponse<any>(response);
  }

  static async deleteSustainabilityCriterion(id: string, token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/sustainability/criteria/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getHeaders(token)
    });
    return this.handleResponse<any>(response);
  }

  static async resetSustainabilityCriteria(domain: string | null, token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/sustainability/criteria/reset`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ domain })
    });
    return this.handleResponse<any>(response);
  }

  /* ---------------- Resilience endpoints ---------------- */

  static async getAllResilienceScenarios(token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/resilience/scenarios/all`, {
      method: 'GET',
      headers: this.getHeaders(token)
    });
    return this.handleResponse<any>(response);
  }

  static async getResilienceScenariosByDomain(domain: string, token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/resilience/scenarios/domain/${encodeURIComponent(domain)}`, {
      method: 'GET',
      headers: this.getHeaders(token)
    });
    return this.handleResponse<any>(response);
  }

  static async createResilienceScenario(data: any, token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/resilience/scenarios`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data)
    });
    return this.handleResponse<any>(response);
  }

  static async updateResilienceScenario(id: string, data: any, token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/resilience/scenarios/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(data)
    });
    return this.handleResponse<any>(response);
  }

  static async deleteResilienceScenario(id: string, token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/resilience/scenarios/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getHeaders(token)
    });
    return this.handleResponse<any>(response);
  }

  static async resetResilienceScenarios(domain: string | null, token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/resilience/scenarios/reset`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ domain })
    });
    return this.handleResponse<any>(response);
  }

  /* ---------------- Human Centricity endpoints ---------------- */

  static async getAllHumanCentricityStatements(token: string, domain?: string, activeOnly: boolean = true): Promise<any> {
    const params = new URLSearchParams();
    if (domain) params.append('domain', domain);
    params.append('active_only', activeOnly.toString());

    const response = await fetch(`${API_BASE_URL}/admin/human-centricity/statements?${params.toString()}`, {
      method: 'GET',
      headers: this.getHeaders(token)
    });
    return this.handleResponse<any>(response);
  }

  static async createHumanCentricityStatement(data: any, token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/human-centricity/statements`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data)
    });
    return this.handleResponse<any>(response);
  }

  static async updateHumanCentricityStatement(id: string, data: any, token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/human-centricity/statements/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(data)
    });
    return this.handleResponse<any>(response);
  }

  static async deleteHumanCentricityStatement(id: string, token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/human-centricity/statements/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getHeaders(token)
    });
    return this.handleResponse<any>(response);
  }

  static async resetHumanCentricityDomain(domain: string, token: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/human-centricity/domains/${encodeURIComponent(domain)}/reset`, {
      method: 'POST',
      headers: this.getHeaders(token)
    });
    return this.handleResponse<any>(response);
  }

  /* ---------------- Users endpoints ---------------- */

  static async getAllUsers(
    token: string,
    page: number = 1,
    limit: number = 20,
    role?: string,
    search?: string
  ): Promise<GetAllUsersResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (role) params.append('role', role);
    if (search) params.append('search', search);

    const response = await fetch(`${API_BASE_URL}/admin/users?${params.toString()}`, {
      method: 'GET',
      headers: this.getHeaders(token)
    });
    return this.handleResponse<GetAllUsersResponse>(response);
  }

  static async getUserStats(token: string): Promise<UserStats> {
    const response = await fetch(`${API_BASE_URL}/admin/users/stats`, {
      method: 'GET',
      headers: this.getHeaders(token)
    });
    return this.handleResponse<UserStats>(response);
  }

  /**
   * updateUserRole and updateUserStatus are declared as Promise<void>
   * They call handleResponse<void> and return void-compatible value.
   */
  static async updateUserRole(userId: string, role: string, token: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(userId)}/role`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify({ role })
    });
    await this.handleResponse<void>(response);
  }

  static async updateUserStatus(userId: string, isActive: boolean, token: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify({ is_active: isActive })
    });
    await this.handleResponse<void>(response);
  }
}

/* ---------- React Query keys (typed consts) ---------- */

export const adminKeys = {
  all: ['admin'] as const,
  dashboard: () => [...adminKeys.all, 'dashboard'] as const,
  servicesHealth: () => [...adminKeys.all, 'services', 'health'] as const,

  // Sustainability
  sustainability: () => [...adminKeys.all, 'sustainability'] as const,
  sustainabilityCriteria: () => [...adminKeys.sustainability(), 'criteria'] as const,
  sustainabilityCriteriaByDomain: (domain: string) => [...adminKeys.sustainabilityCriteria(), domain] as const,

  // Resilience
  resilience: () => [...adminKeys.all, 'resilience'] as const,
  resilienceScenarios: () => [...adminKeys.resilience(), 'scenarios'] as const,
  resilienceScenariosByDomain: (domain: string) => [...adminKeys.resilienceScenarios(), domain] as const,

  // Human Centricity
  humanCentricity: () => [...adminKeys.all, 'human-centricity'] as const,
  humanCentricityStatements: (domain?: string, activeOnly?: boolean) =>
    [...adminKeys.humanCentricity(), 'statements', { domain, activeOnly }] as const,

  // Users
  users: () => [...adminKeys.all, 'users'] as const,
  usersList: (page?: number, role?: string, search?: string) =>
    [...adminKeys.users(), 'list', { page, role, search }] as const,
  usersStats: () => [...adminKeys.users(), 'stats'] as const,
};
