-- Checks for the focus timer tables: own rows only, no duplicates, no edits, sane limits.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/focus_check.sql
begin;
create temporary table check_results (name text, ok boolean);
grant all on check_results to public;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

do $$
declare n int;
begin
  insert into public.focus_sessions (id, user_id, kind, status, started_at, ended_at, focus_seconds, planned_seconds, local_day)
    values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'pomodoro', 'completed',
            '2026-11-26 10:00+00', '2026-11-26 10:25+00', 1500, 1500, '2026-11-26');
  insert into check_results values ('a student can save their own session', true);

  -- Saving the same session again (a retry) must not make a second row.
  begin
    insert into public.focus_sessions (id, user_id, kind, status, started_at, ended_at, focus_seconds, local_day)
      values ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'pomodoro', 'completed',
              '2026-11-26 10:00+00', '2026-11-26 10:25+00', 1500, '2026-11-26');
    insert into check_results values ('the same session id cannot be saved twice', false);
  exception when unique_violation then
    insert into check_results values ('the same session id cannot be saved twice', true);
  end;

  -- Cannot save a session as somebody else.
  begin
    insert into public.focus_sessions (id, user_id, kind, status, started_at, ended_at, focus_seconds, local_day)
      values ('a0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'stopwatch', 'completed',
              '2026-11-26 10:00+00', '2026-11-26 10:05+00', 300, '2026-11-26');
    insert into check_results values ('cannot save a session for another student', false);
  exception when insufficient_privilege then
    insert into check_results values ('cannot save a session for another student', true);
  end;

  -- Bad values are refused.
  begin
    insert into public.focus_sessions (id, user_id, kind, status, started_at, ended_at, focus_seconds, local_day)
      values ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'pomodoro', 'completed',
              '2026-11-26 10:00+00', '2026-11-26 10:05+00', -5, '2026-11-26');
    insert into check_results values ('negative focus time is refused', false);
  exception when check_violation then
    insert into check_results values ('negative focus time is refused', true);
  end;
  begin
    insert into public.focus_sessions (id, user_id, kind, status, started_at, ended_at, focus_seconds, local_day)
      values ('a0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'pomodoro', 'completed',
              '2026-11-26 10:10+00', '2026-11-26 10:05+00', 60, '2026-11-26');
    insert into check_results values ('a session cannot end before it starts', false);
  exception when check_violation then
    insert into check_results values ('a session cannot end before it starts', true);
  end;
  begin
    insert into public.focus_sessions (id, user_id, kind, status, started_at, ended_at, focus_seconds, local_day)
      values ('a0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'break', 'completed',
              '2026-11-26 10:00+00', '2026-11-26 10:05+00', 60, '2026-11-26');
    insert into check_results values ('a break is not a session kind', false);
  exception when check_violation then
    insert into check_results values ('a break is not a session kind', true);
  end;

  -- A finished session is never edited.
  begin
    update public.focus_sessions set focus_seconds = 9999;
    insert into check_results values ('a saved session cannot be edited', false);
  exception when insufficient_privilege then
    insert into check_results values ('a saved session cannot be edited', true);
  end;

  insert into public.focus_settings (user_id, settings) values ('11111111-1111-1111-1111-111111111111', '{"focusMin":30}');
  insert into check_results values ('a student can save their settings', true);
  begin
    insert into public.focus_settings (user_id, settings) values ('22222222-2222-2222-2222-222222222222', '{}');
    insert into check_results values ('cannot save settings for another student', false);
  exception when insufficient_privilege then
    insert into check_results values ('cannot save settings for another student', true);
  end;
  begin
    update public.focus_settings set settings = '[]'::jsonb;
    insert into check_results values ('settings must be an object', false);
  exception when check_violation then
    insert into check_results values ('settings must be an object', true);
  end;
end $$;

-- The other student sees nothing of the first student's data and cannot delete it.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.focus_sessions;
  insert into check_results values ('another student sees no sessions', n = 0);
  select count(*) into n from public.focus_settings;
  insert into check_results values ('another student sees no settings', n = 0);
  delete from public.focus_sessions;
  get diagnostics n = row_count;
  insert into check_results values ('another student cannot delete sessions', n = 0);
end $$;

-- The owner can still see and delete their own.
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
do $$
declare n int;
begin
  select count(*) into n from public.focus_sessions;
  insert into check_results values ('the owner sees their own session', n = 1);
  delete from public.focus_sessions;
  get diagnostics n = row_count;
  insert into check_results values ('the owner can delete their own session', n = 1);
end $$;

-- Signed out: nothing at all.
reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.focus_sessions;
    insert into check_results values ('signed-out users cannot read sessions', false);
  exception when insufficient_privilege then
    insert into check_results values ('signed-out users cannot read sessions', true);
  end;
end $$;

reset role;
-- Deleting the account removes the study data with it.
insert into public.focus_sessions (id, user_id, kind, status, started_at, ended_at, focus_seconds, local_day)
  values ('a0000000-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'countdown', 'interrupted',
          '2026-11-26 10:00+00', '2026-11-26 10:05+00', 300, '2026-11-26');
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
insert into check_results select 'deleting an account deletes its sessions',
  not exists (select 1 from public.focus_sessions where user_id = '22222222-2222-2222-2222-222222222222');

select name, ok from check_results order by ok, name;
do $$ begin
  if exists (select 1 from check_results where not ok) then raise exception 'focus checks failed'; end if;
end $$;
rollback;
