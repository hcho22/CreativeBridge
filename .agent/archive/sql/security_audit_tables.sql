-- Security Audit and Device Management Tables for CreativeBridge
-- Enhanced security features with comprehensive audit logging

-- Audit Log Table for Security Events
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Event Information
    event_type VARCHAR(50) NOT NULL, -- 'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PROFILE_UPDATE', 'PASSWORD_CHANGE', etc.
    event_category VARCHAR(20) NOT NULL, -- 'AUTH', 'DATA', 'SECURITY', 'ERROR'
    severity VARCHAR(10) NOT NULL DEFAULT 'INFO', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    
    -- Event Details
    description TEXT,
    metadata JSONB, -- Flexible field for event-specific data
    
    -- Request Information
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    
    -- Location and Context
    location_info JSONB, -- Country, city if available
    session_id TEXT,
    
    -- Security Flags
    is_suspicious BOOLEAN DEFAULT FALSE,
    risk_score INTEGER DEFAULT 0, -- 0-100 risk assessment
    
    CONSTRAINT valid_event_category CHECK (event_category IN ('AUTH', 'DATA', 'SECURITY', 'ERROR')),
    CONSTRAINT valid_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT valid_risk_score CHECK (risk_score >= 0 AND risk_score <= 100)
);

-- Device Registration Table
CREATE TABLE IF NOT EXISTS public.user_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Device Identification
    device_id TEXT UNIQUE NOT NULL, -- Unique device fingerprint
    device_name TEXT, -- User-friendly name
    device_type VARCHAR(20), -- 'MOBILE', 'TABLET', 'DESKTOP'
    os_name VARCHAR(50),
    os_version VARCHAR(20),
    app_version VARCHAR(20),
    
    -- Trust and Security
    is_trusted BOOLEAN DEFAULT FALSE,
    is_primary BOOLEAN DEFAULT FALSE,
    trust_score INTEGER DEFAULT 50, -- 0-100 trust level
    
    -- Location Tracking
    first_seen_ip INET,
    last_seen_ip INET,
    first_seen_location JSONB,
    last_seen_location JSONB,
    
    -- Usage Statistics
    login_count INTEGER DEFAULT 0,
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_device_type CHECK (device_type IN ('MOBILE', 'TABLET', 'DESKTOP', 'UNKNOWN')),
    CONSTRAINT valid_trust_score CHECK (trust_score >= 0 AND trust_score <= 100),
    CONSTRAINT one_primary_device_per_user UNIQUE (user_id, is_primary) DEFERRABLE INITIALLY DEFERRED
);

-- Rate Limiting Table
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier TEXT NOT NULL, -- IP address, user ID, or device ID
    action_type VARCHAR(50) NOT NULL, -- 'LOGIN_ATTEMPT', 'PASSWORD_RESET', etc.
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    attempt_count INTEGER DEFAULT 1,
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(identifier, action_type, window_start)
);

-- Two-Factor Authentication Table
CREATE TABLE IF NOT EXISTS public.user_2fa (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 2FA Configuration
    is_enabled BOOLEAN DEFAULT FALSE,
    method VARCHAR(20) DEFAULT 'TOTP', -- 'TOTP', 'SMS', 'EMAIL'
    secret_key TEXT, -- Encrypted TOTP secret
    backup_codes TEXT[], -- Encrypted backup codes
    
    -- Recovery Information
    recovery_email TEXT,
    recovery_phone TEXT,
    
    -- Usage Tracking
    last_used_at TIMESTAMP WITH TIME ZONE,
    setup_completed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_2fa_method CHECK (method IN ('TOTP', 'SMS', 'EMAIL'))
);

