-- init-scripts/02-create-auth-tables.sql
-- This script creates the authentication tables in the api_gateway_db

-- Connect to the api_gateway database
\c api_gateway_db;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    oauth_provider VARCHAR(50),
    oauth_id VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    meta_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    token_id VARCHAR(255) UNIQUE NOT NULL DEFAULT uuid_generate_v4()::text,
    user_id VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    device_info VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_is_revoked ON refresh_tokens(is_revoked);

-- Add foreign key constraint
ALTER TABLE refresh_tokens 
ADD CONSTRAINT fk_refresh_tokens_user_id 
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- Create trigger to update updated_at column automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE PROCEDURE update_updated_at_column();

-- Create a cleanup function for expired refresh tokens
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP 
    OR is_revoked = TRUE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Insert default admin user (password is 'admin123!' hashed with bcrypt)
-- Note: Change this password immediately in production!
INSERT INTO users (
    user_id, 
    email, 
    username, 
    hashed_password, 
    first_name, 
    last_name, 
    role, 
    is_active, 
    is_verified
) VALUES (
    uuid_generate_v4()::text,
    'admin@digitaltwin.local',
    'admin',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewD5Q1YiB7uPIAb6', -- admin123!
    'System',
    'Administrator',
    'admin',
    TRUE,
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- Create a view for user information without sensitive data
CREATE OR REPLACE VIEW user_profile AS
SELECT 
    user_id,
    email,
    username,
    first_name,
    last_name,
    role,
    is_active,
    is_verified,
    created_at,
    updated_at,
    last_login
FROM users;

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO api_gateway_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_tokens TO api_gateway_user;
GRANT SELECT ON user_profile TO api_gateway_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO api_gateway_user;

-- Grant execute permission on functions
GRANT EXECUTE ON FUNCTION cleanup_expired_refresh_tokens() TO api_gateway_user;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO api_gateway_user;

-- Add some useful comments
COMMENT ON TABLE users IS 'User accounts for authentication and authorization';
COMMENT ON TABLE refresh_tokens IS 'Refresh tokens for JWT authentication';
COMMENT ON COLUMN users.user_id IS 'Unique identifier for the user (UUID)';
COMMENT ON COLUMN users.hashed_password IS 'Bcrypt hashed password';
COMMENT ON COLUMN users.meta_data IS 'Additional user metadata as JSON';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA256 hash of the refresh token';
COMMENT ON FUNCTION cleanup_expired_refresh_tokens() IS 'Removes expired and revoked refresh tokens';

-- Print completion message
DO $$
BEGIN
    RAISE NOTICE 'Authentication tables created successfully in api_gateway_db';
    RAISE NOTICE 'Default admin user created with email: admin@digitaltwin.local';
    RAISE NOTICE 'IMPORTANT: Change the default admin password immediately in production!';
END $$;