/**
 * Centralized API Client for KALE Pool System
 * Handles all HTTP communication with proper error handling, retries, and type safety
 */

import {
  APIResponse,
  APIError,
  HealthResponse,
  InfoResponse,
  RegisterUserRequest,
  RegisterUserResponse,
  CheckFundingRequest,
  CheckFundingResponse,
  UserStatusResponse,
  PoolerSummary,
  PoolerDetails,
  JoinPoolRequest,
  JoinPoolResponse,
  ConfirmJoinRequest,
  ConfirmJoinResponse,
  BlockDiscoveredEvent,
  BlockDiscoveredResponse,
  PoolerStatusResponse,
  PlantRequest,
  PlantResponse,
  WorkRequest,
  WorkResponse,
  HarvestRequest,
  HarvestResponse,
  PaginatedResponse,
  FilterParams
} from '@shared/api';

// Environment configuration
// Backend (Express) base URL defaults to 3000; Pooler (Fastify) base URL defaults to 3001
const BACKEND_API_BASE_URL =
  import.meta.env.VITE_BACKEND_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const POOLER_API_BASE_URL =
  import.meta.env.VITE_POOLER_API_BASE_URL || 'http://localhost:3001';
const DEFAULT_TIMEOUT = 10000;
const MAX_RETRIES = 3;

// Custom error class for API errors
export class APIClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIClientError';
  }
}

// Request interceptor types
interface RequestConfig extends RequestInit {
  timeout?: number;
  retries?: number;
  skipAuth?: boolean;
}

class APIClient {
  private baseURL: string;
  private defaultTimeout: number;

  private poolerBaseURL: string = POOLER_API_BASE_URL;

  constructor(baseURL: string = BACKEND_API_BASE_URL, timeout: number = DEFAULT_TIMEOUT) {
    this.baseURL = baseURL; // Backend base URL
    this.defaultTimeout = timeout;
  }

  /**
   * Core request method with error handling and retries
   */
  private async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const {
      timeout = this.defaultTimeout,
      retries = MAX_RETRIES,
      skipAuth = false,
      ...fetchConfig
    } = config;

    const url = `${this.baseURL}${endpoint}`;
    
