-- init-scripts/99-verify-setup.sql
-- Verification script to ensure all databases and users are properly configured

-- Connect to each database and verify setup
\echo 'Verifying database setup...'

-- Verify main database
\c digital_twin_system;
\echo 'Connected to digital_twin_system database'
SELECT current_database(), current_user;

-- Verify API Gateway database
\c api_gateway_db;
\echo 'Connected to api_gateway_db database'
SELECT current_database(), current_user;
\dt
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';

-- Verify Resilience database
\c resilience_db;
\echo 'Connected to resilience_db database'
SELECT current_database(), current_user;
\dt
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';

-- Verify ELCA database
\c elca_db;
\echo 'Connected to elca_db database'
SELECT current_database(), current_user;
\dt
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';
SELECT COUNT(*) as impact_categories_count FROM impact_categories;

-- Verify LCC database
\c lcc_db;
\echo 'Connected to lcc_db database'
SELECT current_database(), current_user;
\dt
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';
SELECT COUNT(*) as cost_categories_count FROM cost_categories;

-- Verify SLCA database
\c slca_db;
\echo 'Connected to slca_db database'
SELECT current_database(), current_user;
\dt
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';
SELECT COUNT(*) as social_categories_count FROM social_categories;

-- Verify Human Centricity database
\c human_centricity_db;
\echo 'Connected to human_centricity_db database'
SELECT current_database(), current_user;
\dt
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';
SELECT COUNT(*) as hc_dimensions_count FROM hc_dimensions;

-- Back to main database for final summary
\c digital_twin_system;
\echo 'Database setup verification completed!'
\echo 'All databases and users should now be properly configured.'

-- List all databases
SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;

-- List all users
SELECT usename FROM pg_user ORDER BY usename;