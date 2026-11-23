-- Learivo: the subjects an exam covers, so the Home countdown and daily plan count only those.
-- An empty list means every subject. Same per-user preferences row, so the same own-row policies apply.
alter table public.user_preferences
  add column exam_subjects text[] not null default '{}' check (cardinality(exam_subjects) <= 100);
