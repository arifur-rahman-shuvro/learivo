-- M6: keep Insights and practice filters fast for large histories (found in the Phase 8 load test).
--
-- 1. The "latest answers" query orders by answered_at; without an index it read every answer.
create index attempt_items_answered
  on public.attempt_items (user_id, answered_at desc)
  where is_correct is not null and response is not null;

-- 2. One row per question with its latest result and how many times it was answered, worked out
--    in the database instead of downloading every answer. Runs as the caller, so row-level
--    security still limits it to the signed-in student's own answers.
create function public.question_history()
returns table (question_id uuid, last_correct boolean, times integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select ai.question_id,
         (array_agg(ai.is_correct order by a.started_at desc, ai.position desc))[1],
         count(*)::integer
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
