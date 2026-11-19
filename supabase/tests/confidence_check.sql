-- Checks for answer confidence and the richer question_history().
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/confidence_check.sql
begin;
create temporary table check_results (name text, ok boolean);
grant all on check_results to public;

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'a@example.test');
insert into public.questions (id, user_id, qtype, stem, answer_spec) values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'true_false', 'Q1', '{"options":[{"text":"o1","correct":true},{"text":"o2","correct":false},{"text":"o3","correct":true},{"text":"o4","correct":false},{"text":"o5","correct":false}]}');
insert into public.attempts (id, user_id, kind, title, status, question_count, started_at, submitted_at) values
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'practice', 'Old', 'submitted', 1, now() - interval '2 days', now() - interval '2 days'),
  ('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'practice', 'New', 'submitted', 1, now() - interval '1 day', now() - interval '1 day');
insert into public.attempt_items (attempt_id, user_id, position, question_id, snapshot, response, is_correct, mistake_reason, confidence, answered_at) values
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 0, 'c0000000-0000-0000-0000-000000000001', '{"stem":"Q1"}', '{"kind":"true_false","value":false}', false, 'careless', 'sure', now() - interval '2 days'),
  ('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 0, 'c0000000-0000-0000-0000-000000000001', '{"stem":"Q1"}', '{"kind":"true_false","value":false}', false, 'mixed_up', 'guess', now() - interval '1 day');

insert into check_results select 'history returns the latest reason and confidence',
  (select last_reason = 'mixed_up' and last_confidence = 'guess' and times = 2 from public.question_history() where question_id = 'c0000000-0000-0000-0000-000000000001');

do $$ begin
  begin
    update public.attempt_items set confidence = 'certain';
    insert into check_results values ('a made-up confidence is refused', false);
  exception when check_violation then
    insert into check_results values ('a made-up confidence is refused', true);
  end;
end $$;

set local role anon;
do $$ begin
  begin
    perform * from public.question_history();
    insert into check_results values ('anon still cannot run question_history', false);
  exception when insufficient_privilege then
    insert into check_results values ('anon still cannot run question_history', true);
  end;
end $$;
reset role;

select name, ok from check_results order by ok, name;
do $$ begin
  if exists (select 1 from check_results where not ok) then raise exception 'confidence checks failed'; end if;
end $$;
rollback;
