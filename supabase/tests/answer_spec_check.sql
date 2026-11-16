-- Checks for flexible option counts (M12).
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/answer_spec_check.sql
begin;
create temporary table check_results (name text, ok boolean);

create function pg_temp.opts(n int, correct_at int[]) returns jsonb language sql as $$
  select jsonb_build_object('options', jsonb_agg(jsonb_build_object('text', 'o' || i, 'correct', i = any(correct_at)) order by i))
  from generate_series(1, n) i
$$;

insert into check_results values
  ('sba with 2 options is accepted',  public.valid_answer_spec('sba', pg_temp.opts(2, '{1}'))),
  ('sba with 4 options is accepted',  public.valid_answer_spec('sba', pg_temp.opts(4, '{2}'))),
  ('sba with 5 options is accepted',  public.valid_answer_spec('sba', pg_temp.opts(5, '{5}'))),
  ('sba with 1 option is refused',    not public.valid_answer_spec('sba', pg_temp.opts(1, '{1}'))),
  ('sba with 6 options is refused',   not public.valid_answer_spec('sba', pg_temp.opts(6, '{1}'))),
  ('sba with two correct is refused', not public.valid_answer_spec('sba', pg_temp.opts(4, '{1,2}'))),
  ('multi_select with 5 options and 3 correct is accepted', public.valid_answer_spec('multi_select', pg_temp.opts(5, '{1,3,5}'))),
  ('multi_select with none correct is refused', not public.valid_answer_spec('multi_select', pg_temp.opts(4, '{}'))),
  ('true_false with 6 statements is refused', not public.valid_answer_spec('true_false', pg_temp.opts(6, '{1}'))),
  ('true_false with 3 statements is accepted', public.valid_answer_spec('true_false', pg_temp.opts(3, '{1}'))),
  ('true_false with 5 statements and none true is accepted', public.valid_answer_spec('true_false', pg_temp.opts(5, '{}')));

select name, case when ok then 'PASS' else 'FAIL' end as result from check_results order by ok, name;
do $$ begin
  if exists (select 1 from check_results where not ok) then raise exception 'answer spec checks failed'; end if;
end $$;
rollback;
