-- M5: the student's own Home layout (which sections show, and in what order).
-- Stored as a small JSON object on the existing per-user preferences row, so the policies that
-- already protect that row (own row only, forced RLS) protect this too.
alter table public.user_preferences
  add column home_layout jsonb not null default '{}'::jsonb
    check (jsonb_typeof(home_layout) = 'object' and pg_column_size(home_layout) <= 2048);
