-- Checks for push notifications: privacy, limits, server-only functions, and that push_facts()
-- reports the right real numbers (streak, today, due cards, weakest subject, usual hour, ignored).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/push_check.sql
begin;
create temporary table check_results (name text, ok boolean);
grant all on check_results to public;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'c@example.test');
update public.profiles set time_zone = 'Asia/Dhaka', display_name = 'Rahim'
  where id = '11111111-1111-1111-1111-111111111111';
insert into public.user_preferences (user_id, daily_goal, exam_date, exam_title)
  values ('11111111-1111-1111-1111-111111111111', 10, '2026-12-02', 'Final')
  on conflict (user_id) do update set daily_goal = 10, exam_date = '2026-12-02', exam_title = 'Final';

-- A: push on with a device. B: push on but no device. C: device but push off.
insert into public.push_settings (user_id, enabled) values
  ('11111111-1111-1111-1111-111111111111', true),
  ('22222222-2222-2222-2222-222222222222', true),
  ('33333333-3333-3333-3333-333333333333', false);
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('11111111-1111-1111-1111-111111111111', 'https://push.example.test/a', 'BPubKeyPubKeyPubKey', 'AuthAuthAuthAuth'),
  ('33333333-3333-3333-3333-333333333333', 'https://push.example.test/c', 'BPubKeyPubKeyPubKey', 'AuthAuthAuthAuth');

-- A's subjects: Renal (with a chapter) and Cardio.
insert into public.taxonomy_nodes (id, user_id, parent_id, kind, name) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', null, 'subject', 'Renal'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'chapter', 'Glomerulus'),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', null, 'subject', 'Cardio');
insert into public.questions (id, user_id, qtype, stem, answer_spec, taxonomy_node_id) values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'true_false', 'R', '{"options":[{"text":"o1","correct":true},{"text":"o2","correct":false},{"text":"o3","correct":true},{"text":"o4","correct":false},{"text":"o5","correct":false}]}', 'a0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'true_false', 'C', '{"options":[{"text":"o1","correct":true},{"text":"o2","correct":false},{"text":"o3","correct":true},{"text":"o4","correct":false},{"text":"o5","correct":false}]}', 'a0000000-0000-0000-0000-000000000003');