    // Default headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...fetchConfig.headers,
    };

    // Add authentication headers
    if (!skipAuth) {
      const token = localStorage.getItem('kale-pool-token');
      if (token) {
        (headers as Record<string, string>).Authorization = `Bearer ${token}`;
      }
    }

    const requestConfig: RequestInit = {
      ...fetchConfig,
      headers,
    };

    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          ...requestConfig,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text();
          let errorData: APIError;

          try {
            errorData = JSON.parse(errorBody);
          } catch {
            errorData = {
              error: 'HTTP_ERROR',
              message: `HTTP ${response.status}: ${response.statusText}`,
              timestamp: new Date().toISOString(),
            };
          }

          throw new APIClientError(
            response.status,
            errorData.code || 'HTTP_ERROR',
            errorData.message || `HTTP ${response.status}`,
            errorData.details
          );
        }

        const data = await response.json();
        return data;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors (4xx) or specific errors
        if (
          error instanceof APIClientError &&
          (error.status >= 400 && error.status < 500)
        ) {
          throw error;
        }

        // Don't retry on abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          throw new APIClientError(408, 'TIMEOUT', 'Request timeout');
        }

        // Wait before retrying (exponential backoff)
        if (attempt < retries) {
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw lastError!;
  }

  // HTTP method helpers
  private get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  private post<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  private put<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  private delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  // ==================== Health & Info APIs ====================

  async getHealth(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/health');
  }

  async getInfo(): Promise<InfoResponse> {
    return this.get<InfoResponse>('/info');
  }

  // ==================== Registration APIs ====================

  async registerUser(data: RegisterUserRequest): Promise<RegisterUserResponse> {
    return this.post<RegisterUserResponse>('/register-farmer', data);
  }

  async checkFunding(data: CheckFundingRequest): Promise<CheckFundingResponse> {
    return this.post<CheckFundingResponse>('/check-funding', data);
  }

  async getUserStatus(userId: string): Promise<UserStatusResponse> {
    return this.get<UserStatusResponse>(`/user/${userId}/status`);
  }

  // ==================== Farmer Analytics APIs ====================

  private validateAndGetFarmerId(providedFarmerId?: string): string {
    const storedFarmerId = localStorage.getItem('kale-pool-farmer-id');
    const farmerId = providedFarmerId || storedFarmerId;
    
    if (!farmerId) {
      throw new APIClientError(400, 'FARMER_ID_MISSING', 'No farmer ID found in local storage');
    }
    
    // If both exist, ensure they match (unless user has admin role)
    if (storedFarmerId && providedFarmerId && storedFarmerId !== providedFarmerId) {
      const userRole = localStorage.getItem('kale-pool-user-role');
      if (userRole !== 'admin') {
        throw new APIClientError(403, 'FORBIDDEN', 'You can only access your own farmer data');
      }
    }
    
    return farmerId;
  }

  async getFarmerSummary(farmerId?: string, window?: '24h' | '7d' | '30d' | 'all'): Promise<any> {
    const validatedFarmerId = this.validateAndGetFarmerId(farmerId);
    const params = window ? `?window=${window}` : '';
    return this.get<any>(`/farmers/${validatedFarmerId}/summary${params}`);
  }

  async getFarmerPlantings(farmerId?: string, filters?: {
    poolerId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    status?: 'success' | 'failed' | 'all';
  }): Promise<any> {
    const validatedFarmerId = this.validateAndGetFarmerId(farmerId);
    const params = new URLSearchParams();
    if (filters?.poolerId) params.append('poolerId', filters.poolerId);
    if (filters?.from) params.append('from', filters.from);
    if (filters?.to) params.append('to', filters.to);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.status) params.append('status', filters.status);
    
    const queryString = params.toString();
    return this.get<any>(`/farmers/${validatedFarmerId}/plantings${queryString ? `?${queryString}` : ''}`);
  }

  async getFarmerHarvests(farmerId?: string, filters?: {
    poolerId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    status?: 'success' | 'failed' | 'all';
  }): Promise<any> {
    const validatedFarmerId = this.validateAndGetFarmerId(farmerId);
    const params = new URLSearchParams();
    if (filters?.poolerId) params.append('poolerId', filters.poolerId);
    if (filters?.from) params.append('from', filters.from);
    if (filters?.to) params.append('to', filters.to);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.status) params.append('status', filters.status);
    
    const queryString = params.toString();
    return this.get<any>(`/farmers/${validatedFarmerId}/harvests${queryString ? `?${queryString}` : ''}`);
  }

  // ==================== Authentication APIs ====================

  // Get current user's info (authenticated endpoint)
  async getMe(): Promise<{
    user: {
      id: string;
      email: string;
      role: string;
      entityId: string | null;
      createdAt: string;
      lastLoginAt: string;
      permissions: string[];
      farmerId?: string;
      status?: string;
    }
  }> {
    return this.get('/auth/me');
  }

  // Get current farmer's data (authenticated endpoint)
  async getCurrentFarmer(): Promise<any> {
    // We don't need to check farmerId here since /farmers/current will handle that
    return this.get<any>(`/farmers/current`);
  }

  // Get current farmer's blockchain data (authenticated endpoint)
  async getFarmerBlockchainData(): Promise<any> {
    return this.get<any>('/farmers/blockchain-data');
  }

  async registerFarmer(email: string, password: string, externalWallet: string): Promise<any> {
    const response = await this.post<any>('/register-farmer', {
      email,
      password,
      externalWallet
    });
    
    // Store the token if registration is successful
    if (response.token) {
      localStorage.setItem('kale-pool-token', response.token);
    }
    
    return response;
  }

  async login(email: string, password: string): Promise<any> {
    const response = await this.post<any>('/auth/login', {
      email,
      password
    });
    
    // Store the token if login is successful
    if (response.token) {
      localStorage.setItem('kale-pool-token', response.token);
      
      // Get user details from /auth/me after successful login
      try {
        const userDetails = await this.getMe();
        if (userDetails.user) {
          const user = userDetails.user;
          // Store comprehensive user data
          localStorage.setItem('kale-pool-user-id', user.id);
          localStorage.setItem('kale-pool-user-email', user.email);
          localStorage.setItem('kale-pool-user-role', user.role.toLowerCase());
          
          // Store farmer-specific ID if user is a farmer and farmerId exists
          if (user.role.toLowerCase() === 'farmer' && user.farmerId) {
            localStorage.setItem('kale-pool-farmer-id', user.farmerId);
          }
          
          // Store user status if available
          if (user.status) {
            localStorage.setItem('kale-pool-user-status', user.status);
          }
        }
      } catch (error) {
        console.warn('Could not fetch user details after login:', error);
      }
    }
    
    return response;
  }

  async logout(): Promise<any> {
    try {
      const response = await this.post<any>('/auth/logout', {});
      // Clear local storage after successful logout
      this.clearLocalStorage();
      return response;
    } catch (error) {
      // Clear local storage even if logout fails
      this.clearLocalStorage();
      throw error;
    }
  }

  clearLocalStorage(): void {
    localStorage.removeItem('kale-pool-token');
    localStorage.removeItem('kale-pool-user-id');
    localStorage.removeItem('kale-pool-user-response');
    localStorage.removeItem('kale-pool-farmer-id');
    localStorage.removeItem('kale-pool-user-email');
    localStorage.removeItem('kale-pool-custodial-wallet');
    localStorage.removeItem('kale-pool-farmer-id');
    localStorage.removeItem('kale-pool-user-role');
    localStorage.removeItem('kale-pool-user-status');
  }

  getStoredToken(): string | null {
    return localStorage.getItem('kale-pool-token');
  }

  // Utility function to decode JWT token and get user ID
  getUserIdFromToken(): string | null {
    const token = this.getStoredToken();
    if (!token) return null;
    
    try {
      // Decode JWT token (without verification since it's just for getting the ID)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id || null;
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }

  // ==================== Contract APIs ====================

  async getFarmerActiveContract(farmerId?: string): Promise<any> {
    const validatedFarmerId = this.validateAndGetFarmerId(farmerId);
    return this.get<any>(`/contracts/farmers/${validatedFarmerId}/contracts/active`);
  }

  async getFarmerContracts(farmerId?: string, filters?: {
    status?: 'pending' | 'active' | 'exiting' | 'completed' | 'all';
    page?: number;
    limit?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (farmerId) params.append('farmerId', farmerId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    return this.get<any>(`/contracts?${params.toString()}`);
  }

  async getContractById(contractId: string): Promise<any> {
    return this.get<any>(`/contracts/${contractId}`);
  }

  async exitContract(contractId: string): Promise<any> {
    return this.post<any>(`/contracts/${contractId}/exit`, {});
  }

  // ==================== Wallet APIs ====================

  async getWalletBalance(address: string): Promise<any> {
    return this.get<any>(`/wallet/balance/${address}`);
  }

  async getMyWalletBalance(): Promise<any> {
    return this.get<any>('/wallet/my-balance');
  }

  async getWalletInfo(address: string): Promise<any> {
    return this.get<any>(`/wallet/info/${address}`);
  }

  async getXLMBalance(address: string): Promise<any> {
    return this.get<any>(`/wallet/xlm/${address}`);
  }

  // ==================== Pooler APIs ====================

  async getPoolers(userId?: string, filters?: FilterParams): Promise<PaginatedResponse<PoolerSummary>> {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.search) params.append('search', filters.search);

    const response = await this.get<any>(
      `/poolers?${params.toString()}`
    );
    
    // Transform the response to match PaginatedResponse interface
    return {
      data: response.items || [],
      pagination: {
        page: response.page || 1,
        limit: response.limit || 10,
        total: response.total || 0,
        totalPages: Math.ceil((response.total || 0) / (response.limit || 10))
      }
    };
  }

  async getPoolerDetails(poolerId: string, userId?: string): Promise<PoolerDetails> {
    const params = userId ? `?userId=${userId}` : '';
    return this.get<PoolerDetails>(`/pooler/${poolerId}/details${params}`);
  }

  async joinPool(data: JoinPoolRequest): Promise<JoinPoolResponse> {
    return this.post<JoinPoolResponse>('/join-pool', data);
  }

  async confirmJoin(data: ConfirmJoinRequest): Promise<ConfirmJoinResponse> {
    return this.post<ConfirmJoinResponse>('/confirm-pool-join', data);
  }

  // Pooler registration
  async registerPooler(data: any): Promise<any> {
    return this.post<any>('/registerPooler', data);
  }

  // ==================== Pooler Console APIs ====================

  async notifyBlockDiscovered(data: BlockDiscoveredEvent): Promise<BlockDiscoveredResponse> {
    return this.post<BlockDiscoveredResponse>('/pooler/block-discovered', data);
  }

  async getPoolerStatus(): Promise<PoolerStatusResponse> {
    // This endpoint lives on the Pooler service (port 3001)
    const endpoint = `${this.poolerBaseURL}/pooler/status`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      const body = await response.text();
      throw new APIClientError(response.status, 'HTTP_ERROR', body || 'Failed to fetch pooler status');
    }
    return response.json();
  }

  // Work completion notification from Pooler
  async notifyWorkCompleted(data: any): Promise<any> {
    return this.post<any>('/pooler/work-completed', data);
  }

  // ==================== Block Operation APIs ====================

  async plant(data: PlantRequest): Promise<PlantResponse> {
    return this.post<PlantResponse>('/plant', data);
  }

  async work(data: WorkRequest): Promise<WorkResponse> {
    return this.post<WorkResponse>('/work', data);
  }

  async harvest(data: HarvestRequest): Promise<HarvestResponse> {
    return this.post<HarvestResponse>('/harvest', data);
  }

  // ==================== Harvest Management APIs ====================

  async startHarvestService(): Promise<any> {
    return this.post<any>('/harvest/start');
  }

  async stopHarvestService(): Promise<any> {
    return this.post<any>('/harvest/stop');
  }

  async getHarvestStatus(): Promise<any> {
    return this.get<any>('/harvest/status');
  }

  async triggerHarvest(): Promise<any> {
    return this.post<any>('/harvest/trigger');
  }

  // ==================== Utility Methods ====================

  /**
   * Set base URL (useful for testing or environment changes)
   */
  setBaseURL(url: string): void {
    this.baseURL = url;
  }

  /**
   * Set pooler base URL (useful for testing or environment changes)
   */
  setPoolerBaseURL(url: string): void {
    this.poolerBaseURL = url;
  }

  /**
   * Get current base URL
   */
  getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * Get current pooler base URL
   */
  getPoolerBaseURL(): string {
    return this.poolerBaseURL;
  }
}

// Create and export singleton instance
export const apiClient = new APIClient();

// Export types for external use
export type { APIClientError as APIClientErrorType };

// Export the class for testing/custom instances
export { APIClient };
