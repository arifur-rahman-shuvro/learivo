-- Checks for delete_my_account: removes only the caller and their data; signed-out cannot call.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/delete_account_check.sql
begin;
create temporary table check_results (name text, ok boolean);
grant all on check_results to public;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.delete_my_account();
reset role;

insert into check_results select 'A is gone',
  (select count(*) from auth.users where id = '11111111-1111-1111-1111-111111111111') = 0;
insert into check_results select 'A profile is gone with the account',
  (select count(*) from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 0;
insert into check_results select 'B and B profile are untouched',
  (select count(*) from auth.users) = 1 and (select count(*) from public.profiles) = 1;

set local role anon;
select set_config('request.jwt.claims', '', true);
do $$ begin
  begin
    perform public.delete_my_account();
    insert into check_results values ('signed-out call is refused', false);
  exception when others then
    insert into check_results values ('signed-out call is refused', true);
  end;
end $$;
reset role;

select name, ok from check_results order by name;
do $$ begin
  if exists (select 1 from check_results where not ok) then raise exception 'delete_account checks failed'; end if;
end $$;
rollback;
