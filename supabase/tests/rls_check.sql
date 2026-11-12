-- Row-level-security checks for the foundation tables.
-- Run with: psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_check.sql
-- Any failed check raises an exception and the script exits non-zero.
-- Everything runs inside a transaction that is rolled back at the end.

begin;

create temporary table check_results (name text, ok boolean);
grant all on check_results to public;

-- Two students.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test');

-- 1. Signing up created a profile and preferences for each student.
insert into check_results
select 'signup trigger creates profile and preferences',
  (select count(*) from public.profiles) = 2
  and (select count(*) from public.user_preferences) = 2;

-- Act as student A.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into check_results
select 'A sees only their own profile',
  (select count(*) from public.profiles) = 1
  and (select id from public.profiles) = '11111111-1111-1111-1111-111111111111';

insert into check_results
select 'A sees only their own preferences',
  (select count(*) from public.user_preferences) = 1;

-- A updates their own theme.
update public.user_preferences set theme = 'forest';
insert into check_results
select 'A can update their own theme', (select theme from public.user_preferences) = 'forest';

-- A tries to update B's rows: zero rows must change.
do $$
declare n integer;
begin
  update public.user_preferences set theme = 'space'
    where user_id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  insert into check_results values ('A cannot update B preferences', n = 0);

  update public.profiles set display_name = 'hacked'
    where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  insert into check_results values ('A cannot update B profile', n = 0);
end $$;

-- A tries to hand their row to B: must be rejected.
do $$
begin
  begin
    update public.profiles set id = '22222222-2222-2222-2222-222222222222'
      where id = '11111111-1111-1111-1111-111111111111';
    insert into check_results values ('A cannot reassign their profile to B', false);
  exception when others then
    insert into check_results values ('A cannot reassign their profile to B', true);
  end;
end $$;

-- Students cannot insert or delete profile rows directly.
do $$
begin
  begin
    insert into public.profiles (id) values ('33333333-3333-3333-3333-333333333333');
    insert into check_results values ('student cannot insert a profile', false);
  exception when others then
    insert into check_results values ('student cannot insert a profile', true);
  end;
  begin
    delete from public.profiles;
    insert into check_results values ('student cannot delete a profile', false);
  exception when others then
    insert into check_results values ('student cannot delete a profile', true);
  end;
end $$;

-- Invalid values are rejected by constraints.
do $$
begin
  begin
    update public.user_preferences set theme = 'neon';
    insert into check_results values ('invalid theme is rejected', false);
  exception when check_violation then
    insert into check_results values ('invalid theme is rejected', true);
  end;
end $$;

-- Trigger functions are not callable by students.
do $$
begin
  begin
    perform public.handle_new_user();
    insert into check_results values ('handle_new_user not callable by students', false);
  exception when insufficient_privilege then
    insert into check_results values ('handle_new_user not callable by students', true);
  end;
end $$;

-- Switch to student B: must see only B and must not see A's theme change.
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

insert into check_results
select 'B sees only their own rows and their theme is untouched',
  (select count(*) from public.profiles) = 1
  and (select theme from public.user_preferences) = 'default'
  and (select display_name from public.profiles) = '';

-- Signed-out visitors (anon) get nothing.
reset role;
set local role anon;
do $$
begin
  begin
    perform count(*) from public.profiles;
    insert into check_results values ('anon cannot read profiles', false);
  exception when insufficient_privilege then
    insert into check_results values ('anon cannot read profiles', true);
  end;
  begin
    perform count(*) from public.user_preferences;
    insert into check_results values ('anon cannot read preferences', false);
  exception when insufficient_privilege then
    insert into check_results values ('anon cannot read preferences', true);
  end;
end $$;

reset role;

-- Report and fail loudly.
select name, case when ok then 'PASS' else 'FAIL' end as result from check_results order by ok, name;

do $$
declare failed integer;
begin
  select count(*) into failed from check_results where not coalesce(ok, false);
  if failed > 0 then
    raise exception '% RLS check(s) failed', failed;
  end if;
end $$;

rollback;
