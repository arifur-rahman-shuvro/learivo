-- Learivo M14: seconds the student spent on each question of a session.
alter table public.attempt_items
  add column seconds integer not null default 0
  check (seconds between 0 and 86400);
