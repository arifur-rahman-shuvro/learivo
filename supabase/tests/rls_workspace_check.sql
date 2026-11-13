-- Checks for the personal workspace (M4): privacy, cascade, one note per question, goal limits.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_workspace_check.sql
begin;
create temporary table check_results (name text, ok boolean);
grant all on check_results to public;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into public.questions (id, user_id, qtype, stem, answer_spec) values
  ('b0000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'true_false', 'Insulin lowers blood sugar.', '{"answer":true}');
insert into public.bookmarks (user_id, question_id)
  values ('11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000009');
insert into public.notes (user_id, question_id, body)
  values ('11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000009', 'Remember the mechanism.');
insert into public.notes (user_id, title, body)
  values ('11111111-1111-1111-1111-111111111111', 'Free note', 'Not tied to a question.');
insert into public.review_cards (user_id, question_id)
  values ('11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000009');
insert into check_results select 'A can create a bookmark, notes and a card',
  (select count(*) from public.bookmarks) = 1 and (select count(*) from public.notes) = 2
  and (select count(*) from public.review_cards) = 1;

-- A second note for the same question is refused; many free notes are fine.
do $$ begin
  begin
    insert into public.notes (user_id, question_id, body)
    values ('11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000009', 'second');
    insert into check_results values ('only one note per question', false);
  exception when unique_violation then
    insert into check_results values ('only one note per question', true);
  end;
end $$;
insert into public.notes (user_id, body) values ('11111111-1111-1111-1111-111111111111', 'Another free note');
insert into check_results select 'many free notes are allowed', (select count(*) from public.notes where question_id is null) = 2;

-- Empty notes and an out-of-range card are refused.
do $$ begin
  begin
    insert into public.notes (user_id, body) values ('11111111-1111-1111-1111-111111111111', '   ');
    insert into check_results values ('blank note refused', false);
  exception when check_violation then
    insert into check_results values ('blank note refused', true);
  end;
end $$;
do $$ begin
  begin
    update public.review_cards set difficulty = 11;
    insert into check_results values ('difficulty above 10 refused', false);
  exception when check_violation then
    insert into check_results values ('difficulty above 10 refused', true);
  end;
end $$;

-- Daily goal limits.
update public.user_preferences set daily_goal = 30 where user_id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  begin
    update public.user_preferences set daily_goal = 0 where user_id = '11111111-1111-1111-1111-111111111111';
    insert into check_results values ('daily goal of 0 refused', false);
  exception when check_violation then
    insert into check_results values ('daily goal of 0 refused', true);
  end;
end $$;

-- Student B sees nothing of A's and cannot attach anything to A's question.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into check_results select 'B sees no bookmarks', (select count(*) from public.bookmarks) = 0;
insert into check_results select 'B sees no notes', (select count(*) from public.notes) = 0;
insert into check_results select 'B sees no cards', (select count(*) from public.review_cards) = 0;
do $$ begin
  begin
    insert into public.bookmarks (user_id, question_id)
    values ('22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-000000000009');
    insert into check_results values ('B cannot bookmark A''s question', false);
  exception when others then
    insert into check_results values ('B cannot bookmark A''s question', true);
  end;
end $$;
do $$ begin
  begin
    insert into public.notes (user_id, question_id, body)
    values ('22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-000000000009', 'x');
    insert into check_results values ('B cannot note A''s question', false);
  exception when others then
    insert into check_results values ('B cannot note A''s question', true);
  end;
end $$;
do $$ begin
  begin
    insert into public.review_cards (user_id, question_id)
    values ('22222222-2222-2222-2222-222222222222', 'b0000000-0000-0000-0000-000000000009');
    insert into check_results values ('B cannot make a card for A''s question', false);
  exception when others then
    insert into check_results values ('B cannot make a card for A''s question', true);
  end;
end $$;
do $$ begin
  begin
    insert into public.bookmarks (user_id, question_id)
    values ('11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000009');
    insert into check_results values ('B cannot write rows as A', false);
  exception when others then
    insert into check_results values ('B cannot write rows as A', true);
  end;
end $$;
update public.notes set body = 'hacked';
delete from public.review_cards;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into check_results select 'B could not change or delete A''s rows',
  (select count(*) from public.notes where body = 'hacked') = 0
  and (select count(*) from public.review_cards) = 1;

-- Deleting a question removes its bookmark, note and card.
delete from public.questions where id = 'b0000000-0000-0000-0000-000000000009';
insert into check_results select 'deleting a question removes bookmark, note and card',
  (select count(*) from public.bookmarks) = 0
  and (select count(*) from public.notes where question_id is not null) = 0
  and (select count(*) from public.review_cards) = 0;
insert into check_results select 'free notes survive', (select count(*) from public.notes) = 2;

-- Home layout (M5): stored on the student's own row, size-limited, never visible to others.
update public.user_preferences set home_layout = '{"order":["goal","focus"],"hidden":["recent"]}'
  where user_id = '11111111-1111-1111-1111-111111111111';
insert into check_results select 'A can save a home layout',
  (select home_layout->'hidden' from public.user_preferences) = '["recent"]'::jsonb;
do $$ begin
  begin
    update public.user_preferences set home_layout = '[1]'::jsonb;
    insert into check_results values ('home layout must be an object', false);
  exception when check_violation then
    insert into check_results values ('home layout must be an object', true);
  end;
  begin
    update public.user_preferences set home_layout = jsonb_build_object('x', repeat('a', 5000));
    insert into check_results values ('home layout is size-limited', false);
  exception when check_violation then
    insert into check_results values ('home layout is size-limited', true);
  end;
end $$;

-- Signed-out visitors see nothing.
reset role;
set local role anon;
do $$ begin
  begin
    perform count(*) from public.bookmarks;
    insert into check_results values ('anon cannot read bookmarks', false);
  exception when insufficient_privilege then
    insert into check_results values ('anon cannot read bookmarks', true);
  end;
end $$;

reset role;
select name, ok from check_results order by ok, name;
do $$ begin
  if exists (select 1 from check_results where not ok) then
    raise exception 'workspace checks failed';
  end if;
end $$;
rollback;
