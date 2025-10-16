-- init-scripts/01-create-databases.sql
-- This script creates separate databases for each service

-- Create databases for each microservice
CREATE DATABASE api_gateway_db;
CREATE DATABASE resilience_db;
CREATE DATABASE elca_db;
CREATE DATABASE lcc_db;
CREATE DATABASE slca_db;
CREATE DATABASE human_centricity_db;
CREATE DATABASE sustainability_db;
CREATE DATABASE recommendation_db;

-- Create users for each service with appropriate permissions
CREATE USER api_gateway_user WITH PASSWORD 'api_gateway_password';
CREATE USER recommendation_user WITH PASSWORD 'recommendation_password';
CREATE USER resilience_user WITH PASSWORD 'resilience_password';
CREATE USER sustainability_user WITH PASSWORD 'sustainability_password';
CREATE USER elca_user WITH PASSWORD 'elca_password';
CREATE USER lcc_user WITH PASSWORD 'lcc_password';
CREATE USER slca_user WITH PASSWORD 'slca_password';
CREATE USER human_centricity_user WITH PASSWORD 'human_centricity_password';

-- Grant all privileges on respective databases to users
GRANT ALL PRIVILEGES ON DATABASE recommendation_db TO recommendation_user;
GRANT ALL PRIVILEGES ON DATABASE api_gateway_db TO api_gateway_user;
GRANT ALL PRIVILEGES ON DATABASE resilience_db TO resilience_user;
GRANT ALL PRIVILEGES ON DATABASE sustainability_db TO sustainability_user;
GRANT ALL PRIVILEGES ON DATABASE elca_db TO elca_user;
GRANT ALL PRIVILEGES ON DATABASE lcc_db TO lcc_user;
GRANT ALL PRIVILEGES ON DATABASE slca_db TO slca_user;
GRANT ALL PRIVILEGES ON DATABASE human_centricity_db TO human_centricity_user;

-- Connect to each database and grant schema permissions
\c api_gateway_db;
GRANT ALL ON SCHEMA public TO api_gateway_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO api_gateway_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO api_gateway_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO api_gateway_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO api_gateway_user;

\c resilience_db;
GRANT ALL ON SCHEMA public TO resilience_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO resilience_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO resilience_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO resilience_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO resilience_user;

\c elca_db;
GRANT ALL ON SCHEMA public TO elca_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO elca_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO elca_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO elca_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO elca_user;

\c lcc_db;
GRANT ALL ON SCHEMA public TO lcc_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lcc_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lcc_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO lcc_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO lcc_user;

\c slca_db;
GRANT ALL ON SCHEMA public TO slca_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO slca_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO slca_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO slca_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO slca_user;

\c human_centricity_db;
GRANT ALL ON SCHEMA public TO human_centricity_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO human_centricity_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO human_centricity_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO human_centricity_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO human_centricity_user;

\c sustainability_db;
GRANT ALL ON SCHEMA public TO sustainability_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sustainability_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sustainability_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sustainability_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sustainability_user;

\c recommendation_db;
GRANT ALL ON SCHEMA public TO recommendation_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO recommendation_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO recommendation_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO recommendation_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO recommendation_user;