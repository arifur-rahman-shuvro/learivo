-- Learivo M8: covering indexes for foreign keys (from the Supabase performance advisor).
-- They keep cascading deletes and "set null" updates fast as the data grows.
create index if not exists attempt_items_fk_attempt on public.attempt_items (attempt_id, user_id);
create index if not exists attempt_items_fk_question on public.attempt_items (question_id, user_id);
create index if not exists attempts_fk_exam on public.attempts (exam_id, user_id);
create index if not exists bookmarks_fk_question on public.bookmarks (question_id, user_id);
create index if not exists collection_questions_fk_collection on public.collection_questions (collection_id, user_id);
create index if not exists collection_questions_fk_question on public.collection_questions (question_id, user_id);
create index if not exists notes_fk_question on public.notes (question_id, user_id);
create index if not exists question_tags_fk_question on public.question_tags (question_id, user_id);
create index if not exists question_tags_fk_tag on public.question_tags (tag_id, user_id);
create index if not exists question_versions_fk_question on public.question_versions (question_id, user_id);
create index if not exists questions_fk_taxonomy on public.questions (taxonomy_node_id, user_id);
create index if not exists review_cards_fk_question on public.review_cards (question_id, user_id);
create index if not exists taxonomy_nodes_fk_parent on public.taxonomy_nodes (parent_id, user_id);
