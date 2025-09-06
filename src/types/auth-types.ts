export enum UserRole {
  ADMIN = 'admin',
  POOLER = 'pooler',
  FARMER = 'farmer'
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  entityId: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role?: UserRole;
  entityId?: string;
  externalWallet?: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: AuthUser;
  expiresIn: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  entityId: string;
  iat: number;
  exp: number;
}

export interface AuthMiddlewareLocals {
  user: AuthUser;
}

export interface PermissionCheck {
  resource: string;
  action: 'read' | 'write' | 'delete';
  resourceId?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  path: string;
}