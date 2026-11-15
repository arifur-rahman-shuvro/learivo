-- Checks for flashcards and glossary (M10): privacy, limits, unique terms, anon denied.
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_cards_check.sql
begin;
create temporary table check_results (name text, ok boolean);
grant all on check_results to public;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into public.flashcards (user_id, front, back) values ('11111111-1111-1111-1111-111111111111', 'Heart chambers?', 'Four');
insert into public.glossary_terms (user_id, term, definition) values ('11111111-1111-1111-1111-111111111111', 'Systole', 'Contraction phase');
insert into check_results select 'A can create a flashcard and a term',
  (select count(*) from public.flashcards) = 1 and (select count(*) from public.glossary_terms) = 1;

do $$ begin
  begin
    insert into public.glossary_terms (user_id, term, definition) values ('11111111-1111-1111-1111-111111111111', '  SYSTOLE ', 'again');
    insert into check_results values ('a term name is unique ignoring case and spaces', false);
  exception when unique_violation then
    insert into check_results values ('a term name is unique ignoring case and spaces', true);
  end;
  begin
    insert into public.flashcards (user_id, front, back) values ('11111111-1111-1111-1111-111111111111', '   ', 'x');
    insert into check_results values ('a blank card front is refused', false);
  exception when check_violation then
    insert into check_results values ('a blank card front is refused', true);
  end;
  begin
    insert into public.flashcards (user_id, front, back, difficulty) values ('11111111-1111-1111-1111-111111111111', 'f', 'b', 11);
    insert into check_results values ('card difficulty above 10 is refused', false);
  exception when check_violation then
    insert into check_results values ('card difficulty above 10 is refused', true);
  end;
  begin
    insert into public.flashcards (user_id, front, back, state) values ('11111111-1111-1111-1111-111111111111', 'f', 'b', 'weird');
    insert into check_results values ('unknown card state is refused', false);
  exception when check_violation then
    insert into check_results values ('unknown card state is refused', true);
  end;
end $$;

-- B cannot see or touch A's rows, nor write as A.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into check_results select 'B sees none of A cards or terms',
  (select count(*) from public.flashcards) = 0 and (select count(*) from public.glossary_terms) = 0;
update public.flashcards set back = 'hacked';
delete from public.glossary_terms;
do $$ begin
  begin
    insert into public.flashcards (user_id, front, back) values ('11111111-1111-1111-1111-111111111111', 'f', 'b');
    insert into check_results values ('B cannot insert a card as A', false);
  exception when insufficient_privilege then
    insert into check_results values ('B cannot insert a card as A', true);
  end;
end $$;

reset role;
insert into check_results select 'B changed and deleted nothing of A',
  (select back from public.flashcards) = 'Four' and (select count(*) from public.glossary_terms) = 1;

set local role anon;
do $$ begin
  begin
    perform count(*) from public.flashcards;
    insert into check_results values ('anon cannot read flashcards', false);
  exception when insufficient_privilege then
    insert into check_results values ('anon cannot read flashcards', true);
  end;
  begin
    perform count(*) from public.glossary_terms;
    insert into check_results values ('anon cannot read glossary_terms', false);
  exception when insufficient_privilege then
    insert into check_results values ('anon cannot read glossary_terms', true);
  end;
end $$;
reset role;

delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
insert into check_results select 'deleting the student removes cards and terms',
  (select count(*) from public.flashcards) = 0 and (select count(*) from public.glossary_terms) = 0;

select name, case when ok then 'PASS' else 'FAIL' end as result from check_results order by ok, name;
do $$ begin
  if exists (select 1 from check_results where not ok) then raise exception 'flashcard and glossary checks failed'; end if;
end $$;
rollback;
