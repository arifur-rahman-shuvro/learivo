import { useEffect, useRef, useState } from "react";
import type { QuestionQuery, QuestionRecord, QuestionRepo } from "../../data/repo.ts";
import { errorText } from "../bank.tsx";

/**
 * Loads the question list one page at a time. The first page reloads whenever the query or the
 * bank changes, and the next page loads when `endRef` scrolls into view.
 */
export function useQuestionPages(repo: QuestionRepo, rev: number, effective: QuestionQuery) {
  const [items, setItems] = useState<QuestionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string>();

  // Load the first page whenever the filters or the bank change.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    repo.list(effective).then(
      (page) => {
        if (!alive) return;
        setItems(page.items);
        setTotal(page.total);
        setError(undefined);
        setLoading(false);
      },
      (e) => {
        if (!alive) return;
        setError(errorText(e));
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [repo, rev, effective]);

  async function loadMore() {
    setMore(true);
    try {
      const page = await repo.list({ ...effective, offset: items.length });
      setItems((cur) => [...cur, ...page.items]);
      setTotal(page.total);
    } catch (e) {
      setError(errorText(e));
    }
    setMore(false);
  }

  // Load the next page when the end of the list scrolls into view. The button stays as a fallback.
  const endRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  const canLoadMore = items.length < total && !more;
  useEffect(() => {
    const el = endRef.current;
    if (!el || !canLoadMore || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMoreRef.current();
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [canLoadMore, items.length]);

  return { items, total, loading, more, error, setError, loadMore, endRef };
}
