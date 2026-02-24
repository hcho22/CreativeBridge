-- Feature Management Tables for Story Image Generation Launch
-- Run these SQL commands in your Supabase SQL editor

-- 1. Create feature_flags table for remote feature flag configuration
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    feature_name TEXT NOT NULL UNIQUE,
    config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by TEXT,
    description TEXT,
    
    -- Add constraints
    CONSTRAINT feature_name_length CHECK (char_length(feature_name) >= 3),
    CONSTRAINT config_valid_json CHECK (config IS NOT NULL)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags (feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags (enabled);

-- 2. Create beta_users table for beta testing management
CREATE TABLE IF NOT EXISTS beta_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    added_by TEXT,
    removed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    -- Ensure unique combination of user and feature
    CONSTRAINT unique_user_feature UNIQUE (user_id, feature_name)
);

-- Create indexes for beta users
CREATE INDEX IF NOT EXISTS idx_beta_users_user_id ON beta_users (user_id);
CREATE INDEX IF NOT EXISTS idx_beta_users_feature ON beta_users (feature_name);
CREATE INDEX IF NOT EXISTS idx_beta_users_active ON beta_users (active);

-- 3. Create feature_access_logs table for access tracking
CREATE TABLE IF NOT EXISTS feature_access_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_name TEXT NOT NULL,
    access_granted BOOLEAN NOT NULL,
    access_reason TEXT,
    user_context JSONB DEFAULT '{}',
    rollout_percentage INTEGER,
    conditions_met BOOLEAN,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Add constraints
    CONSTRAINT rollout_percentage_range CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100)
);

-- Create indexes for feature access logs
CREATE INDEX IF NOT EXISTS idx_feature_access_logs_user_id ON feature_access_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_feature_access_logs_feature ON feature_access_logs (feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_access_logs_granted ON feature_access_logs (access_granted);
CREATE INDEX IF NOT EXISTS idx_feature_access_logs_timestamp ON feature_access_logs (accessed_at);

-- 4. Create image_generation_analytics table for detailed analytics
CREATE TABLE IF NOT EXISTS image_generation_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID,
    story_id UUID,
    
    -- Request details
    request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    grade_level TEXT,
    story_word_count INTEGER,
    xp_cost INTEGER DEFAULT 1000,
    
    -- Generation details
    prompt_generated TEXT,
    art_style TEXT,
    service_used TEXT, -- 'replicate_primary', 'replicate_backup', etc.
    
    -- Response details
    response_timestamp TIMESTAMP WITH TIME ZONE,
    response_time_ms INTEGER,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'timeout', 'rate_limited')),
    error_type TEXT,
    error_message TEXT,
    
    -- Result details
    image_url TEXT,
    image_size_bytes INTEGER,
    image_dimensions TEXT, -- e.g., "1024x1024"
    
    -- User experience metrics
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    user_feedback TEXT,
    
    -- System metrics
    queue_time_ms INTEGER,
    processing_time_ms INTEGER,
    
    CONSTRAINT response_time_positive CHECK (response_time_ms IS NULL OR response_time_ms >= 0),
    CONSTRAINT queue_time_positive CHECK (queue_time_ms IS NULL OR queue_time_ms >= 0)
);

-- Create indexes for analytics
CREATE INDEX IF NOT EXISTS idx_image_analytics_user_id ON image_generation_analytics (user_id);
CREATE INDEX IF NOT EXISTS idx_image_analytics_timestamp ON image_generation_analytics (request_timestamp);
CREATE INDEX IF NOT EXISTS idx_image_analytics_status ON image_generation_analytics (status);
CREATE INDEX IF NOT EXISTS idx_image_analytics_service ON image_generation_analytics (service_used);
CREATE INDEX IF NOT EXISTS idx_image_analytics_grade_level ON image_generation_analytics (grade_level);

-- 5. Create rollout_progress table for tracking gradual rollout
CREATE TABLE IF NOT EXISTS rollout_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    feature_name TEXT NOT NULL,
    rollout_percentage INTEGER NOT NULL CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    target_percentage INTEGER NOT NULL CHECK (target_percentage >= 0 AND target_percentage <= 100),
    
    -- Metrics at this rollout level
    total_users_eligible INTEGER DEFAULT 0,
    total_users_accessed INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2),
    error_rate DECIMAL(5,2),
    avg_response_time_ms INTEGER,
    
    -- Rollout control
    rollout_timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    rollout_by TEXT,
    auto_rollout BOOLEAN DEFAULT false,
    
    -- Status tracking
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'rolled_back')),
    notes TEXT
);

