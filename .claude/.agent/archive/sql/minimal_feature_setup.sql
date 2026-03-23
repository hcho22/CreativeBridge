-- Minimal Feature Management Setup for Story Image Generation
-- This creates only essential tables without relying on existing schema

-- 1. Clean up any conflicting views first
DROP VIEW IF EXISTS image_generation_metrics CASCADE;
DROP VIEW IF EXISTS user_experience_metrics CASCADE;
DROP VIEW IF EXISTS feature_flag_summary CASCADE;
DROP VIEW IF EXISTS image_generation_analytics CASCADE;

-- 2. Create feature_flags table for remote feature flag configuration
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    feature_name TEXT NOT NULL UNIQUE,
    config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by TEXT,
    description TEXT,
    
    CONSTRAINT feature_name_length CHECK (char_length(feature_name) >= 3)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags (feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags (enabled);

-- 3. Create beta_users table for beta testing management
CREATE TABLE IF NOT EXISTS beta_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    feature_name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    added_by TEXT,
    removed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    CONSTRAINT unique_user_feature UNIQUE (user_id, feature_name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_beta_users_user_id ON beta_users (user_id);
CREATE INDEX IF NOT EXISTS idx_beta_users_feature ON beta_users (feature_name);
CREATE INDEX IF NOT EXISTS idx_beta_users_active ON beta_users (active);

-- 4. Create feature_access_logs table for access tracking
CREATE TABLE IF NOT EXISTS feature_access_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    feature_name TEXT NOT NULL,
    access_granted BOOLEAN NOT NULL,
    access_reason TEXT,
    user_context JSONB DEFAULT '{}',
    rollout_percentage INTEGER,
    conditions_met BOOLEAN,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    CONSTRAINT rollout_percentage_range CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_feature_access_logs_user_id ON feature_access_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_feature_access_logs_feature ON feature_access_logs (feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_access_logs_granted ON feature_access_logs (access_granted);
CREATE INDEX IF NOT EXISTS idx_feature_access_logs_timestamp ON feature_access_logs (accessed_at);

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rollout_progress_feature ON rollout_progress (feature_name);
CREATE INDEX IF NOT EXISTS idx_rollout_progress_timestamp ON rollout_progress (rollout_timestamp);
CREATE INDEX IF NOT EXISTS idx_rollout_progress_status ON rollout_progress (status);

-- 6. Set up Row Level Security (RLS) policies

-- Enable RLS on all new tables
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rollout_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feature_flags (readable by all authenticated users)
DROP POLICY IF EXISTS "feature_flags_read_policy" ON feature_flags;
CREATE POLICY "feature_flags_read_policy" ON feature_flags
    FOR SELECT USING (true);

-- RLS Policies for beta_users (users can see their own status)
DROP POLICY IF EXISTS "beta_users_read_own" ON beta_users;
CREATE POLICY "beta_users_read_own" ON beta_users
    FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for feature_access_logs (users can see their own logs)
DROP POLICY IF EXISTS "feature_access_logs_read_own" ON feature_access_logs;
CREATE POLICY "feature_access_logs_read_own" ON feature_access_logs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "feature_access_logs_insert_own" ON feature_access_logs;
CREATE POLICY "feature_access_logs_insert_own" ON feature_access_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for rollout_progress (readable by all authenticated users)
DROP POLICY IF EXISTS "rollout_progress_read_policy" ON rollout_progress;
CREATE POLICY "rollout_progress_read_policy" ON rollout_progress
    FOR SELECT USING (true);

-- 7. Create a simple feature flag summary view (only using our new tables)
CREATE OR REPLACE VIEW feature_flag_summary AS
SELECT 
    ff.feature_name,
    ff.enabled,
    COALESCE((ff.config->>'rolloutPercentage')::INTEGER, 0) as rollout_percentage,
    COALESCE((ff.config->>'requiresWhitelist')::BOOLEAN, false) as requires_whitelist,
    COUNT(bu.user_id) as beta_user_count,
    ff.updated_at as last_updated
FROM feature_flags ff
LEFT JOIN beta_users bu ON bu.feature_name = ff.feature_name AND bu.active = true
GROUP BY ff.feature_name, ff.enabled, ff.config, ff.updated_at;

-- 8. Insert initial feature flag configuration
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

-- 9. Create utility functions

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

-- 10. Create trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_feature_flags_updated_at ON feature_flags;
CREATE TRIGGER update_feature_flags_updated_at 
    BEFORE UPDATE ON feature_flags 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON feature_flags TO authenticated;
GRANT SELECT ON beta_users TO authenticated;
GRANT SELECT ON feature_access_logs TO authenticated;
GRANT SELECT ON rollout_progress TO authenticated;
GRANT INSERT ON feature_access_logs TO authenticated;

-- Add comments
COMMENT ON TABLE feature_flags IS 'Remote configuration for feature flags with rollout control';
COMMENT ON TABLE beta_users IS 'Beta testing user management for gradual feature rollout';
COMMENT ON TABLE feature_access_logs IS 'Logs of feature flag evaluations for analytics';
COMMENT ON TABLE rollout_progress IS 'Tracking of gradual rollout progress and metrics';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Essential feature management tables created successfully!';
    RAISE NOTICE '🔧 No dependencies on existing table structure';
    RAISE NOTICE '📊 Basic monitoring ready without schema conflicts';
    RAISE NOTICE '🚀 Ready for safe image generation feature deployment!';
END
$$;