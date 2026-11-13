import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Dialog } from "../design-system/index.ts";
import { useServices } from "../offline/OfflineProvider.tsx";
import { DEFAULT_QUERY, type QuestionRecord } from "../modules/question-bank/data/repo.ts";
import { MODULES } from "./registry.ts";
import { sendIntent } from "./intents.ts";

interface Command {
  id: string;
  group: "Go to" | "Actions" | "Questions";
  label: string;
  hint?: string;
  /** Extra words that also match, so "new" finds "Add question". */
  keywords?: string;
  run: () => void;
}

const stripTags = (s: string) => s.replace(/\s+/g, " ").trim();

function matches(c: Command, text: string) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = `${c.label} ${c.keywords ?? ""}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

interface Props {
  onNavigate: (route: string) => void;
}

/** Ctrl or Cmd + K: jump to a screen, start an action, or search every question. */
export default function CommandPalette({ onNavigate }: Props) {
  const { bank } = useServices();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [found, setFound] = useState<QuestionRecord[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("learivo:palette", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("learivo:palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setText("");
    setFound([]);
    setActive(0);
    const t = setTimeout(() => input.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Question search, a moment after typing stops.
  useEffect(() => {
    const q = text.trim();
    if (!open || q.length < 2) {
      setFound([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      bank.list({ ...DEFAULT_QUERY, search: q, limit: 6 }).then(
        (page) => alive && setFound(page.items),
        () => alive && setFound([]),
      );
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [text, open, bank]);

  const close = () => setOpen(false);

  const commands = useMemo<Command[]>(() => {
    const go = (route: string) => () => {
      close();
      onNavigate(route);
    };
    const nav: Command[] = MODULES.map((m) => ({
      id: `go-${m.id}`,
      group: "Go to",
      label: m.label,
      run: go(m.route),
    }));
    const actions: Command[] = [
      {
        id: "add",
        group: "Actions",
        label: "Add question",
        keywords: "new create write",
        run: () => {
          close();
          sendIntent({ kind: "add" });
          onNavigate("#/questions");
        },
      },
      {
        id: "import",
        group: "Actions",
        label: "Import questions",
        keywords: "paste json upload file chatgpt",
        run: () => {
          close();
          sendIntent({ kind: "import" });
          onNavigate("#/questions");
        },
      },
      {
        id: "practice",
        group: "Actions",
        label: "Start practice",
        keywords: "new session quiz exam test",
        run: go("#/practice"),
      },
      {
        id: "due",
        group: "Actions",
        label: "Review cards due now",
        keywords: "spaced repetition revise",
        run: go("#/review"),
      },
    ];
    return [...nav, ...actions];
  }, [onNavigate]);

  const list = useMemo<Command[]>(() => {
    const q = text.trim();
    const base = q ? commands.filter((c) => matches(c, q)) : commands;
    if (!q) return base;
    const search: Command = {
      id: "search-all",
      group: "Questions",
      label: `Search questions for “${stripTags(q)}”`,
      run: () => {
        close();
        sendIntent({ kind: "search", text: q });
        onNavigate("#/questions");
      },
    };
    const hits: Command[] = found.map((f) => ({
      id: `q-${f.id}`,
      group: "Questions",
      label: stripTags(f.stem).slice(0, 110),
      hint: f.path.join(" › ") || undefined,
      run: () => {
        close();
        sendIntent({ kind: "search", text: stripTags(f.stem).slice(0, 60) });
        onNavigate("#/questions");
      },
    }));
    return [...base, search, ...hits];
  }, [commands, text, found, onNavigate]);

  useEffect(() => setActive((a) => Math.min(a, Math.max(0, list.length - 1))), [list.length]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (list.length ? (a + 1) % list.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (list.length ? (a - 1 + list.length) % list.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      list[active]?.run();
    }
  }

  const groups = (["Go to", "Actions", "Questions"] as const).map((g) => ({
    name: g,
    items: list.map((c, i) => ({ c, i })).filter(({ c }) => c.group === g),
  }));

  return (
    <Dialog open={open} title="Search and commands" onClose={close} variant="modal">
      <div className="flex flex-col gap-3">
        <input
          ref={input}
          className="lv-input"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={list[active] ? `${listId}-${list[active].id}` : undefined}
          aria-label="Search or type a command"
          placeholder="Search questions or type a command"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <div id={listId} role="listbox" aria-label="Results" className="flex flex-col gap-3">
          {list.length === 0 && <p className="m-0 text-sm text-muted">Nothing matches.</p>}
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <div key={g.name} role="group" aria-label={g.name} className="flex flex-col gap-1">
                <p className="m-0 px-2 text-xs font-semibold text-muted">{g.name}</p>
                {g.items.map(({ c, i }) => (
                  <div
                    key={c.id}
                    id={`${listId}-${c.id}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={c.run}
                    className={`flex cursor-pointer flex-col rounded-control px-2 py-2 ${
                      i === active
                        ? "bg-surface-2 outline outline-1 outline-[var(--lv-accent)]"
                        : ""
                    }`}
                  >
                    <span className="text-sm font-medium">{c.label}</span>
                    {c.hint && <span className="text-xs text-muted">{c.hint}</span>}
                  </div>
                ))}
              </div>
            ))}
        </div>
        <p className="m-0 text-xs text-muted">
          Arrow keys to move, Enter to open, Escape to close.
        </p>
      </div>
    </Dialog>
  );
}
