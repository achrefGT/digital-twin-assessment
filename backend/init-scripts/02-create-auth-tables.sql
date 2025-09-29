-- init-scripts/02-create-auth-tables.sql
-- This script creates the authentication tables in the api_gateway_db

-- Connect to the api_gateway database
\c api_gateway_db;

-- Enable UUID extension and pgcrypto for proper bcrypt hashing
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

-- Create admin user management function (for use by FastAPI)
CREATE OR REPLACE FUNCTION create_admin_with_hash(
    p_email VARCHAR(255),
    p_username VARCHAR(255), 
    p_password_hash VARCHAR(255),
    p_first_name VARCHAR(100) DEFAULT 'System',
    p_last_name VARCHAR(100) DEFAULT 'Administrator'
)
RETURNS TABLE(success BOOLEAN, user_id VARCHAR(255), message TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id VARCHAR(255);
    v_existing_user_id VARCHAR(255);
    v_action TEXT;
BEGIN
    -- Check if user already exists
    SELECT users.user_id INTO v_existing_user_id
    FROM users 
    WHERE users.email = p_email OR users.username = p_username;
    
    IF v_existing_user_id IS NOT NULL THEN
        -- Update existing user
        UPDATE users 
        SET hashed_password = p_password_hash,
            updated_at = CURRENT_TIMESTAMP,
            is_active = TRUE,
            is_verified = TRUE,
            role = 'admin'
        WHERE users.user_id = v_existing_user_id;
        
        v_user_id := v_existing_user_id;
        v_action := 'updated';
    ELSE
        -- Create new user
        v_user_id := uuid_generate_v4()::text;
        
        INSERT INTO users (
            user_id, email, username, hashed_password,
            first_name, last_name, role, is_active, is_verified
        ) VALUES (
            v_user_id, p_email, p_username, p_password_hash,
            p_first_name, p_last_name, 'admin', TRUE, TRUE
        );
        
        v_action := 'created';
    END IF;
    
    RETURN QUERY SELECT 
        TRUE,
        v_user_id,
        format('Admin user %s successfully', v_action);
        
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 
            FALSE,
            NULL::VARCHAR(255),
            format('Error: %s', SQLERRM);
END;
$$;

-- Create password verification function
CREATE OR REPLACE FUNCTION verify_user_password(
    p_identifier VARCHAR(255), -- email or username
    p_password VARCHAR(255)
)
RETURNS TABLE(
    is_valid BOOLEAN,
    user_id VARCHAR(255),
    email VARCHAR(255),
    username VARCHAR(255),
    role VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_user RECORD;
BEGIN
    -- Find user by email or username
    SELECT u.user_id, u.email, u.username, u.hashed_password, u.role, u.is_active
    INTO v_user
    FROM users u
    WHERE u.email = p_identifier OR u.username = p_identifier;
    
    IF v_user.user_id IS NULL THEN
        -- User not found
        RETURN QUERY SELECT FALSE, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;
    
    IF NOT v_user.is_active THEN
        -- User is inactive
        RETURN QUERY SELECT FALSE, v_user.user_id, v_user.email, v_user.username, v_user.role;
        RETURN;
    END IF;
    
    -- Verify password using crypt (for passwords hashed with pgcrypto)
    IF crypt(p_password, v_user.hashed_password) = v_user.hashed_password THEN
        -- Password is correct
        RETURN QUERY SELECT TRUE, v_user.user_id, v_user.email, v_user.username, v_user.role;
    ELSE
        -- Password is incorrect
        RETURN QUERY SELECT FALSE, v_user.user_id, v_user.email, v_user.username, v_user.role;
    END IF;
END;
$$;

-- Function to update user's last login timestamp
CREATE OR REPLACE FUNCTION update_last_login(p_user_id VARCHAR(255))
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE users 
    SET last_login = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id;
    
    RETURN FOUND;
END;
$$;


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
GRANT EXECUTE ON FUNCTION create_admin_with_hash(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR) TO api_gateway_user;
GRANT EXECUTE ON FUNCTION verify_user_password(VARCHAR, VARCHAR) TO api_gateway_user;
GRANT EXECUTE ON FUNCTION update_last_login(VARCHAR) TO api_gateway_user;

-- Add some useful comments
COMMENT ON TABLE users IS 'User accounts for authentication and authorization';
COMMENT ON TABLE refresh_tokens IS 'Refresh tokens for JWT authentication';
COMMENT ON COLUMN users.user_id IS 'Unique identifier for the user (UUID)';
COMMENT ON COLUMN users.hashed_password IS 'Bcrypt hashed password';
COMMENT ON COLUMN users.meta_data IS 'Additional user metadata as JSON';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA256 hash of the refresh token';
COMMENT ON FUNCTION cleanup_expired_refresh_tokens() IS 'Removes expired and revoked refresh tokens';
COMMENT ON FUNCTION create_admin_with_hash IS 'Creates or updates admin user with bcrypt hash from FastAPI';
COMMENT ON FUNCTION verify_user_password IS 'Verifies user password for authentication';
COMMENT ON FUNCTION update_last_login IS 'Updates user last login timestamp';

-- Print completion message
DO $$
BEGIN
    RAISE NOTICE 'Authentication tables and functions created successfully in api_gateway_db';
    RAISE NOTICE 'Admin user will be created by FastAPI application on startup';
    RAISE NOTICE 'Check FastAPI logs for admin credentials after container starts';
END $$;