-- Create indexes for rollout progress
CREATE INDEX IF NOT EXISTS idx_rollout_progress_feature ON rollout_progress (feature_name);
CREATE INDEX IF NOT EXISTS idx_rollout_progress_timestamp ON rollout_progress (rollout_timestamp);
CREATE INDEX IF NOT EXISTS idx_rollout_progress_status ON rollout_progress (status);

-- 6. Set up Row Level Security (RLS) policies

-- Enable RLS on all tables
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_generation_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rollout_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feature_flags (admin only)
CREATE POLICY "feature_flags_read_policy" ON feature_flags
    FOR SELECT USING (true); -- Allow all authenticated users to read feature flags

CREATE POLICY "feature_flags_write_policy" ON feature_flags
    FOR ALL USING (false); -- Restrict write access in app (use database admin for updates)

-- RLS Policies for beta_users
CREATE POLICY "beta_users_read_own" ON beta_users
    FOR SELECT USING (auth.uid() = user_id); -- Users can see their own beta status

CREATE POLICY "beta_users_write_admin" ON beta_users
    FOR ALL USING (false); -- Restrict write access (admin only)

-- RLS Policies for feature_access_logs
CREATE POLICY "feature_access_logs_read_own" ON feature_access_logs
    FOR SELECT USING (auth.uid() = user_id); -- Users can see their own access logs

CREATE POLICY "feature_access_logs_insert_own" ON feature_access_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id); -- Users can insert their own logs

-- RLS Policies for image_generation_analytics
CREATE POLICY "image_analytics_read_own" ON image_generation_analytics
    FOR SELECT USING (auth.uid() = user_id); -- Users can see their own analytics

CREATE POLICY "image_analytics_insert_own" ON image_generation_analytics
    FOR INSERT WITH CHECK (auth.uid() = user_id); -- Users can insert their own analytics

-- RLS Policies for rollout_progress (admin read-only for users)
CREATE POLICY "rollout_progress_read_policy" ON rollout_progress
    FOR SELECT USING (true); -- Allow all authenticated users to read rollout status

-- 7. Create useful views for analytics and monitoring

-- View for feature flag status summary
CREATE OR REPLACE VIEW feature_flag_summary AS
SELECT 
    ff.feature_name,
    ff.enabled,
    (ff.config->>'rolloutPercentage')::INTEGER as rollout_percentage,
    (ff.config->>'requiresWhitelist')::BOOLEAN as requires_whitelist,
    COUNT(bu.user_id) as beta_user_count,
    ff.updated_at as last_updated
FROM feature_flags ff
LEFT JOIN beta_users bu ON bu.feature_name = ff.feature_name AND bu.active = true
GROUP BY ff.feature_name, ff.enabled, ff.config, ff.updated_at;

-- View for image generation success metrics
CREATE OR REPLACE VIEW image_generation_metrics AS
SELECT 
    DATE(request_timestamp) as date,
    grade_level,
    service_used,
    COUNT(*) as total_requests,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_requests,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_requests,
    COUNT(CASE WHEN status = 'timeout' THEN 1 END) as timeout_requests,
    ROUND(AVG(CASE WHEN response_time_ms IS NOT NULL THEN response_time_ms END)) as avg_response_time_ms,
    ROUND(
        COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*), 
        2
    ) as success_rate_percent
FROM image_generation_analytics
WHERE request_timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(request_timestamp), grade_level, service_used
ORDER BY date DESC, grade_level, service_used;

-- View for user experience metrics
CREATE OR REPLACE VIEW user_experience_metrics AS
SELECT 
    DATE(request_timestamp) as date,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(*) as total_generations,
    ROUND(AVG(user_rating), 2) as avg_user_rating,
    COUNT(CASE WHEN user_rating >= 4 THEN 1 END) as positive_ratings,
    COUNT(CASE WHEN user_rating <= 2 THEN 1 END) as negative_ratings,
    ROUND(AVG(story_word_count)) as avg_story_length
FROM image_generation_analytics
WHERE request_timestamp >= CURRENT_DATE - INTERVAL '30 days'
  AND user_rating IS NOT NULL
