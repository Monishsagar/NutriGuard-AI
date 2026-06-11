-- Add target_nutrition and compensation_suggestion columns to meal_logs
-- target_nutrition stores the diet plan target for comparison
-- compensation_suggestion stores AI-generated advice for deviated meals

ALTER TABLE public.meal_logs 
  ADD COLUMN IF NOT EXISTS target_nutrition JSONB DEFAULT NULL;

ALTER TABLE public.meal_logs 
  ADD COLUMN IF NOT EXISTS compensation_suggestion TEXT DEFAULT NULL;
