const API_BASE_URL = 'http://localhost:8000';

export class AdminApiError extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
    this.name = 'AdminApiError';
  }
}

// Admin API service class
export class AdminAPI {
  private static getHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    return headers
  }

  private static async handleResponse<T>(response: Response): Promise<T | null> {
    if (response.status === 401) {
      throw new AdminApiError('Session expired. Please log in again.', 401, 'UNAUTHORIZED');
    }
    if (response.status === 403) {
      throw new AdminApiError('Admin access required.', 403, 'FORBIDDEN');
    }

    // Treat 204 No Content as success with no body
    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // ignore JSON parse errors for error bodies
      }
      throw new AdminApiError(errorMessage, response.status);
    }

    // If there's no body, return null instead of calling .json()
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      // if it's not JSON, return as-is (or throw depending on your needs)
      return text as unknown as T;
    }
  }


  // System endpoints
  static async getDashboard(token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
      method: 'GET',
      headers: this.getHeaders(token)
    });
    return this.handleResponse(response);
  }

  static async getServicesHealth(token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/services/health`, {
      method: 'GET',
      headers: this.getHeaders(token)
    });
    return this.handleResponse(response);
  }

  static async validateConfiguration(token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/config/validate`, {
      method: 'POST',
      headers: this.getHeaders(token)
    });
    return this.handleResponse(response);
  }

  // Sustainability endpoints
  static async getAllSustainabilityCriteria(token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/sustainability/criteria/all`, {
      method: 'GET',
      headers: this.getHeaders(token)
    });
    return this.handleResponse(response);
  }

  static async getSustainabilityCriteriaByDomain(domain: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/sustainability/criteria/domain/${domain}`, {
      method: 'GET',
      headers: this.getHeaders(token)
    });
    return this.handleResponse(response);
  }

  static async createSustainabilityCriterion(data: any, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/sustainability/criteria`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  static async updateSustainabilityCriterion(id: string, data: any, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/sustainability/criteria/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  static async deleteSustainabilityCriterion(id: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/sustainability/criteria/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(token)
    });
    return this.handleResponse(response);
  }

  static async resetSustainabilityCriteria(domain: string | null, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/sustainability/criteria/reset`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ domain })
    });
    return this.handleResponse(response);
  }

  // Resilience endpoints
  static async getAllResilienceScenarios(token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/resilience/scenarios/all`, {
      method: 'GET',
      headers: this.getHeaders(token)
    });
    return this.handleResponse(response);
  }

  static async getResilienceScenariosByDomain(domain: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/resilience/scenarios/domain/${domain}`, {
      method: 'GET',
      headers: this.getHeaders(token)
    });
    return this.handleResponse(response);
  }

  static async createResilienceScenario(data: any, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/resilience/scenarios`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  static async updateResilienceScenario(id: string, data: any, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/resilience/scenarios/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  static async deleteResilienceScenario(id: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/resilience/scenarios/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(token)
    });
    return this.handleResponse(response);
  }

  static async resetResilienceScenarios(domain: string | null, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/resilience/scenarios/reset`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ domain })
    });
    return this.handleResponse(response);
  }

  // Human Centricity endpoints
  static async getAllHumanCentricityStatements(token: string, domain?: string, activeOnly: boolean = true) {
    const params = new URLSearchParams();
    if (domain) params.append('domain', domain);
    params.append('active_only', activeOnly.toString());

    const response = await fetch(`${API_BASE_URL}/admin/human-centricity/statements?${params.toString()}`, {
      method: 'GET',
      headers: this.getHeaders(token)
    });
    return this.handleResponse(response);
  }

  static async createHumanCentricityStatement(data: any, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/human-centricity/statements`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  static async updateHumanCentricityStatement(id: string, data: any, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/human-centricity/statements/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(token),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  static async deleteHumanCentricityStatement(id: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/human-centricity/statements/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(token)
    });
    return this.handleResponse(response);
  }

  static async resetHumanCentricityDomain(domain: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/human-centricity/domains/${domain}/reset`, {
      method: 'POST',
      headers: this.getHeaders(token)
    });
    return this.handleResponse(response);
  }
}

// Query keys for React Query
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
};