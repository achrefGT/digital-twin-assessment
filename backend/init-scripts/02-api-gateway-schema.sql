-- init-scripts/02-api-gateway-schema.sql
-- Schema for API Gateway service

\c api_gateway_db;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create assessments table to track assessment requests
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- Create assessment_results table to store final aggregated results
CREATE TABLE assessment_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    resilience_score DECIMAL(5,2),
    elca_score DECIMAL(5,2),
    lcc_score DECIMAL(5,2),
    slca_score DECIMAL(5,2),
    human_centricity_score DECIMAL(5,2),
    overall_score DECIMAL(5,2),
    recommendations TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Create assessment_submissions table to track what was submitted to each service
CREATE TABLE assessment_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL,
    submission_data JSONB NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    kafka_topic VARCHAR(255),
    kafka_partition INTEGER,
    kafka_offset BIGINT
);

-- Create service_responses table to track responses from each service
CREATE TABLE service_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL,
    response_data JSONB NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    kafka_topic VARCHAR(255),
    kafka_partition INTEGER,
    kafka_offset BIGINT
);

-- Create audit_log table for tracking API calls and system events
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID REFERENCES assessments(id),
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(255),
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_assessments_user_id ON assessments(user_id);
CREATE INDEX idx_assessments_status ON assessments(status);
CREATE INDEX idx_assessments_created_at ON assessments(created_at);
CREATE INDEX idx_assessment_results_assessment_id ON assessment_results(assessment_id);
CREATE INDEX idx_assessment_submissions_assessment_id ON assessment_submissions(assessment_id);
CREATE INDEX idx_assessment_submissions_service ON assessment_submissions(service_name);
CREATE INDEX idx_service_responses_assessment_id ON service_responses(assessment_id);
CREATE INDEX idx_service_responses_service ON service_responses(service_name);
CREATE INDEX idx_audit_log_assessment_id ON audit_log(assessment_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_assessments_updated_at 
    BEFORE UPDATE ON assessments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to api_gateway_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO api_gateway_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO api_gateway_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO api_gateway_user;