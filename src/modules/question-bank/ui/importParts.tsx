import { useState } from "react";
import { hasDefaults, type Defaults } from "../domain/promptBuilder.ts";
import { blankQuestion, type QuestionInput } from "../domain/model.ts";
import { contentHash } from "../domain/hash.ts";
import { DEFAULT_QUERY, type QuestionRepo } from "../data/repo.ts";

export const BATCH = 500;

export function readFile(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const EXAMPLE: QuestionInput = {
  ...blankQuestion("sba"),
  stem: "Which drug inhibits vitamin K dependent clotting factors?",
  answer: {
    options: [
      { text: "Aspirin", correct: false },
      { text: "Warfarin", correct: true },
      { text: "Heparin", correct: false },
      { text: "Clopidogrel", correct: false },
      { text: "Rivaroxaban", correct: false },
    ],
  },
  explanation: "Warfarin blocks vitamin K epoxide reductase.",
  difficulty: 2,
  path: ["Pharmacology", "Anticoagulants"],
  tags: ["high-yield"],
};

export type Stage = "choose" | "review" | "importing" | "done";
export type Source = "paste" | "upload" | "prompt" | "ai";

export interface Outcome {
  imported: number;
  skippedDuplicates: number;
  replaced: number;
  skippedInvalid: number;
  /** Set when the import stopped part-way. */
  failure?: string;
  attempted: number;
}

/** What to tell AI so that its answer imports cleanly. */
export const CHAT_PROMPT = `Write the questions as JSON only, with no text before or after it. Use this format:
[
  {
    "type": "sba",
    "stem": "The question text",
    "options": [
      { "text": "Option A", "correct": false },
      { "text": "Option B", "correct": true },
      { "text": "Option C", "correct": false },
      { "text": "Option D", "correct": false },
      { "text": "Option E", "correct": false }
    ],
    "explanation": "Why the answer is right",
    "difficulty": 2,
    "subject": "Subject",
    "chapter": "Chapter",
    "tags": ["tag"]
  }
]
"type" is one of: sba, single_choice, multi_select, true_false, fill_blank.
Every sba, single_choice, multi_select and true_false question has 2 to 5 options (4 or 5 is usual).
For sba and single_choice exactly one option is correct; multi_select has one or more correct options.
For true_false the stem is a lead-in (for example "Heart has-") and the options are statements; set "correct": true for each statement that is true and false for each that is false.
For fill_blank write {{1}}, {{2}} in the stem and use "blanks": [["answer for 1"], ["answer for 2"]].`;

/** Finds the bank question behind each content hash, so a replace can update it in place. */
export async function bankIdsByHash(repo: QuestionRepo): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const status of ["active", "archived"] as const) {
    for (let offset = 0; ; offset += 200) {
      const page = await repo.list({ ...DEFAULT_QUERY, status, offset, limit: 200 });
      for (const q of page.items) out.set(contentHash(q.stem, q.qtype), q.id);
      if (page.items.length < 200) break;
    }
  }
  return out;
}

export function Tile({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "danger" | "warning";
}) {
  const color =
    tone === "danger" && value > 0
      ? "text-danger"
      : tone === "warning" && value > 0
        ? "text-warning"
        : "";
  return (
    <li className="rounded-control border border-line p-2.5">
      <div className={`text-xl font-bold ${color}`}>{value.toLocaleString()}</div>
      <div className="text-sm text-muted">{label}</div>
    </li>
  );
}

export function DefaultsForm({
  value,
  onChange,
}: {
  value: Defaults;
  onChange: (d: Defaults) => void;
}) {
  const [year, setYear] = useState(value.examYear === null ? "" : String(value.examYear));
  const set = (patch: Partial<Defaults>) => onChange({ ...value, ...patch });
  const text = (id: string, label: string, v: string, f: (s: string) => void) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input id={id} className="lv-input" value={v} onChange={(e) => f(e.target.value)} />
    </div>
  );
  const [subject = "", chapter = "", ...deeper] = value.path;
  const setPath = (sub: string, chap: string) =>
    set({ path: sub.trim() === "" ? [] : chap.trim() === "" ? [sub] : [sub, chap, ...deeper] });
  return (
    <details className="rounded-control border border-line bg-surface-2 p-3 text-sm">
      <summary className="cursor-pointer font-semibold">
        Add to every question{hasDefaults(value) ? " (on)" : ""}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="m-0 text-muted">
          Fills only what a question is missing. Tags are added to the ones it already has.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {text("dv-subject", "Subject", subject, (v) => setPath(v, chapter))}
          {text("dv-chapter", "Chapter", chapter, (v) => setPath(subject, v))}
          {text("dv-tags", "Tags (comma separated)", value.tags.join(", "), (v) =>
            set({
              tags: v
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            }),
          )}
          {text("dv-exam", "Exam name", value.examName, (v) => set({ examName: v }))}
          {text("dv-inst", "Institution", value.institution, (v) => set({ institution: v }))}
          {text("dv-year", "Exam year", year, (v) => {
            setYear(v);
            set({ examYear: /^\d{4}$/.test(v.trim()) ? Number(v) : null });
          })}
          {text("dv-source", "Source", value.source, (v) => set({ source: v }))}
        </div>
      </div>
    </details>
  );
}
