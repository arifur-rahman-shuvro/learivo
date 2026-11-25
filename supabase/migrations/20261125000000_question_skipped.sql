-- Learivo: questions the student skipped, so they can be practised again like missed ones.
-- A question counts as skipped when its latest appearance in a finished session was left unanswered.
-- Answering it later (in any session) takes it off the list. Runs as the caller, so row-level
-- security limits it to the caller's own sessions.
create function public.question_skipped()
returns table (question_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select ai.question_id
  from public.attempt_items ai
  join public.attempts a on a.id = ai.attempt_id and a.user_id = ai.user_id
  where ai.question_id is not null
    and a.status = 'submitted'
  group by ai.question_id
  having (array_agg(ai.response is null order by a.started_at desc, ai.position desc))[1]
  order by ai.question_id
$$;

revoke execute on function public.question_skipped() from public, anon;
grant execute on function public.question_skipped() to authenticated;
