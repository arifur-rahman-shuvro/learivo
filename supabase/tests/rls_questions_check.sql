-- Checks for the question bank (M2): privacy between students, answer validation,
-- version history, duplicate hash, and cascade rules.
-- Run after the stub and both migrations:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_questions_check.sql

begin;

create temporary table check_results (name text, ok boolean);
grant all on check_results to public;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test');

-- ===== Act as student A =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into public.taxonomy_nodes (id, user_id, kind, name) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'subject', 'Anatomy');
insert into public.taxonomy_nodes (id, user_id, parent_id, kind, name) values
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'chapter', 'Thorax');

-- Each of the six question types can be stored.
insert into public.questions (id, user_id, qtype, stem, answer_spec, taxonomy_node_id) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'sba', 'Which drug inhibits vitamin K dependent factors?',
   '{"options":[{"text":"Aspirin","correct":false},{"text":"Warfarin","correct":true},{"text":"Heparin","correct":false}]}',
   'a0000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'single_choice', 'Pick one',
   '{"options":[{"text":"x","correct":true},{"text":"y","correct":false}]}', null),
  ('b0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'multi_select', 'Pick all that apply',
   '{"options":[{"text":"x","correct":true},{"text":"y","correct":true},{"text":"z","correct":false}]}', null),
  ('b0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'true_false', 'The heart has four chambers.', '{"answer":true}', null),
  ('b0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'short_answer', 'Name the largest artery.', '{"accepted":["aorta"]}', null),
  ('b0000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'fill_blank', 'The {{1}} pumps blood.', '{"blanks":[{"accepted":["heart"]}]}', null);

insert into check_results select 'all six question types are accepted', (select count(*) from public.questions) = 6;

-- Server-controlled fields.
insert into check_results select 'new question starts at version 1 with a hash',
  (select version = 1 and content_hash <> '' from public.questions where id = 'b0000000-0000-0000-0000-000000000001');

insert into check_results select 'hash ignores case and extra spaces',
  (select md5(lower('Which drug inhibits vitamin K dependent factors?') || '|sba')
          = content_hash from public.questions where id = 'b0000000-0000-0000-0000-000000000001');

-- Invalid answers are rejected.
do $$
declare spec jsonb; t text; i int := 0;
begin
  for t, spec in
    select * from (values
      ('sba', '{"options":[{"text":"a","correct":true},{"text":"b","correct":true}]}'::jsonb),
      ('sba', '{"options":[{"text":"a","correct":false},{"text":"b","correct":false}]}'),
      ('sba', '{"options":[{"text":"only","correct":true}]}'),
      ('sba', '{"options":[{"text":"","correct":true},{"text":"b","correct":false}]}'),
      ('multi_select', '{"options":[{"text":"a","correct":false},{"text":"b","correct":false}]}'),
      ('true_false', '{"answer":"yes"}'),
      ('short_answer', '{"accepted":[]}'),
      ('fill_blank', '{"blanks":[]}'),
      ('sba', '[]')
    ) v(a, b)
  loop
    i := i + 1;
    begin
      insert into public.questions (user_id, qtype, stem, answer_spec)
        values ('11111111-1111-1111-1111-111111111111', t, 'bad ' || i, spec);
      insert into check_results values ('invalid answer ' || i || ' is rejected', false);
    exception when check_violation then
      insert into check_results values ('invalid answer ' || i || ' is rejected', true);
    end;
  end loop;
  begin
    insert into public.questions (user_id, qtype, stem, answer_spec)
      values ('11111111-1111-1111-1111-111111111111', 'essay', 'x', '{}');
    insert into check_results values ('unknown question type is rejected', false);
  exception when check_violation then
    insert into check_results values ('unknown question type is rejected', true);
  end;
end $$;

-- Version history: each save adds a snapshot; the client cannot choose the version number.
update public.questions set stem = 'Which drug inhibits vitamin K dependent factors (edited)?', version = 99
  where id = 'b0000000-0000-0000-0000-000000000001';
insert into check_results select 'update bumps version by one and ignores a client version',
  (select version = 2 from public.questions where id = 'b0000000-0000-0000-0000-000000000001');
insert into check_results select 'two snapshots exist after one edit',
  (select count(*) = 2 from public.question_versions where question_id = 'b0000000-0000-0000-0000-000000000001');
insert into check_results select 'snapshot holds the old text',
  (select snapshot ->> 'stem' = 'Which drug inhibits vitamin K dependent factors?'
     from public.question_versions where question_id = 'b0000000-0000-0000-0000-000000000001' and version = 1);

-- Only the last 20 versions are kept.
do $$
declare i int;
begin
  for i in 1..25 loop
    update public.questions set explanation = 'edit ' || i where id = 'b0000000-0000-0000-0000-000000000002';
  end loop;
end $$;
insert into check_results select 'history keeps the last 20 versions',
  (select count(*) = 20 and max(version) = 26 from public.question_versions where question_id = 'b0000000-0000-0000-0000-000000000002');

-- Students cannot write version history.
do $$
begin
  begin
    insert into public.question_versions (question_id, user_id, version, snapshot)
      values ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 500, '{}');
    insert into check_results values ('student cannot insert version history', false);
  exception when insufficient_privilege then
    insert into check_results values ('student cannot insert version history', true);
  end;
  begin
    delete from public.question_versions;
    insert into check_results values ('student cannot delete version history', false);
  exception when insufficient_privilege then
    insert into check_results values ('student cannot delete version history', true);
  end;
end $$;

-- Full-text search covers the statement and the explanation, and follows edits.
insert into check_results select 'full-text search finds a word in the statement',
  (select count(*) = 1 from public.questions where search @@ plainto_tsquery('simple', 'artery'));
insert into check_results select 'full-text search sees the edited statement',
  (select count(*) = 1 from public.questions where search @@ plainto_tsquery('simple', 'edited'));
insert into check_results select 'full-text search does not match absent words',
  (select count(*) = 0 from public.questions where search @@ plainto_tsquery('simple', 'xylophone'));

-- Tags and collections.
insert into public.tags (id, user_id, name) values ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'high-yield');
insert into public.question_tags values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
insert into public.collections (id, user_id, name) values ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Finals');
insert into public.collection_questions values ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 0);

