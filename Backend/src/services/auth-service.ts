import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from './database';
import { backendLogger as logger } from '../../../Shared/utils/logger';
import { 
  AuthUser, 
  UserRole, 
  LoginRequest, 
  RegisterRequest, 
  LoginResponse, 
  JWTPayload,
  RefreshTokenRequest
} from '../types/auth-types';
import Config from '../../../Shared/config';

const JWT_SECRET = Config.BACKEND.JWT_SECRET;
const JWT_EXPIRES_IN = Config.BACKEND.JWT_EXPIRES_IN;
const REFRESH_TOKEN_EXPIRES_IN = Config.BACKEND.REFRESH_TOKEN_EXPIRES_IN;

export class AuthService {
  
  async register(request: RegisterRequest): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    try {
      const { email, password, role = UserRole.FARMER, entityId, externalWallet } = request;
      
      // Check if user already exists
      const existingUser = await this.getUserByEmail(email);
      if (existingUser) {
        return { success: false, error: 'User already exists with this email' };
      }
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Generate entity ID if not provided
      let finalEntityId = entityId;
      if (!entityId) {
        if (role === UserRole.FARMER) {
          // For farmers, we'll link to farmer record after creation
          finalEntityId = uuidv4();
        } else if (role === UserRole.POOLER) {
          // For poolers, we'll link to pooler record after creation
          finalEntityId = uuidv4();
        } else {
          // For admins, generate random UUID
          finalEntityId = uuidv4();
        }
      }
      
      // Create user
      const userId = uuidv4();
      await db.query(`
        INSERT INTO users (id, email, external_wallet, status, password_hash, role, entity_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        email,
        externalWallet || 'pending', // Use provided wallet or pending
        'registered',
        passwordHash,
        role,
        finalEntityId
      ]);
      
      // Get created user
      const user = await this.getUserById(userId);
      if (!user) {
        return { success: false, error: 'Failed to create user' };
      }
      
      logger.info(`User registered successfully: ${JSON.stringify({
        user_id: userId,
        email,
        role,
        entity_id: finalEntityId
      })}`);
      
      return { success: true, user };
      
    } catch (error) {
      logger.error('User registration failed', error as Error);
      return { success: false, error: 'Registration failed' };
    }
  }
  
  async login(request: LoginRequest): Promise<{ success: boolean; response?: LoginResponse; error?: string }> {
    try {
      const { email, password } = request;
      
      // Get user with password hash
      const result = await db.query(`
        SELECT id, email, password_hash, role, entity_id, created_at, last_login_at
        FROM users 
        WHERE email = $1 AND status = 'registered'
      `, [email]);
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Invalid credentials' };
      }
      
      const userRow = result.rows[0];
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, userRow.password_hash);
      if (!isValidPassword) {
        return { success: false, error: 'Invalid credentials' };
      }
      
      // Create user object
      const user: AuthUser = {
        id: userRow.id,
        email: userRow.email,
        role: userRow.role,
        entityId: userRow.entity_id,
        createdAt: userRow.created_at,
        lastLoginAt: userRow.last_login_at
      };
      
      // Generate tokens
      const token = this.generateAccessToken(user);
      const refreshToken = await this.generateRefreshToken(user.id);
      
      // Update last login
      await db.query(`
        UPDATE users SET last_login_at = NOW() WHERE id = $1
      `, [user.id]);
      
      const response: LoginResponse = {
        token,
        refreshToken,
        user,
        expiresIn: JWT_EXPIRES_IN
      };
      
      logger.info(`User logged in successfully: ${JSON.stringify({
        user_id: user.id,
        email: user.email,
        role: user.role
      })}`);
      
      return { success: true, response };
      
    } catch (error) {
      logger.error('User login failed', error as Error);
      return { success: false, error: 'Login failed' };
    }
  }
  
  async refreshAccessToken(request: RefreshTokenRequest): Promise<{ success: boolean; token?: string; expiresIn?: number; error?: string }> {
    try {
      const { refreshToken } = request;
      
      // Hash the refresh token to find it in database
      const tokenHash = this.hashToken(refreshToken);
      
      // Find valid refresh token
      const result = await db.query(`
        SELECT rt.user_id, u.email, u.role, u.entity_id, u.created_at, u.last_login_at
        FROM refresh_tokens rt
        JOIN users u ON rt.user_id = u.id
        WHERE rt.token_hash = $1 
          AND rt.expires_at > NOW() 
          AND rt.revoked_at IS NULL
          AND u.status = 'registered'
      `, [tokenHash]);
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Invalid or expired refresh token' };
      }
      
      const userRow = result.rows[0];
      const user: AuthUser = {
        id: userRow.user_id,
        email: userRow.email,
        role: userRow.role,
        entityId: userRow.entity_id,
        createdAt: userRow.created_at,
        lastLoginAt: userRow.last_login_at
      };
      
      // Generate new access token
      const token = this.generateAccessToken(user);
      
      logger.info(`Access token refreshed: ${JSON.stringify({
        user_id: user.id,
        email: user.email
      })}`);
      
      return { 
        success: true, 
        token, 
        expiresIn: JWT_EXPIRES_IN 
      };
      
    } catch (error) {
      logger.error('Token refresh failed', error as Error);
      return { success: false, error: 'Token refresh failed' };
    }
  }
  
  async logout(userId: string, refreshToken?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (refreshToken) {
        // Revoke specific refresh token
        const tokenHash = this.hashToken(refreshToken);
        await db.query(`
          UPDATE refresh_tokens 
          SET revoked_at = NOW() 
          WHERE user_id = $1 AND token_hash = $2
        `, [userId, tokenHash]);
      } else {
        // Revoke all refresh tokens for user
        await db.query(`
          UPDATE refresh_tokens 
          SET revoked_at = NOW() 
          WHERE user_id = $1 AND revoked_at IS NULL
        `, [userId]);
      }
      
      logger.info(`User logged out: ${JSON.stringify({ user_id: userId })}`);
      return { success: true };
      
    } catch (error) {
      logger.error('Logout failed', error as Error);
      return { success: false, error: 'Logout failed' };
    }
  }
  
  async verifyToken(token: string): Promise<{ valid: boolean; user?: AuthUser; error?: string }> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      
      // Get current user data
      const user = await this.getUserById(decoded.userId);
      if (!user) {
        return { valid: false, error: 'User not found' };
      }
      
      return { valid: true, user };
      
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, error: 'Token expired' };
      } else if (error instanceof jwt.JsonWebTokenError) {
        return { valid: false, error: 'Invalid token' };
      }
      
      logger.error('Token verification failed', error as Error);
      return { valid: false, error: 'Token verification failed' };
    }
  }
  
  private generateAccessToken(user: AuthUser): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      entityId: user.entityId
    };
    
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });
  }
  
  private async generateRefreshToken(userId: string): Promise<string> {
    const refreshToken = uuidv4();
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN * 1000);
    
    // Store refresh token in database
    await db.query(`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `, [userId, tokenHash, expiresAt]);
    
    return refreshToken;
  }
  
  private hashToken(token: string): string {
    return bcrypt.hashSync(token, 10);
  }
  
  private async getUserById(id: string): Promise<AuthUser | null> {
    try {
      const result = await db.query(`
        SELECT id, email, role, entity_id, created_at, last_login_at
        FROM users 
        WHERE id = $1 AND status = 'registered'
      `, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        email: row.email,
        role: row.role,
        entityId: row.entity_id,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at
      };
      
    } catch (error) {
      logger.error('Get user by ID failed', error as Error);
      return null;
    }
  }
  
  private async getUserByEmail(email: string): Promise<AuthUser | null> {
    try {
      const result = await db.query(`
        SELECT id, email, role, entity_id, created_at, last_login_at
        FROM users 
        WHERE email = $1 AND status = 'registered'
      `, [email]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        email: row.email,
        role: row.role,
        entityId: row.entity_id,
        createdAt: row.created_at,
        lastLoginAt: row.last_login_at
      };
      
    } catch (error) {
      logger.error('Get user by email failed', error as Error);
      return null;
    }
  }
  
  // Permission checking methods
  canAccessResource(user: AuthUser, resource: string, action: 'read' | 'write' | 'delete', resourceId?: string): boolean {
    // Admin has full access
    if (user.role === UserRole.ADMIN) {
      return true;
    }
    
    // Role-based access control logic
    switch (resource) {
      case 'poolers':
        if (action === 'read') return true; // Public read access
        if (user.role === UserRole.POOLER && resourceId === user.entityId) return true;
        return false;
        
      case 'farmers':
        if (user.role === UserRole.FARMER && resourceId === user.entityId) return true;
        if (user.role === UserRole.POOLER) return action === 'read'; // Poolers can read farmer data
        return false;
        
      case 'contracts':
        if (user.role === UserRole.FARMER && action === 'read') {
          // Farmers can read their own contracts
          return true;
        }
        if (user.role === UserRole.POOLER) {
          // Poolers can read contracts for their pool
          return action === 'read';
        }
        return false;
        
      default:
        return false;
    }
  }
}

export const authService = new AuthService();