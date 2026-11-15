-- Learivo M10: the student's own flashcards and glossary.
-- flashcards: free-form cards (front/back) revised with the same spaced-repetition fields as review_cards.
-- glossary_terms: the student's own terms and definitions.
-- Every row belongs to one student and is protected by forced row-level security.

create table public.flashcards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  front       text not null check (char_length(btrim(front)) between 1 and 2000),
  back        text not null check (char_length(btrim(back)) between 1 and 5000),
  state       text not null default 'new' check (state in ('new', 'review')),
  due         timestamptz not null default now(),
  stability   numeric(10, 4) not null default 0 check (stability >= 0),
  difficulty  numeric(6, 4) not null default 0 check (difficulty between 0 and 10),
  reps        integer not null default 0 check (reps >= 0),
  lapses      integer not null default 0 check (lapses >= 0),
  last_review timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);
create index flashcards_due on public.flashcards (user_id, due);

create table public.glossary_terms (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  term       text not null check (char_length(btrim(term)) between 1 and 80),
  definition text not null check (char_length(btrim(definition)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index glossary_terms_name on public.glossary_terms (user_id, lower(btrim(term)));

create trigger flashcards_set_updated_at
  before update on public.flashcards
  for each row execute function public.set_updated_at();
create trigger glossary_terms_set_updated_at
  before update on public.glossary_terms
  for each row execute function public.set_updated_at();

alter table public.flashcards     enable row level security;
alter table public.glossary_terms enable row level security;
alter table public.flashcards     force row level security;
alter table public.glossary_terms force row level security;

revoke all on public.flashcards, public.glossary_terms from anon, authenticated;
grant select, insert, update, delete on public.flashcards, public.glossary_terms to authenticated;

do $$
declare t text;
begin
  foreach t in array array['flashcards', 'glossary_terms']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete_own', t);
  end loop;
end $$;
