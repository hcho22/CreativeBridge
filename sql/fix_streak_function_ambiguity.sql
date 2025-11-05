-- Fix for ambiguous column reference in update_user_streak function
-- This addresses the error: "column reference 'current_streak' is ambiguous"

-- Drop and recreate the update_user_streak function with proper variable naming
CREATE OR REPLACE FUNCTION update_user_streak(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
    last_date DATE;
    user_current_streak INTEGER;
    user_longest_streak INTEGER;
BEGIN
    SELECT last_activity_date, current_streak, longest_streak 
    INTO last_date, user_current_streak, user_longest_streak
    FROM public.user_profiles 
    WHERE id = user_uuid;
    
    IF last_date = CURRENT_DATE THEN
        -- Same day, no streak update needed
        RETURN;
    ELSIF last_date = CURRENT_DATE - INTERVAL '1 day' THEN
        -- Consecutive day, increment streak
        user_current_streak := user_current_streak + 1;
        IF user_current_streak > user_longest_streak THEN
            user_longest_streak := user_current_streak;
        END IF;
    ELSE
        -- Streak broken, reset to 1
        user_current_streak := 1;
    END IF;
    
    -- Update the table with explicit variable names to avoid ambiguity
    UPDATE public.user_profiles 
    SET 
        current_streak = user_current_streak,
        longest_streak = user_longest_streak,
        last_activity_date = CURRENT_DATE
    WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the function was created successfully
SELECT 'update_user_streak function fixed successfully' as status;