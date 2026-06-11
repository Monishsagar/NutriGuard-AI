import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://logysiybzfuuohkoeiqy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvZ3lzaXliemZ1dW9oa29laXF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDM0MDEwMiwiZXhwIjoyMDg5OTE2MTAyfQ.0A91V326bmSXvwzCDnl91XsyS_ohJMBBMZjpUbkY0b0'
)

const { data, error } = await supabase.from('meal_logs').select('id, target_nutrition, compensation_suggestion').limit(1)
if (error) {
  console.error('❌ Columns missing:', error.message)
} else {
  console.log('✅ Migration verified! Columns exist.')
  console.log('Sample:', data)
}