-- "Now" is 18:00 in Dhaka. Sessions on each of the three days before, none today.
-- Day 1 back: 12 Renal answers (6 full, 6 none) and 10 Cardio answers, all full. Days 2 and 3: one answer each.
insert into public.attempts (id, user_id, kind, title, status, question_count, score, correct_count, wrong_count, unanswered_count, seconds_spent, started_at, submitted_at) values
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'practice', 'D1', 'submitted', 22, 16, 16, 6, 0, 60, timestamptz '2026-11-24 12:00+00', timestamptz '2026-11-24 12:10+00'),
  ('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'practice', 'D2', 'submitted', 1, 1, 1, 0, 0, 60, timestamptz '2026-11-23 12:00+00', timestamptz '2026-11-23 12:10+00'),
  ('d0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'practice', 'D3', 'submitted', 1, 1, 1, 0, 0, 60, timestamptz '2026-11-22 12:00+00', timestamptz '2026-11-22 12:10+00');
insert into public.attempt_items (attempt_id, user_id, position, question_id, snapshot, response, credit)
select 'd0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', g,
       case when g < 12 then 'c0000000-0000-0000-0000-000000000001'::uuid else 'c0000000-0000-0000-0000-000000000002'::uuid end,
       '{"stem":"x"}', '{"kind":"true_false","value":true}',
       case when g < 12 and g % 2 = 1 then 0 else 1 end
from generate_series(0, 21) g;
insert into public.attempt_items (attempt_id, user_id, position, question_id, snapshot, response, credit) values
  ('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 0, 'c0000000-0000-0000-0000-000000000002', '{"stem":"x"}', '{"kind":"true_false","value":true}', 1),
  ('d0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 0, 'c0000000-0000-0000-0000-000000000002', '{"stem":"x"}', '{"kind":"true_false","value":true}', 1);

-- One revision card and one flashcard are due; one flashcard is not.
insert into public.review_cards (user_id, question_id, due) values
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000001', timestamptz '2026-11-25 10:00+00');
insert into public.flashcards (user_id, front, back, due) values
  ('11111111-1111-1111-1111-111111111111', 'f1', 'b1', timestamptz '2026-11-25 09:00+00'),
  ('11111111-1111-1111-1111-111111111111', 'f2', 'b2', timestamptz '2026-12-25 09:00+00');

-- One message went out three hours ago and was not opened.
insert into public.push_log (user_id, kind, title, body, sent_at) values
  ('11111111-1111-1111-1111-111111111111', 'daily', 't', 'b', timestamptz '2026-11-25 09:00+00');

-- ---- facts (run as the server: no row-level security)
create temporary table f as select * from public.push_facts(timestamptz '2026-11-25 12:00+00');
grant all on f to public;
insert into check_results select 'only students with push on and a device are listed',
  (select count(*) from f) = 1 and (select user_id from f) = '11111111-1111-1111-1111-111111111111';
insert into check_results select 'local time follows the time zone', (select local_now from f) = timestamp '2026-11-25 18:00';
insert into check_results select 'streak counts the days in a row ending yesterday', (select streak from f) = 3;
insert into check_results select 'nothing answered today, one day away',
  (select answered_today from f) = 0 and (select days_away from f) = 1;
insert into check_results select 'goal, exam and name come from the account',
  (select daily_goal from f) = 10 and (select exam_date from f) = date '2026-12-02'
  and (select exam_title from f) = 'Final' and (select display_name from f) = 'Rahim';
insert into check_results select 'due revision cards and flashcards are added', (select due_cards from f) = 2;
insert into check_results select 'weakest subject is the top subject of the chapter, with its percent',
  (select weak_subject from f) = 'Renal' and (select weak_percent from f) = 50;
insert into check_results select 'usual study hour is found in the student''s time', (select best_hour from f) = 18;
insert into check_results select 'what was sent today and the unopened count are reported',
  (select sent_today from f) = 1 and (select sent_kinds_today from f) = '{daily}' and (select ignored_in_a_row from f) = 1;
insert into check_results select 'total answers counted', (select total_answers from f) = 24;

-- Exam subjects narrow the weak subject to the chosen ones.
update public.user_preferences set exam_subjects = '{Cardio}' where user_id = '11111111-1111-1111-1111-111111111111';
insert into check_results select 'weak subject respects the exam subjects',
  (select weak_subject from public.push_facts(timestamptz '2026-11-25 12:00+00')) = 'Cardio';

-- An answer today moves the streak and the count; opening the message clears the ignored count.
insert into public.attempts (id, user_id, kind, title, status, question_count, score, correct_count, wrong_count, unanswered_count, seconds_spent, started_at, submitted_at)
  values ('d0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'practice', 'T', 'submitted', 2, 1, 1, 0, 1, 60, timestamptz '2026-11-25 11:00+00', timestamptz '2026-11-25 11:05+00');
insert into public.attempt_items (attempt_id, user_id, position, question_id, snapshot, response, credit) values
  ('d0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 0, 'c0000000-0000-0000-0000-000000000002', '{"stem":"x"}', '{"kind":"true_false","value":true}', 1),
  ('d0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 1, 'c0000000-0000-0000-0000-000000000002', '{"stem":"x"}', null, 0);
update public.push_log set clicked_at = timestamptz '2026-11-25 09:05+00';
insert into check_results select 'today counts answers only, and the streak includes today',
  (select answered_today from public.push_facts(timestamptz '2026-11-25 12:00+00')) = 1
  and (select streak from public.push_facts(timestamptz '2026-11-25 12:00+00')) = 4
  and (select days_away from public.push_facts(timestamptz '2026-11-25 12:00+00')) = 0;
insert into check_results select 'an opened message resets the ignored count',
  (select ignored_in_a_row from public.push_facts(timestamptz '2026-11-25 12:00+00')) = 0;

-- A gap ends the streak.
insert into check_results select 'two days later with no answers the streak is gone',
  (select streak from public.push_facts(timestamptz '2026-11-28 12:00+00')) = 0
  and (select days_away from public.push_facts(timestamptz '2026-11-28 12:00+00')) = 3;

-- ---- secrets: created once, read back, server only
insert into check_results select 'the schedule secret exists and is long', length(public.push_secret('cron')) >= 40;
insert into check_results select 'a secret is created once and the first value wins',
  public.push_secret_init('t', 'one') = 'one' and public.push_secret_init('t', 'two') = 'one';

-- ---- students: own rows only
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into check_results select 'A sees own device, settings and log',
  (select count(*) from public.push_subscriptions) = 1 and (select count(*) from public.push_settings) = 1
  and (select count(*) from public.push_log) = 1;
do $$ begin
  begin
    insert into public.push_log (user_id, kind) values ('11111111-1111-1111-1111-111111111111', 'x');
    insert into check_results values ('a student cannot write the log', false);
  exception when others then
    insert into check_results values ('a student cannot write the log', true);
  end;
  begin
    insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('22222222-2222-2222-2222-222222222222', 'https://push.example.test/x', 'BPubKeyPubKeyPubKey', 'AuthAuthAuthAuth');
    insert into check_results values ('a student cannot add a device for someone else', false);
  exception when others then
    insert into check_results values ('a student cannot add a device for someone else', true);
  end;
  begin
    update public.push_settings set max_per_day = 9;
    insert into check_results values ('daily cap above 4 is refused', false);
  exception when check_violation then
    insert into check_results values ('daily cap above 4 is refused', true);
  end;
  begin
    update public.push_settings set tone = 'rude';
    insert into check_results values ('an unknown voice is refused', false);
  exception when check_violation then
    insert into check_results values ('an unknown voice is refused', true);
  end;
  begin
    perform * from public.push_facts();
    insert into check_results values ('a student cannot run push_facts', false);
  exception when insufficient_privilege then
    insert into check_results values ('a student cannot run push_facts', true);
  end;
  begin
    perform public.push_secret('cron');
    insert into check_results values ('a student cannot read secrets', false);
  exception when insufficient_privilege then
    insert into check_results values ('a student cannot read secrets', true);
  end;
end $$;
update public.push_log set clicked_at = now(), action = 'open';
insert into check_results select 'a student can mark a message opened', (select action from public.push_log) = 'open';

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into check_results select 'B sees none of A''s push data',
  (select count(*) from public.push_subscriptions) = 0 and (select count(*) from public.push_log) = 0
  and (select count(*) from public.push_settings) = 1
  and (select user_id from public.push_settings) = '22222222-2222-2222-2222-222222222222';
update public.push_settings set enabled = false where user_id = '11111111-1111-1111-1111-111111111111';
reset role;
insert into check_results select 'B cannot change A''s settings',
  (select enabled from public.push_settings where user_id = '11111111-1111-1111-1111-111111111111');

-- ---- visitors: nothing
set local role anon;
do $$ begin
  begin
    perform count(*) from public.push_subscriptions;
    insert into check_results values ('anon cannot read devices', false);
  exception when insufficient_privilege then
    insert into check_results values ('anon cannot read devices', true);
  end;
  begin
    perform * from public.push_facts();
    insert into check_results values ('anon cannot run push_facts', false);
  exception when insufficient_privilege then
    insert into check_results values ('anon cannot run push_facts', true);
  end;
end $$;

reset role;
select name, ok from check_results order by ok, name;
do $$ begin
  if exists (select 1 from check_results where not ok) then raise exception 'push checks failed'; end if;
end $$;
rollback;
