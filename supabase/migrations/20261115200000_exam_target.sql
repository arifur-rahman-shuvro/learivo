-- Learivo M9: the student's next exam (a title and a date) for the Home countdown.
-- Lives on the existing per-user preferences row, so the same own-row policies protect it.
alter table public.user_preferences
  add column exam_title text not null default '' check (char_length(exam_title) <= 120),
  add column exam_date date;