GROUP BY DATE(request_timestamp)
ORDER BY date DESC;

-- 8. Insert initial feature flag configuration for image generation
INSERT INTO feature_flags (feature_name, config, enabled, description, updated_by)
VALUES (
    'image_generation',
    '{
        "rolloutPercentage": 0,
        "requiresWhitelist": true,
        "maxDailyGenerations": 5,
        "allowedGradeLevels": ["K-2", "3-5", "6-8", "9-12"],
        "xpCost": 1000,
        "enabledServices": ["replicate_primary", "replicate_backup"]
    }'::jsonb,
    false,
    'Story Image Generation Feature - Gradual Rollout Configuration',
    'system_initialization'
) ON CONFLICT (feature_name) DO UPDATE SET
    config = EXCLUDED.config,
    description = EXCLUDED.description,
    updated_at = timezone('utc'::text, now());

-- 9. Create functions for common operations

-- Function to add a beta user
CREATE OR REPLACE FUNCTION add_beta_user(
    p_user_id UUID,
    p_feature_name TEXT,
    p_added_by TEXT DEFAULT 'admin',
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO beta_users (user_id, feature_name, added_by, notes)
    VALUES (p_user_id, p_feature_name, p_added_by, p_notes)
    ON CONFLICT (user_id, feature_name) 
    DO UPDATE SET 
        active = true,
        added_by = p_added_by,
        added_at = timezone('utc'::text, now()),
        removed_at = NULL,
        notes = p_notes;
    
    RETURN true;
EXCEPTION WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Function to remove a beta user
CREATE OR REPLACE FUNCTION remove_beta_user(
    p_user_id UUID,
    p_feature_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE beta_users 
    SET 
        active = false,
        removed_at = timezone('utc'::text, now())
    WHERE user_id = p_user_id 
      AND feature_name = p_feature_name
      AND active = true;
    
    RETURN FOUND;
END;
$$;

-- Function to update rollout percentage
CREATE OR REPLACE FUNCTION update_rollout_percentage(
    p_feature_name TEXT,
    p_new_percentage INTEGER,
    p_updated_by TEXT DEFAULT 'admin'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Validate percentage
    IF p_new_percentage < 0 OR p_new_percentage > 100 THEN
        RAISE EXCEPTION 'Rollout percentage must be between 0 and 100';
    END IF;
    
    -- Update feature flag
    UPDATE feature_flags 
    SET 
        config = jsonb_set(config, '{rolloutPercentage}', to_jsonb(p_new_percentage)),
        updated_at = timezone('utc'::text, now()),
        updated_by = p_updated_by
    WHERE feature_name = p_feature_name;
    
    -- Log rollout progress
    INSERT INTO rollout_progress (
        feature_name, 
        rollout_percentage, 
        target_percentage, 
        rollout_by
    ) VALUES (
        p_feature_name, 
        p_new_percentage, 
        p_new_percentage, 
        p_updated_by
    );
    
    RETURN FOUND;
END;
$$;

-- 10. Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_feature_flags_updated_at 
    BEFORE UPDATE ON feature_flags 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT ON feature_access_logs TO authenticated;
GRANT INSERT ON image_generation_analytics TO authenticated;

-- Comments for documentation
COMMENT ON TABLE feature_flags IS 'Remote configuration for feature flags with rollout control';
COMMENT ON TABLE beta_users IS 'Beta testing user management for gradual feature rollout';
COMMENT ON TABLE feature_access_logs IS 'Logs of feature flag evaluations for analytics';
COMMENT ON TABLE image_generation_analytics IS 'Detailed analytics for image generation feature usage';
COMMENT ON TABLE rollout_progress IS 'Tracking of gradual rollout progress and metrics';

COMMENT ON VIEW feature_flag_summary IS 'Summary view of feature flag status and beta user counts';
COMMENT ON VIEW image_generation_metrics IS 'Daily metrics for image generation performance';
COMMENT ON VIEW user_experience_metrics IS 'User satisfaction and usage metrics';

-- Completion message
DO $$
BEGIN
    RAISE NOTICE 'Feature management tables created successfully!';
    RAISE NOTICE 'You can now manage beta users and track rollout progress.';
    RAISE NOTICE 'Use the views for monitoring and analytics.';
END
$$;