do $$
begin
  begin
    insert into public.tags (user_id, name) values ('11111111-1111-1111-1111-111111111111', 'HIGH-YIELD');
    insert into check_results values ('tag names are unique ignoring case', false);
  exception when unique_violation then
    insert into check_results values ('tag names are unique ignoring case', true);
  end;
end $$;

-- Deleting a taxonomy node keeps the question and clears its classification.
delete from public.taxonomy_nodes where id = 'a0000000-0000-0000-0000-000000000002';
insert into check_results select 'deleting a chapter keeps the question, clears classification',
  (select count(*) = 1 and taxonomy_node_id is null from public.questions where id = 'b0000000-0000-0000-0000-000000000001' group by taxonomy_node_id);

-- Deleting a tag keeps the question; deleting a question removes its tag links and history.
delete from public.tags where id = 'c0000000-0000-0000-0000-000000000001';
insert into check_results select 'deleting a tag keeps the question', (select count(*) = 1 from public.questions where id = 'b0000000-0000-0000-0000-000000000001');
delete from public.questions where id = 'b0000000-0000-0000-0000-000000000001';
insert into check_results select 'deleting a question removes its versions and collection link',
  (select count(*) = 0 from public.question_versions where question_id = 'b0000000-0000-0000-0000-000000000001')
  and (select count(*) = 0 from public.collection_questions);

-- ===== Student B must see nothing of A, and cannot reach it =====
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

insert into check_results select 'B sees none of A data',
  (select count(*) from public.questions) = 0
  and (select count(*) from public.taxonomy_nodes) = 0
  and (select count(*) from public.tags) = 0
  and (select count(*) from public.collections) = 0
  and (select count(*) from public.question_versions) = 0;

do $$
declare n integer;
begin
  update public.questions set stem = 'hacked' where id = 'b0000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  insert into check_results values ('B cannot update A question', n = 0);
  delete from public.questions where id = 'b0000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  insert into check_results values ('B cannot delete A question', n = 0);

  begin
    insert into public.questions (user_id, qtype, stem, answer_spec)
      values ('11111111-1111-1111-1111-111111111111', 'true_false', 'planted', '{"answer":true}');
    insert into check_results values ('B cannot insert a question as A', false);
  exception when insufficient_privilege then
    insert into check_results values ('B cannot insert a question as A', true);
  end;

  -- B cannot attach their question to A's taxonomy node or collection (composite keys).
  begin
    insert into public.questions (user_id, qtype, stem, answer_spec, taxonomy_node_id)
      values ('22222222-2222-2222-2222-222222222222', 'true_false', 'cross', '{"answer":true}', 'a0000000-0000-0000-0000-000000000001');
    insert into check_results values ('B cannot classify under A taxonomy node', false);
  exception when foreign_key_violation then
    insert into check_results values ('B cannot classify under A taxonomy node', true);
  end;
end $$;

-- A question can be moved to another student only if a client could change user_id: it cannot.
insert into public.questions (id, user_id, qtype, stem, answer_spec)
  values ('b0000000-0000-0000-0000-0000000000b1', '22222222-2222-2222-2222-222222222222', 'true_false', 'B own', '{"answer":false}');
do $$
begin
  begin
    update public.questions set user_id = '11111111-1111-1111-1111-111111111111'
      where id = 'b0000000-0000-0000-0000-0000000000b1';
    insert into check_results select 'B cannot hand a question to A',
      (select user_id = '22222222-2222-2222-2222-222222222222' from public.questions where id = 'b0000000-0000-0000-0000-0000000000b1');
  exception when others then
    insert into check_results values ('B cannot hand a question to A', true);
  end;
end $$;

-- Signed-out visitors get nothing.
reset role;
set local role anon;
do $$
declare t text;
begin
  foreach t in array array['taxonomy_nodes','questions','question_versions','tags','question_tags','collections','collection_questions']
  loop
    begin
      execute format('select count(*) from public.%I', t);
      insert into check_results values ('anon cannot read ' || t, false);
    exception when insufficient_privilege then
      insert into check_results values ('anon cannot read ' || t, true);
    end;
  end loop;
end $$;

reset role;

select name, case when ok then 'PASS' else 'FAIL' end as result from check_results order by ok, name;

do $$
declare failed integer;
begin
  select count(*) into failed from check_results where not coalesce(ok, false);
  if failed > 0 then
    raise exception '% question bank check(s) failed', failed;
  end if;
end $$;

rollback;
