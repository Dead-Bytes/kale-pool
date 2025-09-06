/**
 * React Query hooks for KALE Pool API
 * Provides caching, background updates, and optimistic UI capabilities
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { apiClient, APIClientError } from '@/lib/api-client';
import {
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

// Query Keys
export const queryKeys = {
  health: ['health'] as const,
  info: ['info'] as const,
  userStatus: (userId: string) => ['userStatus', userId] as const,
  poolers: (userId?: string, filters?: FilterParams) => ['poolers', userId, filters] as const,
  poolerDetails: (poolerId: string, userId?: string) => ['poolerDetails', poolerId, userId] as const,
  poolerStatus: ['poolerStatus'] as const,
  checkFunding: (userId: string) => ['checkFunding', userId] as const,
};

// ==================== Health & Info Hooks ====================

export function useHealth(options?: UseQueryOptions<HealthResponse, APIClientError>) {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => apiClient.getHealth(),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
    ...options,
  });
}

export function useInfo(options?: UseQueryOptions<InfoResponse, APIClientError>) {
  return useQuery({
    queryKey: queryKeys.info,
    queryFn: () => apiClient.getInfo(),
    staleTime: 300000, // 5 minutes
    ...options,
  });
}

// ==================== Registration Hooks ====================

export function useRegisterUser(
  options?: UseMutationOptions<RegisterUserResponse, APIClientError, RegisterUserRequest>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: RegisterUserRequest) => apiClient.registerUser(data),
    onSuccess: (data) => {
      // Cache the user status
      queryClient.setQueryData(
        queryKeys.userStatus(data.userId),
        {
          user: {
            userId: data.userId,
            status: 'pending',
            custodialWallet: data.custodialWallet.publicKey,
          },
          funding: {
            required: data.fundingRequired,
            current: 0,
            funded: false,
          },
        }
      );
    },
    ...options,
  });
}

export function useLogout(
  options?: UseMutationOptions<any, APIClientError, void>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => apiClient.logout(),
    onSuccess: () => {
      // Clear all cached data on logout
      queryClient.clear();
    },
    ...options,
  });
}

export function useCheckFunding(
  userId: string,
  options?: UseQueryOptions<CheckFundingResponse, APIClientError>
) {
  return useQuery({
    queryKey: queryKeys.checkFunding(userId),
    queryFn: () => apiClient.checkFunding({ userId }),
    enabled: !!userId,
    refetchInterval: (query) => {
      // Stop polling if funded
      return query.state.data?.funded ? false : 5000; // 5 seconds
    },
    ...options,
  });
}

export function useUserStatus(
  userId: string,
  options?: UseQueryOptions<UserStatusResponse, APIClientError>
) {
  return useQuery({
    queryKey: queryKeys.userStatus(userId),
    queryFn: () => apiClient.getUserStatus(userId),
    enabled: !!userId,
    staleTime: 60000, // 1 minute
    ...options,
  });
}

// ==================== Pooler Hooks ====================

export function usePoolers(
  userId?: string,
  filters?: FilterParams,
  options?: UseQueryOptions<PaginatedResponse<PoolerSummary>, APIClientError>
) {
  return useQuery({
    queryKey: queryKeys.poolers(userId, filters),
    queryFn: () => apiClient.getPoolers(userId, filters),
    staleTime: 30000, // 30 seconds
    ...options,
  });
}

export function usePoolerDetails(
  poolerId: string,
  userId?: string,
  options?: UseQueryOptions<PoolerDetails, APIClientError>
) {
  return useQuery({
    queryKey: queryKeys.poolerDetails(poolerId, userId),
    queryFn: () => apiClient.getPoolerDetails(poolerId, userId),
    enabled: !!poolerId,
    staleTime: 60000, // 1 minute
    ...options,
  });
}

export function useJoinPool(
  options?: UseMutationOptions<JoinPoolResponse, APIClientError, JoinPoolRequest>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: JoinPoolRequest) => apiClient.joinPool(data),
    onSuccess: (data, variables) => {
      // Invalidate user status and pooler details
      queryClient.invalidateQueries({ queryKey: queryKeys.userStatus(variables.userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.poolerDetails(variables.poolerId) });
    },
    ...options,
  });
}

export function useConfirmJoin(
  options?: UseMutationOptions<ConfirmJoinResponse, APIClientError, ConfirmJoinRequest>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ConfirmJoinRequest) => apiClient.confirmJoin(data),
    onSuccess: () => {
      // Invalidate all user-related queries
      queryClient.invalidateQueries({ queryKey: ['userStatus'] });
      queryClient.invalidateQueries({ queryKey: ['poolers'] });
    },
    ...options,
  });
}

// ==================== Pooler Console Hooks ====================

export function useNotifyBlockDiscovered(
  options?: UseMutationOptions<BlockDiscoveredResponse, APIClientError, BlockDiscoveredEvent>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BlockDiscoveredEvent) => apiClient.notifyBlockDiscovered(data),
    onSuccess: () => {
      // Refresh pooler status
      queryClient.invalidateQueries({ queryKey: queryKeys.poolerStatus });
    },
    ...options,
  });
}

export function usePoolerStatus(
  options?: UseQueryOptions<PoolerStatusResponse, APIClientError>
) {
  return useQuery({
    queryKey: queryKeys.poolerStatus,
    queryFn: () => apiClient.getPoolerStatus(),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
    ...options,
  });
}

// ==================== Block Operation Hooks ====================

export function usePlant(
  options?: UseMutationOptions<PlantResponse, APIClientError, PlantRequest>
) {
  return useMutation({
    mutationFn: (data: PlantRequest) => apiClient.plant(data),
    ...options,
  });
}

export function useWork(
  options?: UseMutationOptions<WorkResponse, APIClientError, WorkRequest>
) {
  return useMutation({
    mutationFn: (data: WorkRequest) => apiClient.work(data),
    ...options,
  });
}

export function useHarvest(
  options?: UseMutationOptions<HarvestResponse, APIClientError, HarvestRequest>
) {
  return useMutation({
    mutationFn: (data: HarvestRequest) => apiClient.harvest(data),
    ...options,
  });
}

// ==================== Utility Hooks ====================

// ==================== Authentication Hooks ====================

export function useCurrentUser(options?: UseQueryOptions<any, APIClientError>) {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: () => apiClient.getMe(),
    staleTime: 30000,
    ...options,
  });
}

// ==================== Farmer Analytics Hooks ====================

export function useCurrentFarmer(options?: UseQueryOptions<any, APIClientError>) {
  return useQuery({
    queryKey: ['current-farmer'],
    queryFn: () => apiClient.getCurrentFarmer(),
    staleTime: 30000,
    ...options,
  });
}

export function useFarmerBlockchainData(options?: UseQueryOptions<any, APIClientError>) {
  return useQuery({
    queryKey: ['farmer-blockchain-data'],
    queryFn: () => apiClient.getFarmerBlockchainData(),
    staleTime: 10000, // 10 seconds - blockchain data changes frequently
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    ...options,
  });
}

export function useFarmerSummary(farmerId?: string, window?: '24h' | '7d' | '30d' | 'all', options?: UseQueryOptions<any, APIClientError>) {
  return useQuery({
    queryKey: ['farmer-summary', farmerId, window],
    queryFn: () => apiClient.getFarmerSummary(farmerId, window),
    enabled: !!farmerId,
    staleTime: 30000,
    ...options,
  });
}

export function useFarmerPlantings(farmerId?: string, filters?: {
  poolerId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  status?: 'success' | 'failed' | 'all';
}, options?: UseQueryOptions<any, APIClientError>) {
  return useQuery({
    queryKey: ['farmer-plantings', farmerId, filters],
    queryFn: () => apiClient.getFarmerPlantings(farmerId, filters),
    enabled: !!farmerId,
    staleTime: 30000,
    ...options,
  });
}

export function useFarmerHarvests(farmerId?: string, filters?: {
  poolerId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  status?: 'success' | 'failed' | 'all';
}, options?: UseQueryOptions<any, APIClientError>) {
  return useQuery({
    queryKey: ['farmer-harvests', farmerId, filters],
    queryFn: () => apiClient.getFarmerHarvests(farmerId, filters),
    enabled: !!farmerId,
    staleTime: 30000,
    ...options,
  });
}

// ==================== Contract Hooks ====================

export function useFarmerActiveContract(farmerId: string, options?: UseQueryOptions<any, APIClientError>) {
  return useQuery({
    queryKey: ['farmer-active-contract', farmerId],
    queryFn: () => apiClient.getFarmerActiveContract(farmerId),
    enabled: !!farmerId,
    staleTime: 30000,
    ...options,
  });
}

export function useFarmerContracts(farmerId?: string, filters?: {
  status?: 'pending' | 'active' | 'exiting' | 'completed' | 'all';
  page?: number;
  limit?: number;
}, options?: UseQueryOptions<any, APIClientError>) {
  return useQuery({
    queryKey: ['farmer-contracts', farmerId, filters],
    queryFn: () => apiClient.getFarmerContracts(farmerId, filters),
    enabled: !!farmerId,
    staleTime: 30000,
    ...options,
  });
}

export function useContractById(contractId?: string, options?: UseQueryOptions<any, APIClientError>) {
  return useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => apiClient.getContractById(contractId!),
    enabled: !!contractId,
    staleTime: 30000,
    ...options,
  });
}

export function useExitContract(
  options?: UseMutationOptions<any, APIClientError, string>
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (contractId: string) => apiClient.exitContract(contractId),
    onSuccess: () => {
      // Invalidate contract-related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['farmer-active-contract'] });
      queryClient.invalidateQueries({ queryKey: ['farmer-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract'] });
    },
    ...options,
  });
}

// ==================== Wallet Hooks ====================

export function useWalletBalance(address?: string, options?: UseQueryOptions<any, APIClientError>) {
  return useQuery({
    queryKey: ['wallet-balance', address],
    queryFn: () => apiClient.getWalletBalance(address!),
    enabled: !!address,
    staleTime: 10000, // 10 seconds - wallet balances change frequently
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    ...options,
  });
}

export function useMyWalletBalance(options?: UseQueryOptions<any, APIClientError>) {
  return useQuery({
    queryKey: ['my-wallet-balance'],
    queryFn: () => apiClient.getMyWalletBalance(),
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    ...options,
  });
}

export function useWalletInfo(address?: string, options?: UseQueryOptions<any, APIClientError>) {
  return useQuery({
    queryKey: ['wallet-info', address],
    queryFn: () => apiClient.getWalletInfo(address!),
    enabled: !!address,
    staleTime: 60000, // 1 minute
    ...options,
  });
}

export function useXLMBalance(address?: string, options?: UseQueryOptions<any, APIClientError>) {
  return useQuery({
    queryKey: ['xlm-balance', address],
    queryFn: () => apiClient.getXLMBalance(address!),
    enabled: !!address,
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    ...options,
  });
}

/**
 * Hook for optimistic updates
 */
export function useOptimisticUpdate() {
  const queryClient = useQueryClient();

  return {
    updateData: <T>(queryKey: readonly unknown[], updater: (old: T | undefined) => T) => {
      queryClient.setQueryData(queryKey, updater);
    },
    invalidate: (queryKey: readonly unknown[]) => {
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

/**
 * Hook for prefetching data
 */
export function usePrefetch() {
  const queryClient = useQueryClient();

  return {
    prefetchPoolers: (userId?: string, filters?: FilterParams) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.poolers(userId, filters),
        queryFn: () => apiClient.getPoolers(userId, filters),
        staleTime: 30000,
      });
    },
    prefetchPoolerDetails: (poolerId: string, userId?: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.poolerDetails(poolerId, userId),
        queryFn: () => apiClient.getPoolerDetails(poolerId, userId),
        staleTime: 60000,
      });
    },
  };
}
