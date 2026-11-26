-- Structural security audit of everything in the public schema. It fails the build when a new
-- table, policy or function is added without the same protection the others have.
-- Run after all migrations: psql -v ON_ERROR_STOP=1 -f supabase/tests/schema_audit_check.sql
begin;

create temporary table check_results (name text, ok boolean);

-- 1. Every table has row-level security turned on, and at least one policy.
insert into check_results
select 'RLS on for ' || c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';

insert into check_results
select 'a policy exists for ' || c.relname,
  exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';

-- 2. Every policy is limited to signed-in students and to their own rows.
insert into check_results
select 'policy is own-rows only: ' || tablename || '.' || policyname,
  roles = '{authenticated}'::name[]
  and (qual is null or qual like '%auth.uid()%')
  and (with_check is null or with_check like '%auth.uid()%')
  and (qual is not null or with_check is not null)
from pg_policies where schemaname = 'public';

-- 3. Visitors who are not signed in have no table access at all.
insert into check_results
select 'anon has no grant on ' || table_name, false
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon';

-- 4. Every function pins its search path, and visitors cannot run any of them.
insert into check_results
select 'search_path pinned: ' || p.proname,
  coalesce(p.proconfig::text, '') like '%search_path%'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

insert into check_results
select 'anon cannot run ' || p.proname, not has_function_privilege('anon', p.oid, 'execute')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

-- 5. Functions that run with the owner's rights are an allow-list; a new one must be added here on purpose.
insert into check_results
select 'security definer function is expected: ' || p.proname,
  p.proname in ('delete_my_account', 'handle_new_user', 'questions_after_write', 'push_secret', 'push_secret_init')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef;

-- 6. Of those, only delete_my_account may be called by a signed-in student.
insert into check_results
select 'signed-in students cannot call ' || p.proname,
  not has_function_privilege('authenticated', p.oid, 'execute')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and p.proname <> 'delete_my_account';

select name, ok from check_results where not ok order by name;
select count(*) as checks from check_results;
do $$ begin
  if exists (select 1 from check_results where not ok) then raise exception 'schema audit failed'; end if;
  if (select count(*) from check_results) < 40 then raise exception 'schema audit ran too few checks'; end if;
end $$;
rollback;