-- Session Tracking Table
CREATE TABLE IF NOT EXISTS public.active_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.user_devices(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Session Information
    session_token TEXT UNIQUE NOT NULL,
    refresh_token TEXT,
    ip_address INET,
    user_agent TEXT,
    
    -- Session State
    is_active BOOLEAN DEFAULT TRUE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Security Flags
    is_suspicious BOOLEAN DEFAULT FALSE,
    requires_2fa BOOLEAN DEFAULT FALSE,
    two_fa_verified BOOLEAN DEFAULT FALSE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_suspicious ON public.audit_logs(is_suspicious);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON public.user_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_trusted ON public.user_devices(is_trusted);
CREATE INDEX IF NOT EXISTS idx_user_devices_last_used ON public.user_devices(last_used_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON public.rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_action_type ON public.rate_limits(action_type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON public.rate_limits(window_start DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked ON public.rate_limits(is_blocked);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON public.active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_device_id ON public.active_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires_at ON public.active_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_active_sessions_active ON public.active_sessions(is_active);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_user_devices_updated_at ON public.user_devices;
CREATE TRIGGER update_user_devices_updated_at BEFORE UPDATE ON public.user_devices FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_2fa_updated_at ON public.user_2fa;
CREATE TRIGGER update_user_2fa_updated_at BEFORE UPDATE ON public.user_2fa FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_active_sessions_updated_at ON public.active_sessions;
CREATE TRIGGER update_active_sessions_updated_at BEFORE UPDATE ON public.active_sessions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- RLS Policies for Security Tables

-- Audit Logs - Admin/System only, users can view their own
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (true); -- System service can insert

-- User Devices - Users can manage their own devices
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices" ON public.user_devices
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices" ON public.user_devices
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices" ON public.user_devices
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devices" ON public.user_devices
    FOR DELETE USING (auth.uid() = user_id);

-- Rate Limits - System managed
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System manages rate limits" ON public.rate_limits
    FOR ALL USING (true); -- System service manages this

-- 2FA Settings - Users can manage their own
ALTER TABLE public.user_2fa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own 2FA settings" ON public.user_2fa
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own 2FA settings" ON public.user_2fa
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own 2FA settings" ON public.user_2fa
    FOR UPDATE USING (auth.uid() = user_id);

-- Active Sessions - Users can view their own sessions
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions" ON public.active_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage sessions" ON public.active_sessions
    FOR ALL USING (true); -- System service manages sessions

-- Security Functions

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_user_id UUID,
    p_event_type VARCHAR(50),
    p_event_category VARCHAR(20),
    p_severity VARCHAR(10),
    p_description TEXT,
    p_metadata JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_device_info JSONB DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_is_suspicious BOOLEAN DEFAULT FALSE,
    p_risk_score INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        user_id, event_type, event_category, severity, description,
        metadata, ip_address, user_agent, device_info, session_id,
        is_suspicious, risk_score
    ) VALUES (
        p_user_id, p_event_type, p_event_category, p_severity, p_description,
        p_metadata, p_ip_address, p_user_agent, p_device_info, p_session_id,
        p_is_suspicious, p_risk_score
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier TEXT,
    p_action_type VARCHAR(50),
    p_window_minutes INTEGER DEFAULT 15,
    p_max_attempts INTEGER DEFAULT 5
)
RETURNS BOOLEAN AS $$
DECLARE
    current_window TIMESTAMP WITH TIME ZONE;
    attempt_count INTEGER;
    is_blocked BOOLEAN;
BEGIN
    current_window := date_trunc('minute', NOW()) - INTERVAL '1 minute' * (EXTRACT(MINUTE FROM NOW())::INTEGER % p_window_minutes);
    
    -- Get current attempt count for this window
    SELECT COALESCE(attempt_count, 0), COALESCE(is_blocked, FALSE)
    INTO attempt_count, is_blocked
    FROM public.rate_limits
    WHERE identifier = p_identifier 
      AND action_type = p_action_type 
      AND window_start = current_window;
    
    -- If already blocked and block period hasn't expired
    IF is_blocked THEN
        SELECT blocked_until > NOW() INTO is_blocked
        FROM public.rate_limits
        WHERE identifier = p_identifier 
          AND action_type = p_action_type 
          AND window_start = current_window;
          
        RETURN NOT is_blocked;
    END IF;
    
    -- Check if limit exceeded
    IF attempt_count >= p_max_attempts THEN
        -- Block for 1 hour
        UPDATE public.rate_limits 
        SET is_blocked = TRUE, blocked_until = NOW() + INTERVAL '1 hour'
        WHERE identifier = p_identifier 
          AND action_type = p_action_type 
          AND window_start = current_window;
        
        RETURN FALSE;
    END IF;
    
    -- Increment attempt count
    INSERT INTO public.rate_limits (identifier, action_type, window_start, attempt_count)
    VALUES (p_identifier, p_action_type, current_window, 1)
    ON CONFLICT (identifier, action_type, window_start)
    DO UPDATE SET attempt_count = rate_limits.attempt_count + 1;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to register/update device
CREATE OR REPLACE FUNCTION register_device(
    p_user_id UUID,
    p_device_id TEXT,
    p_device_name TEXT,
    p_device_type VARCHAR(20),
    p_os_name VARCHAR(50),
    p_os_version VARCHAR(20),
    p_app_version VARCHAR(20),
    p_ip_address INET,
    p_location_info JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    device_uuid UUID;
BEGIN
    INSERT INTO public.user_devices (
        user_id, device_id, device_name, device_type, os_name, os_version,
        app_version, first_seen_ip, last_seen_ip, first_seen_location,
        last_seen_location, login_count, last_login_at, last_used_at
    ) VALUES (
        p_user_id, p_device_id, p_device_name, p_device_type, p_os_name,
        p_os_version, p_app_version, p_ip_address, p_ip_address,
        p_location_info, p_location_info, 1, NOW(), NOW()
    )
    ON CONFLICT (device_id) DO UPDATE SET
        last_seen_ip = p_ip_address,
        last_seen_location = p_location_info,
        login_count = user_devices.login_count + 1,
        last_login_at = NOW(),
        last_used_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO device_uuid;
    
    RETURN device_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.active_sessions 
    WHERE expires_at < NOW() OR (last_activity_at < NOW() - INTERVAL '30 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;