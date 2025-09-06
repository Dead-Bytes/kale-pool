# Database Migrations

This directory contains SQL migration files for the KALE Pool database schema.

## Migration Files

### 001_initial.sql
- Initial database schema with core entities
- Creates tables: poolers, farmers, plantings, works, harvests, block_operations, pooler_compensations
- Sets up indexes and triggers

### 002_add_user_auth_fields.sql
- Adds authentication fields to existing users table
- Adds columns: password_hash, role, entity_id
- Creates indexes for new fields
- Adds constraints for role validation

### 003_complete_user_auth_system.sql
- Complete user authentication system migration
- Creates users table if it doesn't exist
- Adds user_id column to farmers table
- Sets up all foreign key relationships
- Comprehensive documentation

### 004_add_last_login_at.sql
- Adds last_login_at column to users table
- Tracks when users last logged in
- Creates index for performance
- Updates schema documentation

### 005_add_refresh_tokens_table.sql
- Creates refresh_tokens table for JWT refresh token management
- Stores hashed refresh tokens with expiration tracking
- Includes revocation support for security
- Creates comprehensive indexes for performance

### 006_add_farmer_last_exit_at.sql
- Adds last_exit_at column to farmers table
- Tracks when farmers last exited from a pool
- Creates index for performance
- Updates schema documentation

### 007_add_farmer_exit_count.sql
- Adds exit_count column to farmers table
- Tracks how many times a farmer has exited from pools
- Creates index for performance
- Updates schema documentation

## Running Migrations

### For Development
```bash
# Apply all migrations in order
psql -d kale_pool_mainnet -f Shared/database/migrations/001_initial.sql
psql -d kale_pool_mainnet -f Shared/database/migrations/002_add_user_auth_fields.sql
psql -d kale_pool_mainnet -f Shared/database/migrations/003_complete_user_auth_system.sql
psql -d kale_pool_mainnet -f Shared/database/migrations/004_add_last_login_at.sql
psql -d kale_pool_mainnet -f Shared/database/migrations/005_add_refresh_tokens_table.sql
psql -d kale_pool_mainnet -f Shared/database/migrations/006_add_farmer_last_exit_at.sql
psql -d kale_pool_mainnet -f Shared/database/migrations/007_add_farmer_exit_count.sql
```

### For Production
```bash
# Apply migrations in order with error handling
psql -d kale_pool_production -f Shared/database/migrations/001_initial.sql
psql -d kale_pool_production -f Shared/database/migrations/002_add_user_auth_fields.sql
psql -d kale_pool_production -f Shared/database/migrations/003_complete_user_auth_system.sql
psql -d kale_pool_production -f Shared/database/migrations/004_add_last_login_at.sql
psql -d kale_pool_production -f Shared/database/migrations/005_add_refresh_tokens_table.sql
psql -d kale_pool_production -f Shared/database/migrations/006_add_farmer_last_exit_at.sql
psql -d kale_pool_production -f Shared/database/migrations/007_add_farmer_exit_count.sql
```

## Schema Files

- `schema.sql` - Complete current schema (updated with all migrations)
- `complete-schema.sql` - Alternative complete schema file

## Notes

- All migrations use `IF NOT EXISTS` and `IF EXISTS` clauses for safety
- Migrations are designed to be idempotent (can be run multiple times safely)
- Foreign key constraints are added with proper error handling
- All new columns have appropriate defaults and constraints
