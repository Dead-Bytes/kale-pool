-- Migration 001: Initial KALE Pool Mining Schema
-- Created: 2025-01-25
-- Description: Creates complete database schema for Phase 1 implementation

\i '../schema.sql'

-- Insert sample pooler for development/testing
INSERT INTO poolers (
    id,
    name,
    public_key,
    api_key,
    api_endpoint,
    max_farmers,
    is_active
) VALUES (
    uuid_generate_v4(),
    'Development Pooler',
    'GBQHTQ7NTSKHVTSVM6EHUO3TU4P4BK2TAAII25V2TT2Q6OWXUJWEKALE',
    'dev-api-key-for-testing-only',
    'http://localhost:3001',
    50,
    true
) ON CONFLICT DO NOTHING;

-- Migration complete
SELECT 'Migration 001 completed successfully' AS status;