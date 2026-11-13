-- Checks for question_history() (M6): correct latest result and count, privacy, no anonymous access.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_history_check.sql
begin;
create temporary table check_results (name text, ok boolean);
grant all on check_results to public;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test');

insert into public.questions (id, user_id, qtype, stem, answer_spec) values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'true_false', 'Q1', '{"answer":true}'),
  ('c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'true_false', 'Q2', '{"answer":true}'),
  ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'true_false', 'Q3', '{"answer":true}'),
  ('c0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'true_false', 'Q4', '{"answer":true}');

-- Older session: Q1 wrong, Q2 wrong, Q3 skipped. Newer session: Q1 right. A third session is unfinished: Q4.
insert into public.attempts (id, user_id, kind, title, status, question_count, score, correct_count, wrong_count, unanswered_count, seconds_spent, started_at, submitted_at) values
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'practice', 'Old', 'submitted', 3, 0, 0, 2, 1, 60, now() - interval '2 days', now() - interval '2 days' + interval '1 minute'),
  ('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'practice', 'New', 'submitted', 1, 1, 1, 0, 0, 30, now() - interval '1 day', now() - interval '1 day' + interval '1 minute');
insert into public.attempts (id, user_id, kind, title, status, question_count, seconds_spent) values
  ('d0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'practice', 'Open', 'in_progress', 1, 0);
insert into public.attempt_items (attempt_id, user_id, position, question_id, snapshot, response, is_correct, marks, answered_at) values
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 0, 'c0000000-0000-0000-0000-000000000001', '{"stem":"Q1"}', '{"kind":"true_false","value":false}', false, 0, now() - interval '2 days'),
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1, 'c0000000-0000-0000-0000-000000000002', '{"stem":"Q2"}', '{"kind":"true_false","value":false}', false, 0, now() - interval '2 days'),
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 2, 'c0000000-0000-0000-0000-000000000003', '{"stem":"Q3"}', null, null, null, null),
  ('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 0, 'c0000000-0000-0000-0000-000000000001', '{"stem":"Q1"}', '{"kind":"true_false","value":true}', true, 1, now() - interval '1 day'),
  ('d0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 0, 'c0000000-0000-0000-0000-000000000004', '{"stem":"Q4"}', '{"kind":"true_false","value":true}', true, 1, now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into check_results select 'latest result and count are right',
  (select last_correct and times = 2 from public.question_history() where question_id = 'c0000000-0000-0000-0000-000000000001')
  and (select not last_correct and times = 1 from public.question_history() where question_id = 'c0000000-0000-0000-0000-000000000002');
insert into check_results select 'skipped and unfinished answers are left out',
  (select count(*) from public.question_history()) = 2;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into check_results select 'another student sees none of it', (select count(*) from public.question_history()) = 0;

reset role;
set local role anon;
do $$ begin
  begin
    perform * from public.question_history();
    insert into check_results values ('anon cannot run question_history', false);
  exception when insufficient_privilege then
    insert into check_results values ('anon cannot run question_history', true);
  end;
end $$;

reset role;
select name, ok from check_results order by ok, name;
do $$ begin
  if exists (select 1 from check_results where not ok) then raise exception 'history checks failed'; end if;
end $$;
rollback;
