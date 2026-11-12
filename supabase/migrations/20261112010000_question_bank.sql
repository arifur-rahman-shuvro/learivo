-- Learivo M2: the private question bank.
-- Taxonomy, questions with version history, tags and collections.
-- Every row belongs to exactly one student (user_id) and is protected by forced
-- row-level security. Child rows reference their parent through (id, user_id) so a row
-- can never point at another student's data.

-- ---------------------------------------------------------------------------
-- Answer validation: the database refuses malformed answers even if a client has a bug.
-- ---------------------------------------------------------------------------
create function public.valid_answer_spec(qtype text, spec jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(spec) <> 'object' then false
    when qtype in ('sba', 'single_choice') then
      jsonb_typeof(spec -> 'options') = 'array'
      and jsonb_array_length(spec -> 'options') between 2 and 10
      and (select bool_and(jsonb_typeof(o -> 'text') = 'string' and length(btrim(o ->> 'text')) > 0)
             from jsonb_array_elements(spec -> 'options') o)
      and (select count(*) from jsonb_array_elements(spec -> 'options') o
             where o -> 'correct' = 'true'::jsonb) = 1
    when qtype = 'multi_select' then
      jsonb_typeof(spec -> 'options') = 'array'
      and jsonb_array_length(spec -> 'options') between 2 and 10
      and (select bool_and(jsonb_typeof(o -> 'text') = 'string' and length(btrim(o ->> 'text')) > 0)
             from jsonb_array_elements(spec -> 'options') o)
      and (select count(*) from jsonb_array_elements(spec -> 'options') o
             where o -> 'correct' = 'true'::jsonb) >= 1
    when qtype = 'true_false' then
      jsonb_typeof(spec -> 'answer') = 'boolean'
    when qtype = 'short_answer' then
      jsonb_typeof(spec -> 'accepted') = 'array'
      and jsonb_array_length(spec -> 'accepted') between 1 and 20
    when qtype = 'fill_blank' then
      jsonb_typeof(spec -> 'blanks') = 'array'
      and jsonb_array_length(spec -> 'blanks') between 1 and 10
    else false
  end
$$;

-- ---------------------------------------------------------------------------
-- Taxonomy: subject > chapter > topic > subtopic in one self-referencing table.
-- ---------------------------------------------------------------------------
create table public.taxonomy_nodes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  parent_id  uuid,
  kind       text not null check (kind in ('subject', 'chapter', 'topic', 'subtopic')),
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (parent_id, user_id) references public.taxonomy_nodes (id, user_id) on delete cascade,
  check ((kind = 'subject') = (parent_id is null))
);

create unique index taxonomy_nodes_sibling_name
  on public.taxonomy_nodes (user_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index taxonomy_nodes_parent on public.taxonomy_nodes (user_id, parent_id);

-- ---------------------------------------------------------------------------
-- Questions.
-- ---------------------------------------------------------------------------
create table public.questions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  qtype            text not null check (qtype in ('sba', 'single_choice', 'multi_select', 'true_false', 'short_answer', 'fill_blank')),
  stem             text not null check (char_length(btrim(stem)) between 1 and 10000),
  explanation      text not null default '' check (char_length(explanation) <= 10000),
  answer_spec      jsonb not null,
  difficulty       smallint check (difficulty between 1 and 5),
  taxonomy_node_id uuid,
  source           text not null default '' check (char_length(source) <= 200),
  institution      text not null default '' check (char_length(institution) <= 200),
  exam_name        text not null default '' check (char_length(exam_name) <= 200),
  exam_year        smallint check (exam_year between 1900 and 2100),
  metadata         jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  status           text not null default 'active' check (status in ('active', 'archived')),
  content_hash     text not null default '',
  version          integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  search           tsvector generated always as
    (to_tsvector('simple'::regconfig, stem || ' ' || explanation)) stored,
  unique (id, user_id),
  foreign key (taxonomy_node_id, user_id) references public.taxonomy_nodes (id, user_id)
    on delete set null (taxonomy_node_id),
  check (public.valid_answer_spec(qtype, answer_spec))
);

create index questions_list on public.questions (user_id, status, updated_at desc);
create index questions_taxonomy on public.questions (user_id, taxonomy_node_id);
create index questions_hash on public.questions (user_id, content_hash);
create index questions_search on public.questions using gin (search);

