-- Learivo M12: choice questions may have 2 to 5 options (or statements), no longer exactly 5.
-- Everything else about valid_answer_spec is unchanged from M7.

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
      and jsonb_array_length(spec -> 'options') between 2 and 5
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
