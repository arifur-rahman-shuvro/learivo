-- Learivo M14: an optional colour for each subject, from a fixed set of names.
-- Additive and nullable: nothing existing changes. The app only offers colours on subjects (top level);
-- the check keeps the column to the known names so a bad value can never be stored.
-- Rollback: alter table public.taxonomy_nodes drop column color;
alter table public.taxonomy_nodes
  add column color text
  check (color in ('red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink'));