-- ---------------------------------------------------------------------------
-- Version history: a snapshot on every save; the last 20 are kept.
-- ---------------------------------------------------------------------------
create table public.question_versions (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  user_id     uuid not null,
  version     integer not null,
  snapshot    jsonb not null,
  created_at  timestamptz not null default now(),
  unique (question_id, version),
  foreign key (question_id, user_id) references public.questions (id, user_id) on delete cascade
);
create index question_versions_question on public.question_versions (user_id, question_id, version desc);

-- ---------------------------------------------------------------------------
-- Tags and collections.
-- ---------------------------------------------------------------------------
create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index tags_name on public.tags (user_id, lower(name));

create table public.question_tags (
  question_id uuid not null,
  tag_id      uuid not null,
  user_id     uuid not null,
  primary key (question_id, tag_id),
  foreign key (question_id, user_id) references public.questions (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags (id, user_id) on delete cascade
);
create index question_tags_tag on public.question_tags (user_id, tag_id);

create table public.collections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index collections_name on public.collections (user_id, lower(name));

create table public.collection_questions (
  collection_id uuid not null,
  question_id   uuid not null,
  user_id       uuid not null,
  position      integer not null default 0,
  primary key (collection_id, question_id),
  foreign key (collection_id, user_id) references public.collections (id, user_id) on delete cascade,
  foreign key (question_id, user_id) references public.questions (id, user_id) on delete cascade
);
create index collection_questions_question on public.collection_questions (user_id, question_id);

-- ---------------------------------------------------------------------------
-- Triggers.
-- ---------------------------------------------------------------------------
-- Keep timestamps, the version counter and the duplicate-detection hash server-controlled.
create function public.questions_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.content_hash := md5(lower(regexp_replace(btrim(new.stem), '\s+', ' ', 'g')) || '|' || new.qtype);
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.updated_at := now();
    new.user_id := old.user_id;
  else
    new.version := 1;
  end if;
  return new;
end;
$$;

create trigger questions_before_write
  before insert or update on public.questions
  for each row execute function public.questions_before_write();

-- Snapshot each saved version. Runs with the owner's rights because students may only read versions.
create function public.questions_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.question_versions (question_id, user_id, version, snapshot)
  values (new.id, new.user_id, new.version, to_jsonb(new) - 'search');
  delete from public.question_versions
   where question_id = new.id
     and version <= new.version - 20;
  return new;
end;
$$;

create trigger questions_after_write
  after insert or update on public.questions
  for each row execute function public.questions_after_write();

create trigger taxonomy_nodes_set_updated_at
  before update on public.taxonomy_nodes
  for each row execute function public.set_updated_at();

create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

revoke all on function public.questions_before_write() from public, anon, authenticated;
revoke all on function public.questions_after_write() from public, anon, authenticated;
revoke all on function public.valid_answer_spec(text, jsonb) from public, anon;
grant execute on function public.valid_answer_spec(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security and privileges.
-- ---------------------------------------------------------------------------
alter table public.taxonomy_nodes        enable row level security;
alter table public.questions             enable row level security;
alter table public.question_versions     enable row level security;
alter table public.tags                  enable row level security;
alter table public.question_tags         enable row level security;
alter table public.collections           enable row level security;
alter table public.collection_questions  enable row level security;

alter table public.taxonomy_nodes        force row level security;
alter table public.questions             force row level security;
alter table public.question_versions     force row level security;
alter table public.tags                  force row level security;
alter table public.question_tags         force row level security;
alter table public.collections           force row level security;
alter table public.collection_questions  force row level security;

revoke all on public.taxonomy_nodes, public.questions, public.question_versions, public.tags,
  public.question_tags, public.collections, public.collection_questions from anon, authenticated;

grant select, insert, update, delete on public.taxonomy_nodes, public.questions, public.tags,
  public.question_tags, public.collections, public.collection_questions to authenticated;
grant select on public.question_versions to authenticated;

-- One policy per command on every student-owned table.
do $$
declare t text;
begin
  foreach t in array array['taxonomy_nodes', 'questions', 'tags', 'question_tags', 'collections', 'collection_questions']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete_own', t);
  end loop;
end $$;

create policy question_versions_select_own on public.question_versions
  for select to authenticated using (user_id = (select auth.uid()));
