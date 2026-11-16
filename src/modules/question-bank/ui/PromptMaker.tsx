import { useRef, useState } from "react";
import { Button } from "../../../design-system/index.ts";
import { generateQuestions } from "../../ai/generate.ts";
import { activeConfig, openAiConnection, useAiState } from "../../ai/keys.ts";
import { AiError, providerOf } from "../../ai/providers.ts";
import {
  DEFAULT_SPEC,
  PROMPT_TYPES,
  BATCH_SIZE,
  MATERIAL_MAX,
  buildPrompt,
  type PromptSpec,
} from "../domain/promptBuilder.ts";

const STORE = "learivo.promptSpec";

function load(): PromptSpec {
  try {
    const raw = window.localStorage.getItem(STORE);
    if (raw) return { ...DEFAULT_SPEC, ...(JSON.parse(raw) as Partial<PromptSpec>), material: "" };
  } catch {
    /* storage unavailable: start blank */
  }
  return DEFAULT_SPEC;
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        className="lv-input"
        value={value}
        placeholder={placeholder}
        autoCapitalize="off"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

const LANGS = ["English", "Bangla", "Banglish (Bangla in English letters)"];

/** Form that builds a ready-to-paste prompt for an AI chat. */
export function PromptMaker({
  onGenerated,
}: {
  /** Receives the AI's reply when the student generates inside the app. */
  onGenerated?: (text: string) => void;
}) {
  const ai = useAiState();
  const cfg = activeConfig(ai);
  const [working, setWorking] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [spec, setSpec] = useState<PromptSpec>(load);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const set = <K extends keyof PromptSpec>(k: K, v: PromptSpec[K]) => {
    setSpec((s) => {
      const next = { ...s, [k]: v };
      try {
        window.localStorage.setItem(STORE, JSON.stringify({ ...next, material: "" }));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const prompt = buildPrompt(spec);
  const convert = spec.mode === "convert";

  async function generate() {
    if (!cfg || !onGenerated) return;
    setGenError(null);
    setWorking(true);
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      const out = await generateQuestions(cfg, spec, {
        signal: AbortSignal.any([ctl.signal, AbortSignal.timeout(180000)]),
      });
      onGenerated(out.text);
    } catch (e) {
      setGenError(
        e instanceof AiError
          ? e.message
          : "That took too long or failed. Try again, or ask for fewer questions.",
      );
    } finally {
      abort.current = null;
      setWorking(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied(null), 2500);
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0 text-sm">
        <legend className="mb-1 font-semibold">What do you want the AI to do?</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="pm-mode"
            checked={spec.mode === "create"}
            onChange={() => set("mode", "create")}
            className="size-4 accent-[var(--lv-accent)]"
          />
          Write new questions (from a topic, notes or pages)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="pm-mode"
            checked={convert}
            onChange={() => set("mode", "convert")}
            className="size-4 accent-[var(--lv-accent)]"
          />
          Copy existing questions (from photos, PDF or text)
        </label>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id="pm-subject"
          label="Subject"
          value={spec.subject}
          onChange={(v) => set("subject", v)}
          placeholder="Anatomy"
        />
        <Field
          id="pm-chapter"
          label="Chapter"
          value={spec.chapter}
          onChange={(v) => set("chapter", v)}
          placeholder="Thorax"
        />
        <Field
          id="pm-topic"
          label="Topic"
          value={spec.topic}
          onChange={(v) => set("topic", v)}
          placeholder="Heart"
        />
        <Field
          id="pm-subtopic"
          label="Subtopic"
          value={spec.subtopic}
          onChange={(v) => set("subtopic", v)}
        />
        <Field
          id="pm-exam"
          label="Exam name"
          value={spec.examName}
          onChange={(v) => set("examName", v)}
          placeholder="Final Prof"
        />
        <Field
          id="pm-inst"
          label="Institution"
          value={spec.institution}
          onChange={(v) => set("institution", v)}
        />
        <Field
          id="pm-year"
          label="Exam year"
          value={spec.examYear}
          onChange={(v) => set("examYear", v)}
          placeholder="2024"
        />
        <Field
          id="pm-source"
          label="Source"
          value={spec.source}
          onChange={(v) => set("source", v)}
          placeholder="Book or past paper"
        />
        <Field
          id="pm-tags"
          label="Tags (comma separated)"
          value={spec.tags}
          onChange={(v) => set("tags", v)}
          placeholder="high-yield, cardio"
        />
        <Field
          id="pm-level"
          label="Level"
          value={spec.level}
          onChange={(v) => set("level", v)}
          placeholder="MBBS 2nd professional"
        />
      </div>

      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0 text-sm">
        <legend className="mb-1 font-semibold">Question types (none ticked = a mix)</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {PROMPT_TYPES.map((t) => (
            <label key={t.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={spec.types.includes(t.id)}
                onChange={(e) =>
                  set(
                    "types",
                    e.target.checked ? [...spec.types, t.id] : spec.types.filter((x) => x !== t.id),
                  )
                }
                className="size-4 accent-[var(--lv-accent)]"
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        {!convert && (
          <div className="flex flex-col gap-1">
            <label htmlFor="pm-count" className="text-sm font-semibold">
              How many questions
            </label>
            <input
              id="pm-count"
              type="number"
              min={1}
              max={200}
              className="lv-input"
              value={spec.count}
              onChange={(e) => set("count", Number(e.target.value))}
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="pm-opts" className="text-sm font-semibold">
            Options per question
          </label>
          <select
            id="pm-opts"
            className="lv-input"
            value={String(spec.optionCount)}
            onChange={(e) =>
              set(
                "optionCount",
                e.target.value === "auto" ? "auto" : (Number(e.target.value) as 2 | 3 | 4 | 5),
              )
            }
          >
            <option value="auto">AI decides (2 to 5)</option>
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pm-diff" className="text-sm font-semibold">
            Difficulty
          </label>
          <select
            id="pm-diff"
            className="lv-input"
            value={String(spec.difficulty)}
            onChange={(e) =>
              set(
                "difficulty",
                e.target.value === "mixed"
                  ? "mixed"
                  : (Number(e.target.value) as 1 | 2 | 3 | 4 | 5),
              )
            }
          >
            <option value="mixed">Mixed (AI decides each)</option>
            <option value="1">1 Very easy</option>
            <option value="2">2 Easy</option>
            <option value="3">3 Medium</option>
            <option value="4">4 Hard</option>
            <option value="5">5 Very hard</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pm-expl" className="text-sm font-semibold">
            Explanations
          </label>
          <select
            id="pm-expl"
            className="lv-input"
            value={spec.explanation}
            onChange={(e) => set("explanation", e.target.value as PromptSpec["explanation"])}
          >
            <option value="none">None</option>
            <option value="short">Short</option>
            <option value="detailed">Detailed</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pm-ql" className="text-sm font-semibold">
            Question language
          </label>
          <select
            id="pm-ql"
            className="lv-input"
            value={spec.questionLanguage}
            onChange={(e) => set("questionLanguage", e.target.value)}
          >
            {LANGS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="pm-el" className="text-sm font-semibold">
            Explanation language
          </label>
          <select
            id="pm-el"
            className="lv-input"
            value={spec.explanationLanguage}
            onChange={(e) => set("explanationLanguage", e.target.value)}
          >
            {LANGS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      <Field
        id="pm-extra"
        label="Anything else for the AI (optional)"
        value={spec.extra}
        onChange={(v) => set("extra", v)}
        placeholder="Focus on clinical scenarios"
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="pm-material" className="text-sm font-semibold">
          {convert
            ? "Paste the questions to copy (optional)"
            : "Make questions from my notes (optional)"}
        </label>
        <textarea
          id="pm-material"
          className="lv-input"
          style={{ minHeight: "6rem", resize: "vertical" }}
          value={spec.material}
          maxLength={MATERIAL_MAX}
          placeholder={
            convert
              ? "Paste the text of the questions here"
              : "Paste a chapter, lecture notes or a summary. The questions will come only from this text."
          }
          onChange={(e) => set("material", e.target.value)}
        />
        <p className="m-0 text-xs text-muted">
          {spec.material.length.toLocaleString()} of {MATERIAL_MAX.toLocaleString()} characters. Not
          remembered after you close this.
        </p>
      </div>

      {onGenerated && (
        <section
          aria-label="Generate with AI"
          className="flex flex-col gap-2 rounded-control border border-line p-3"
        >
          <h3 className="m-0 text-base font-semibold">Generate with AI</h3>
          {cfg ? (
            <>
              <p className="m-0 text-sm text-muted">
                Uses your {providerOf(cfg.provider).label} account ({cfg.model}). Up to {BATCH_SIZE}{" "}
                questions at a time. This may use your credit or daily limit. You will see the
                questions before anything is saved.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button loading={working} onClick={() => void generate()}>
                  {working ? "Writing questions" : "Generate questions"}
                </Button>
                {working && (
                  <Button variant="ghost" onClick={() => abort.current?.abort()}>
                    Stop
                  </Button>
                )}
                <Button variant="ghost" onClick={openAiConnection}>
                  AI connection
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="m-0 text-sm text-muted">
                Connect your own AI account and Learivo writes the questions for you, with no copy
                and paste.
              </p>
              <div>
                <Button variant="secondary" onClick={openAiConnection}>
                  Connect an AI
                </Button>
              </div>
            </>
          )}
          {genError && (
            <p role="alert" className="m-0 text-sm text-danger">
              {genError}
            </p>
          )}
        </section>
      )}

      <section aria-label="Your prompt" className="flex flex-col gap-2">
        <h3 className="m-0 text-base font-semibold">Your prompt</h3>
        <pre
          tabIndex={0}
          className="m-0 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-control border border-line bg-surface-2 p-2 font-mono text-xs"
        >
          {prompt}
        </pre>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void copy()}>{copied === "ok" ? "Copied" : "Copy prompt"}</Button>
          <Button variant="ghost" onClick={() => setSpec(DEFAULT_SPEC)}>
            Reset form
          </Button>
          {copied === "fail" && (
            <span role="alert" className="text-sm text-danger">
              Could not copy. Select the prompt and copy it by hand.
            </span>
          )}
        </div>
        <ol className="m-0 pl-5 text-sm text-muted">
          <li>Open your AI chat and paste this prompt.</li>
          {convert ? (
            <li>Attach your photos, screenshots or PDF in the same message, then send.</li>
          ) : (
            <li>Attach notes or pages if you want, or just send it.</li>
          )}
          <li>Copy the JSON it replies with, then come back to the Paste JSON tab.</li>
          <li>If it stops early, reply &ldquo;continue&rdquo; and import each part.</li>
        </ol>
      </section>
    </div>
  );
}
