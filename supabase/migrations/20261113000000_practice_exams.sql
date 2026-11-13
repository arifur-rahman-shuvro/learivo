-- Learivo M3: practice sessions and exams.
-- exams: saved exam templates. attempts: one practice session or one sitting of an exam.
-- attempt_items: the questions of an attempt, each holding a frozen copy (snapshot) of the
-- question at the time it was drawn, so results stay correct if the question is edited or
-- deleted later. Every row belongs to one student and is protected by forced row-level security.

create table public.exams (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 1 and 120),
  instructions     text not null default '' check (char_length(instructions) <= 5000),
  time_limit_sec   integer check (time_limit_sec between 60 and 86400),
  marks_correct    numeric(6, 2) not null default 1 check (marks_correct between 0 and 100),
  marks_wrong      numeric(6, 2) not null default 0 check (marks_wrong between 0 and 100),
  randomize        boolean not null default true,
  rules            jsonb not null default '[]'::jsonb check (jsonb_typeof(rules) = 'array'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, user_id)
);
create index exams_list on public.exams (user_id, updated_at desc);

create table public.attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  kind             text not null check (kind in ('practice', 'exam')),
  exam_id          uuid,
  title            text not null check (char_length(btrim(title)) between 1 and 120),
  status           text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  instant_feedback boolean not null default false,
  time_limit_sec   integer check (time_limit_sec between 60 and 86400),
  marks_correct    numeric(6, 2) not null default 1 check (marks_correct between 0 and 100),
  marks_wrong      numeric(6, 2) not null default 0 check (marks_wrong between 0 and 100),
  question_count   integer not null check (question_count between 1 and 500),
  score            numeric(8, 2),
  correct_count    integer,
  wrong_count      integer,
  unanswered_count integer,
  seconds_spent    integer not null default 0 check (seconds_spent >= 0),
  started_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  updated_at       timestamptz not null default now(),
  unique (id, user_id),
  foreign key (exam_id, user_id) references public.exams (id, user_id) on delete set null (exam_id),
  check ((status = 'submitted') = (submitted_at is not null))
);
create index attempts_list on public.attempts (user_id, started_at desc);

create table public.attempt_items (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null,
  user_id     uuid not null,
  position    integer not null check (position >= 0),
  question_id uuid,
  snapshot    jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  response    jsonb,
  flagged     boolean not null default false,
  is_correct  boolean,
  marks       numeric(6, 2),
  answered_at timestamptz,
  unique (attempt_id, position),
  foreign key (attempt_id, user_id) references public.attempts (id, user_id) on delete cascade,
  foreign key (question_id, user_id) references public.questions (id, user_id)
    on delete set null (question_id)
);
create index attempt_items_attempt on public.attempt_items (user_id, attempt_id, position);
create index attempt_items_question on public.attempt_items (user_id, question_id);

create trigger exams_set_updated_at
  before update on public.exams
  for each row execute function public.set_updated_at();
create trigger attempts_set_updated_at
  before update on public.attempts
  for each row execute function public.set_updated_at();

alter table public.exams          enable row level security;
alter table public.attempts       enable row level security;
alter table public.attempt_items  enable row level security;
alter table public.exams          force row level security;
alter table public.attempts       force row level security;
alter table public.attempt_items  force row level security;

revoke all on public.exams, public.attempts, public.attempt_items from anon, authenticated;
grant select, insert, update, delete on public.exams, public.attempts, public.attempt_items to authenticated;

do $$
declare t text;
begin
  foreach t in array array['exams', 'attempts', 'attempt_items']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete_own', t);
  end loop;
end $$;
