-- Learivo M13: the student's own reason for a missed question.
alter table public.attempt_items
  add column mistake_reason text
  check (mistake_reason in ('careless', 'not_known', 'mixed_up', 'guessed'));
