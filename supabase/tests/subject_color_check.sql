-- Checks for the optional subject colour.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/subject_color_check.sql
begin;
create temporary table check_results (name text, ok boolean);
grant all on check_results to public;

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'a@example.test');
insert into public.taxonomy_nodes (id, user_id, kind, name) values
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'subject', 'Anatomy');

insert into check_results select 'a subject has no colour at first',
  (select color is null from public.taxonomy_nodes where name = 'Anatomy');

update public.taxonomy_nodes set color = 'teal' where name = 'Anatomy';
insert into check_results select 'a known colour is stored',
  (select color = 'teal' from public.taxonomy_nodes where name = 'Anatomy');

do $$ begin
  begin
    update public.taxonomy_nodes set color = 'chartreuse';
    insert into check_results values ('a made-up colour is refused', false);
  exception when check_violation then
    insert into check_results values ('a made-up colour is refused', true);
  end;
end $$;

select name, ok from check_results order by ok, name;
do $$ begin
  if exists (select 1 from check_results where not ok) then raise exception 'subject colour checks failed'; end if;
end $$;
rollback;
