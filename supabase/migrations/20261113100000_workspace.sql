-- Learivo M4: personal workspace.
-- bookmarks: questions a student saved. notes: a note on a question or a free note.
-- review_cards: one spaced-repetition card per question the student is revising.
-- daily_goal: how many questions the student wants to answer each day.
-- Every row belongs to one student and is protected by forced row-level security.

alter table public.user_preferences
  add column daily_goal integer not null default 20 check (daily_goal between 1 and 500);

create table public.bookmarks (
  user_id     uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, question_id),
  foreign key (question_id, user_id) references public.questions (id, user_id) on delete cascade
);

create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  question_id uuid,
  title       text not null default '' check (char_length(title) <= 120),
  body        text not null check (char_length(btrim(body)) between 1 and 10000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id),
  foreign key (question_id, user_id) references public.questions (id, user_id) on delete cascade
);
-- One note per question; free notes (no question) can be many.
create unique index notes_one_per_question on public.notes (user_id, question_id)
  where question_id is not null;
create index notes_list on public.notes (user_id, updated_at desc);

create table public.review_cards (
  user_id     uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null,
  state       text not null default 'new' check (state in ('new', 'review')),
  due         timestamptz not null default now(),
  stability   numeric(10, 4) not null default 0 check (stability >= 0),
  difficulty  numeric(6, 4) not null default 0 check (difficulty between 0 and 10),
  reps        integer not null default 0 check (reps >= 0),
  lapses      integer not null default 0 check (lapses >= 0),
  last_review timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, question_id),
  foreign key (question_id, user_id) references public.questions (id, user_id) on delete cascade
);
create index review_cards_due on public.review_cards (user_id, due);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();
create trigger review_cards_set_updated_at
  before update on public.review_cards
  for each row execute function public.set_updated_at();

alter table public.bookmarks    enable row level security;
alter table public.notes        enable row level security;
alter table public.review_cards enable row level security;
alter table public.bookmarks    force row level security;
alter table public.notes        force row level security;
alter table public.review_cards force row level security;

revoke all on public.bookmarks, public.notes, public.review_cards from anon, authenticated;
grant select, insert, update, delete on public.bookmarks, public.notes, public.review_cards to authenticated;

do $$
declare t text;
begin
  foreach t in array array['bookmarks', 'notes', 'review_cards']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete_own', t);
  end loop;
end $$;
