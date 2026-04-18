-- Update loop_tasks with V2 cinematic fields
ALTER TABLE loop_tasks 
  ADD COLUMN IF NOT EXISTS detail_title TEXT,
  ADD COLUMN IF NOT EXISTS detail_description TEXT,
  ADD COLUMN IF NOT EXISTS inline_quote TEXT,
  ADD COLUMN IF NOT EXISTS cover_image TEXT;

-- Update the unique index to ensure it works with current schema
-- (Already exists in 012, no change needed unless we want to change constraints)

COMMENT ON COLUMN loop_tasks.detail_title IS 'Cinematic heading for the detail panel';
COMMENT ON COLUMN loop_tasks.detail_description IS '2-3 sentences explaining the deeper value';
COMMENT ON COLUMN loop_tasks.inline_quote IS 'Optional short line shown below the task';
COMMENT ON COLUMN loop_tasks.cover_image IS 'Category-based image path';
