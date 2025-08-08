-- init-scripts/03-services-schemas.sql
-- Schemas for all microservices

-- =====================================================
-- RESILIENCE SERVICE SCHEMA
-- =====================================================
\c resilience_db;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Resilience assessments table
CREATE TABLE resilience_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL, -- Reference to main assessment
    input_data JSONB NOT NULL,
    resilience_score DECIMAL(5,2),
    sub_scores JSONB, -- Store breakdown of resilience components
    recommendations TEXT[],
    status VARCHAR(50) DEFAULT 'processing',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_resilience_assessment_id ON resilience_assessments(assessment_id);
CREATE INDEX idx_resilience_status ON resilience_assessments(status);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO resilience_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO resilience_user;

