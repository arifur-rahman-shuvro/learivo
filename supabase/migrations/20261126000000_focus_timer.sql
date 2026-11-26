-- Focus timer: every finished focus session, and the student's timer settings.
-- Additive only: two new tables, nothing existing is changed. Own rows only (RLS).

-- One row per finished focus session. Breaks are never stored, so they can never count as study.
-- The id is made on the device, so saving the same session twice (a retry after a bad connection)
-- can never create a duplicate: the primary key refuses it.
create table public.focus_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('pomodoro', 'stopwatch', 'countdown', 'custom')),
  status text not null check (status in ('completed', 'interrupted', 'cancelled')),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  focus_seconds integer not null check (focus_seconds between 0 and 86400),
  planned_seconds integer check (planned_seconds is null or planned_seconds between 1 and 86400),
  -- The student's own calendar day when the session started (decided on their device).
  local_day date not null,
  created_at timestamptz not null default now(),
  check (ended_at >= started_at)
);
alter table public.focus_sessions enable row level security;
revoke all on public.focus_sessions from anon;
-- A finished session is a record: it can be read, added and deleted, never edited.
revoke update on public.focus_sessions from authenticated;
create policy focus_sessions_read on public.focus_sessions
  for select to authenticated using (user_id = auth.uid());
create policy focus_sessions_add on public.focus_sessions
  for insert to authenticated with check (user_id = auth.uid());
create policy focus_sessions_remove on public.focus_sessions
  for delete to authenticated using (user_id = auth.uid());
create index focus_sessions_user_started_idx on public.focus_sessions (user_id, started_at desc);

-- Timer settings as one small document, checked again in the app before it is used.
create table public.focus_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 8192),
  updated_at timestamptz not null default now()
);
alter table public.focus_settings enable row level security;
revoke all on public.focus_settings from anon;
create policy focus_settings_own on public.focus_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
