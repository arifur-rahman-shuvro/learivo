-- Learivo M15: how sure the student was about each answer, and a richer question_history().
-- confidence: sure, unsure or guess; null when the student did not say.
alter table public.attempt_items
  add column confidence text
  check (confidence in ('sure', 'unsure', 'guess'));

-- question_history() now also returns the reason and the confidence given on the latest answer,
-- so the app can group missed questions by reason and find shaky or over-confident ones.
-- The result type changes, so the function is dropped and made again with the same access rules.
drop function public.question_history();
create function public.question_history()
returns table (
  question_id uuid,
  last_correct boolean,
  times integer,
  last_reason text,
  last_confidence text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select ai.question_id,
         (array_agg(ai.is_correct order by a.started_at desc, ai.position desc))[1],
         count(*)::integer,
         (array_agg(ai.mistake_reason order by a.started_at desc, ai.position desc))[1],
         (array_agg(ai.confidence order by a.started_at desc, ai.position desc))[1]
  from public.attempt_items ai
  join public.attempts a on a.id = ai.attempt_id and a.user_id = ai.user_id
  where ai.question_id is not null
    and ai.is_correct is not null
    and ai.response is not null
    and a.status = 'submitted'
  group by ai.question_id
  order by ai.question_id
$$;

revoke execute on function public.question_history() from public, anon;
grant execute on function public.question_history() to authenticated;
