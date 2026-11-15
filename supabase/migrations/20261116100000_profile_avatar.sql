-- Learivo M11: avatar colour for the account menu.
-- display_name already exists on profiles; the avatar is one of a fixed set of colour names.
alter table public.profiles
  add column avatar text not null default 'sky'
  check (avatar in ('sky', 'teal', 'green', 'amber', 'orange', 'rose', 'violet', 'slate'));
