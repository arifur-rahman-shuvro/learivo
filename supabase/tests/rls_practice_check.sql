-- Checks for practice and exams (M3): privacy, cascade, snapshots survive question deletion.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_practice_check.sql
begin;
create temporary table check_results (name text, ok boolean);
grant all on check_results to public;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into public.questions (id, user_id, qtype, stem, answer_spec) values
  ('b0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'true_false', 'The heart has four chambers.', '{"answer":true}');
insert into public.exams (id, user_id, title) values
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Midterm');
insert into public.attempts (id, user_id, kind, exam_id, title, question_count) values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'exam', 'e0000000-0000-0000-0000-000000000001', 'Midterm', 1);
insert into public.attempt_items (attempt_id, user_id, position, question_id, snapshot) values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 0, 'b0000000-0000-0000-0000-000000000004', '{"stem":"The heart has four chambers."}');
insert into check_results select 'student A can create an exam, attempt and item', (select count(*) from public.attempt_items) = 1;

-- Student B sees nothing and cannot write into A's attempt.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into check_results select 'B sees no exams', (select count(*) from public.exams) = 0;
insert into check_results select 'B sees no attempts', (select count(*) from public.attempts) = 0;
insert into check_results select 'B sees no items', (select count(*) from public.attempt_items) = 0;
do $$ begin
  begin
    insert into public.attempt_items (attempt_id, user_id, position, snapshot)
    values ('c0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 1, '{}');
    insert into check_results values ('B cannot add an item to A''s attempt', false);
  exception when others then
    insert into check_results values ('B cannot add an item to A''s attempt', true);
  end;
end $$;
do $$ begin
  begin
    insert into public.attempts (user_id, kind, title, question_count) values ('11111111-1111-1111-1111-111111111111', 'practice', 'x', 1);
    insert into check_results values ('B cannot insert a row as A', false);
  exception when others then
    insert into check_results values ('B cannot insert a row as A', true);
  end;
end $$;
update public.attempts set title = 'hacked';
insert into check_results select 'B update touches nothing', true;

-- Back to A: the snapshot survives deleting the question; submitted needs a timestamp.
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into check_results select 'A title unchanged', (select title from public.attempts) = 'Midterm';
delete from public.questions where id = 'b0000000-0000-0000-0000-000000000004';
insert into check_results select 'item survives question deletion with snapshot',
  (select question_id is null and snapshot ->> 'stem' <> '' from public.attempt_items);
do $$ begin
  begin
    update public.attempts set status = 'submitted';
    insert into check_results values ('submitted without timestamp is refused', false);
  exception when others then
    insert into check_results values ('submitted without timestamp is refused', true);
  end;
end $$;
delete from public.exams;
insert into check_results select 'deleting an exam keeps the attempt', (select count(*) from public.attempts where exam_id is null) = 1;
delete from public.attempts;
insert into check_results select 'deleting an attempt removes its items', (select count(*) from public.attempt_items) = 0;

reset role;
select name, ok from check_results order by ok, name;
do $$ begin
  if exists (select 1 from check_results where not ok) then raise exception 'practice checks failed'; end if;
end $$;
rollback;
