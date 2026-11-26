-- Learivo push notifications (the "Coach"): device subscriptions, student settings, a send log,
-- a function that gathers each student's real numbers, and a private place for server secrets.
-- Everything a student can touch is limited to their own rows. The facts function and the secret
-- functions are for the server only (service role): visitors and signed-in students cannot run them.

-- ---------------------------------------------------------------------------------------------
-- Private place for server secrets (not exposed through the API: the schema is not public).
-- ---------------------------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.push_secrets (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
revoke all on private.push_secrets from public, anon, authenticated;

-- The schedule proves itself to the sender with this secret. It is made here, never shown.
insert into private.push_secrets (name, value)
values ('cron', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict do nothing;

-- Read a secret. Server only.
create function public.push_secret(p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select value from private.push_secrets where name = p_name
$$;

-- Create the secret if it does not exist yet, and return whichever value is stored. Two servers
-- racing at the same moment both get the same value. Server only.
create function public.push_secret_init(p_name text, p_candidate text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.push_secrets (name, value) values (p_name, p_candidate)
  on conflict (name) do nothing;
  return (select value from private.push_secrets where name = p_name);
end;
$$;

revoke execute on function public.push_secret(text) from public, anon, authenticated;
revoke execute on function public.push_secret_init(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Device subscriptions: one row per browser or phone that agreed to receive pushes.
-- ---------------------------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 10 and 2048),
  p256dh text not null check (char_length(p256dh) between 10 and 200),
  auth text not null check (char_length(auth) between 10 and 100),
  user_agent text not null default '' check (char_length(user_agent) <= 300),
  failures integer not null default 0 check (failures >= 0),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------------------------
-- Settings: off until the student turns it on.
-- ---------------------------------------------------------------------------------------------
create table public.push_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  tone text not null default 'mix' check (tone in ('mix', 'motivating', 'funny', 'firm')),
  study_time time not null default '18:00',
  quiet_start time not null default '22:00',
  quiet_end time not null default '07:00',
  -- Which kinds are turned OFF, as {"revision": false}. Missing means on.
  kinds jsonb not null default '{}'::jsonb
    check (jsonb_typeof(kinds) = 'object' and pg_column_size(kinds) <= 1024),
  max_per_day smallint not null default 2 check (max_per_day between 1 and 4),
  snooze_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_settings enable row level security;
revoke all on public.push_settings from anon;
create policy push_settings_own on public.push_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Log of what was sent: stops repeats, caps the daily number, and shows what was ignored.
-- Only the server adds rows; the student can read them and mark them opened.
-- ---------------------------------------------------------------------------------------------
create table public.push_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 40),
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 500),
  sent_at timestamptz not null default now(),
  clicked_at timestamptz,
  action text check (action is null or char_length(action) <= 40)
);
alter table public.push_log enable row level security;
revoke all on public.push_log from anon;
revoke insert, delete on public.push_log from authenticated;
create policy push_log_read on public.push_log
  for select to authenticated using (user_id = auth.uid());
create policy push_log_mark on public.push_log
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create index push_log_user_sent_idx on public.push_log (user_id, sent_at desc);

-- ---------------------------------------------------------------------------------------------
-- Facts: for every student with push turned on and at least one device, the real numbers the
-- coach decides with. Server only. Days are the student's own days (their time zone).
-- ---------------------------------------------------------------------------------------------
create function public.push_facts(p_now timestamptz default now())
returns table (
  user_id uuid,
  time_zone text,
  local_now timestamp,
  tone text,
  study_time time,
  quiet_start time,
  quiet_end time,
  kinds jsonb,
  max_per_day smallint,
  snooze_until timestamptz,
  display_name text,
  daily_goal integer,
  answered_today integer,
  streak integer,
  days_away integer,
  due_cards integer,
  exam_date date,
  exam_title text,
  weak_subject text,
  weak_percent integer,
  week_answered integer,
  week_percent integer,
  prev_week_percent integer,
  best_hour integer,
  sent_today integer,
  sent_kinds_today text[],
  recent_kinds text[],
  last_sent_at timestamptz,
  ignored_in_a_row integer,
  total_answers integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with people as (
    select s.user_id,
           coalesce(nullif(pr.time_zone, ''), 'UTC') as tz,
           s.tone, s.study_time, s.quiet_start, s.quiet_end, s.kinds, s.max_per_day, s.snooze_until,
           pr.display_name, up.daily_goal, up.exam_date, up.exam_title, up.exam_subjects
    from public.push_settings s
    join public.profiles pr on pr.id = s.user_id
    left join public.user_preferences up on up.user_id = s.user_id
    where s.enabled
      and exists (select 1 from public.push_subscriptions d where d.user_id = s.user_id and d.failures < 5)
  )
  select
    p.user_id,
    p.tz,
    (p_now at time zone p.tz) as local_now,
    p.tone, p.study_time, p.quiet_start, p.quiet_end, p.kinds, p.max_per_day, p.snooze_until,
    p.display_name,
    coalesce(p.daily_goal, 20),
    coalesce(today.n, 0),
    coalesce(st.len, 0),
    case when lastday.d is null then null
         else greatest(0, ((p_now at time zone p.tz)::date - lastday.d))::integer end,
    coalesce(due.n, 0),
    case when p.exam_date >= (p_now at time zone p.tz)::date then p.exam_date end,
    p.exam_title,
    weak.name,
    weak.pct,
    coalesce(wk.n, 0),
    wk.pct,
    pw.pct,
    hr.h,
    coalesce(sent.n, 0),
    coalesce(sent.kinds, '{}'),
    coalesce(recent.kinds, '{}'),
    sent.last_at,
    coalesce(ign.n, 0),
    coalesce(tot.n, 0)
  from people p
  -- answers made today
  left join lateral (
    select count(*)::integer as n
    from public.attempt_items ai
    join public.attempts a on a.id = ai.attempt_id and a.user_id = ai.user_id
    where ai.user_id = p.user_id and a.status = 'submitted' and ai.response is not null
      and (a.submitted_at at time zone p.tz)::date = (p_now at time zone p.tz)::date
  ) today on true
  -- the last day with any answer
  left join lateral (
    select max((a.submitted_at at time zone p.tz)::date) as d
    from public.attempts a
    where a.user_id = p.user_id and a.status = 'submitted' and a.unanswered_count < a.question_count
  ) lastday on true
  -- days in a row with an answer, ending today (or yesterday while today is still empty)
  left join lateral (
    select count(*)::integer as len
    from (
      select d, row_number() over (order by d desc) - 1 as rn,
             (case when lastday.d = (p_now at time zone p.tz)::date
                   then (p_now at time zone p.tz)::date
                   else (p_now at time zone p.tz)::date - 1 end) - d as gap
      from (
        select distinct (a.submitted_at at time zone p.tz)::date as d
        from public.attempts a
        where a.user_id = p.user_id and a.status = 'submitted' and a.unanswered_count < a.question_count
          and a.submitted_at > p_now - interval '400 days'
      ) days
      where d <= (p_now at time zone p.tz)::date
    ) q
    where q.gap = q.rn
  ) st on true
  -- revision cards due now
  left join lateral (
    select (
      (select count(*) from public.review_cards c where c.user_id = p.user_id and c.due <= p_now) +
      (select count(*) from public.flashcards f where f.user_id = p.user_id and f.due <= p_now)
    )::integer as n
  ) due on true
  -- the weakest subject: lowest share right, 10 or more answers in the last 60 days, and only the
  -- exam subjects when the student chose some
  left join lateral (
    select r.name, round(r.pct)::integer as pct
    from (
      select coalesce(top.name, n.name) as name, avg(ai.credit) * 100 as pct, count(*) as answers
      from public.attempt_items ai
      join public.attempts a on a.id = ai.attempt_id and a.user_id = ai.user_id
      join public.questions q on q.id = ai.question_id and q.user_id = ai.user_id
      join public.taxonomy_nodes n on n.id = q.taxonomy_node_id and n.user_id = q.user_id
      left join lateral (
        with recursive up as (
          select t.id, t.parent_id, t.name from public.taxonomy_nodes t where t.id = n.id
          union all
          select t.id, t.parent_id, t.name from public.taxonomy_nodes t join up on t.id = up.parent_id
        )
        select name from up where parent_id is null limit 1
      ) top on true
      where ai.user_id = p.user_id and a.status = 'submitted' and ai.response is not null
        and ai.credit is not null and a.submitted_at > p_now - interval '60 days'
      group by coalesce(top.name, n.name)
    ) r
    where r.answers >= 10
      and (coalesce(cardinality(p.exam_subjects), 0) = 0 or r.name = any (p.exam_subjects))
    order by r.pct asc, r.answers desc
    limit 1
  ) weak on true
  -- this week and the week before, as a share right
  left join lateral (
    select count(*)::integer as n, round(avg(ai.credit) * 100)::integer as pct
    from public.attempt_items ai
    join public.attempts a on a.id = ai.attempt_id and a.user_id = ai.user_id
    where ai.user_id = p.user_id and a.status = 'submitted' and ai.response is not null
      and ai.credit is not null and a.submitted_at > p_now - interval '7 days'
  ) wk on true
  left join lateral (
    select round(avg(ai.credit) * 100)::integer as pct
    from public.attempt_items ai
    join public.attempts a on a.id = ai.attempt_id and a.user_id = ai.user_id
    where ai.user_id = p.user_id and a.status = 'submitted' and ai.response is not null
      and ai.credit is not null
      and a.submitted_at <= p_now - interval '7 days' and a.submitted_at > p_now - interval '14 days'
  ) pw on true
  -- the hour of day the student most often starts a session (last 45 days)
  left join lateral (
    select extract(hour from (a.started_at at time zone p.tz))::integer as h
    from public.attempts a
    where a.user_id = p.user_id and a.status = 'submitted' and a.started_at > p_now - interval '45 days'
    group by 1 having count(*) >= 3
    order by count(*) desc, 1
    limit 1
  ) hr on true
  -- what was sent today (student's day) and what was sent lately
  left join lateral (
    select count(*)::integer as n, array_agg(l.kind) as kinds, max(l.sent_at) as last_at
    from public.push_log l
    where l.user_id = p.user_id
      and (l.sent_at at time zone p.tz)::date = (p_now at time zone p.tz)::date
  ) sent on true
  left join lateral (
    select array_agg(x.kind order by x.sent_at desc) as kinds
    from (select l.kind, l.sent_at from public.push_log l where l.user_id = p.user_id
          order by l.sent_at desc limit 6) x
  ) recent on true
  -- how many messages (older than 2 hours) went unopened since the last one that was opened
  left join lateral (
    select count(*)::integer as n
    from public.push_log l
    where l.user_id = p.user_id and l.sent_at < p_now - interval '2 hours'
      and l.sent_at > coalesce(
        (select max(c.sent_at) from public.push_log c where c.user_id = p.user_id and c.clicked_at is not null),
        '-infinity'::timestamptz)
  ) ign on true
  left join lateral (
    select count(*)::integer as n
    from public.attempt_items ai
    where ai.user_id = p.user_id and ai.response is not null
  ) tot on true
$$;

revoke execute on function public.push_facts(timestamptz) from public, anon, authenticated;
