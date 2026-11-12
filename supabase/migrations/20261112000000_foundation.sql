-- Learivo foundation: profiles and user preferences with row-level security.
-- Every user-owned table is owned by exactly one auth user and is protected by
-- forced row-level security. The anon role gets no access at all.

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  locale       text not null default 'en' check (char_length(locale) <= 16),
  time_zone    text not null default 'UTC' check (char_length(time_zone) <= 64),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.user_preferences (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  theme           text not null default 'default' check (theme in ('default', 'forest', 'space')),
  mode            text not null default 'system' check (mode in ('light', 'dark', 'system')),
  low_effects     boolean not null default false,
  enabled_modules text[] not null default '{}' check (cardinality(enabled_modules) <= 32),
  version         integer not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- Create the profile and default preferences when a student signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;

-- This function must only run as a trigger, never be callable through the API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.user_preferences enable row level security;
alter table public.user_preferences force row level security;

-- Table privileges: signed-in students only. Profiles are created by the
-- trigger and removed with the account, so students cannot insert or delete them.
revoke all on public.profiles from anon, authenticated;
revoke all on public.user_preferences from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.user_preferences to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy preferences_select_own on public.user_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy preferences_update_own on public.user_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
