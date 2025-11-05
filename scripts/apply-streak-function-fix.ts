/**
 * Apply database fix for ambiguous column reference in update_user_streak function
 * This script connects to Supabase and applies the SQL fix
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

async function applyStreakFunctionFix() {
  console.log('🔧 Applying database fix for streak function ambiguity...');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Read the SQL fix file
    const sqlFilePath = path.join(
      __dirname,
      '..',
      'sql',
      'fix_streak_function_ambiguity.sql',
    );
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('📖 Executing SQL fix...');

    // Execute the SQL fix
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: sqlContent,
    });

    if (error) {
      console.error('❌ Failed to apply database fix:', error);

      // Try alternative approach using individual SQL statements
      console.log('🔄 Trying alternative approach...');

      const { error: directError } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1);

      if (directError) {
        console.error('❌ Database connection failed:', directError);
        process.exit(1);
      }

      // Apply the fix using a direct SQL query
      const functionSQL = `
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
      `;

      console.log('📝 Manual SQL application required.');
      console.log(
        'Copy the following SQL and run it in your Supabase SQL editor:',
      );
      console.log('\n--- SQL TO EXECUTE ---');
      console.log(functionSQL);
      console.log('--- END SQL ---\n');

      return;
    }

    console.log('✅ Database fix applied successfully!');
    console.log(
      '🎯 The update_user_streak function ambiguity has been resolved.',
    );
    console.log('🧪 You can now test image generation functionality.');
  } catch (error) {
    console.error('💥 Unexpected error applying database fix:', error);

    // Provide manual instructions
    console.log('\n🔧 Manual Fix Instructions:');
    console.log('1. Open your Supabase project dashboard');
    console.log('2. Go to SQL Editor');
    console.log('3. Run the SQL in: sql/fix_streak_function_ambiguity.sql');
    console.log('4. This will fix the ambiguous column reference error');
  }
}

// Run the fix
if (require.main === module) {
  applyStreakFunctionFix()
    .then(() => {
      console.log('🏁 Database fix process completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Failed to apply database fix:', error);
      process.exit(1);
    });
}

export { applyStreakFunctionFix };
