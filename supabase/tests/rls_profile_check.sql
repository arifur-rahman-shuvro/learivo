-- Checks for the profile name and avatar (M11): own row only, fixed avatar set, length limit.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_profile_check.sql
begin;
create temporary table check_results (name text, ok boolean);
grant all on check_results to public;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test');

insert into check_results select 'new profile starts with the sky avatar and no name',
  (select count(*) from public.profiles where avatar = 'sky' and display_name = '') = 2;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
update public.profiles set display_name = 'Sara', avatar = 'violet';
insert into check_results select 'A sees and changes only their own profile',
  (select count(*) from public.profiles) = 1 and (select avatar from public.profiles) = 'violet';

do $$ begin
  begin
    update public.profiles set avatar = 'neon';
    insert into check_results values ('an unknown avatar is refused', false);
  exception when check_violation then
    insert into check_results values ('an unknown avatar is refused', true);
  end;
  begin
    update public.profiles set display_name = repeat('x', 81);
    insert into check_results values ('a name over 80 characters is refused', false);
  exception when check_violation then
    insert into check_results values ('a name over 80 characters is refused', true);
  end;
end $$;

reset role;
insert into check_results select 'B profile was not changed by A',
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222') = ''
  and (select avatar from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 'sky';

set local role anon;
do $$ begin
  begin
    perform count(*) from public.profiles;
    insert into check_results values ('anon cannot read profiles', false);
  exception when insufficient_privilege then
    insert into check_results values ('anon cannot read profiles', true);
  end;
end $$;
reset role;

select name, ok from check_results order by name;
do $$ begin
  if exists (select 1 from check_results where not ok) then
    raise exception 'profile checks failed';
  end if;
end $$;
rollback;
