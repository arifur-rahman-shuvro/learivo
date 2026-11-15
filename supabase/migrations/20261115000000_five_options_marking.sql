-- Learivo M7: fixed five-option questions and partial-credit marking.
-- * short_answer is removed as a question type.
-- * sba / single_choice / multi_select / true_false carry exactly five options.
--   For true_false each option is a statement with its own key: correct = statement is true.
-- * attempt_items.credit (0..1) records partial credit; attempts.partial_count counts partly-right answers.

create or replace function public.valid_answer_spec(qtype text, spec jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(case
    when jsonb_typeof(spec) <> 'object' then false
    when qtype in ('sba', 'single_choice', 'multi_select', 'true_false') then
      jsonb_typeof(spec -> 'options') = 'array'
      and jsonb_array_length(spec -> 'options') = 5
      and (select bool_and(jsonb_typeof(o -> 'text') = 'string' and length(btrim(o ->> 'text')) > 0
                           and jsonb_typeof(o -> 'correct') = 'boolean')
             from jsonb_array_elements(spec -> 'options') o)
      and case
            when qtype in ('sba', 'single_choice') then
              (select count(*) from jsonb_array_elements(spec -> 'options') o
                 where o -> 'correct' = 'true'::jsonb) = 1
            when qtype = 'multi_select' then
              (select count(*) from jsonb_array_elements(spec -> 'options') o
                 where o -> 'correct' = 'true'::jsonb) >= 1
            else true
          end
    when qtype = 'fill_blank' then
      jsonb_typeof(spec -> 'blanks') = 'array'
      and jsonb_array_length(spec -> 'blanks') between 1 and 10
    else false
  end, false)
$$;

alter table public.questions drop constraint questions_qtype_check;
alter table public.questions add constraint questions_qtype_check
  check (qtype in ('sba', 'single_choice', 'multi_select', 'true_false', 'fill_blank')) not valid;
alter table public.questions validate constraint questions_qtype_check;

alter table public.attempt_items
  add column credit numeric(5, 4) check (credit between 0 and 1);
alter table public.attempts
  add column partial_count integer check (partial_count >= 0);
