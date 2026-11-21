import { loadComparables } from "./similar.ts";
import { useRef, useState } from "react";
import { Badge, Button, Dialog, ProgressBar } from "../../../ui-kit/index.ts";
import {
  MAX_IMPORT_ROWS,
  analyzeImport,
  exportCsv,
  exportJson,
  type ImportFormat,
  type ImportReport,
} from "../domain/importExport.ts";
import {
  NO_DEFAULTS,
  applyDefaults,
  buildFixPrompt,
  hasDefaults,
  type Defaults,
} from "../domain/promptBuilder.ts";
import { PromptMaker } from "./PromptMaker.tsx";
import { errorText, useBank } from "./bank.tsx";
import { contentHash } from "../domain/hash.ts";
import { qualityHints } from "../domain/quality.ts";
import { allHints, summarise } from "../domain/review.ts";
import { QuestionPreview } from "./QuestionPreview.tsx";

import {
  BATCH,
  bankIdsByHash,
  CHAT_PROMPT,
  DefaultsForm,
  EXAMPLE,
  Tile,
  download,
  readFile,
  type Outcome,
  type Source,
  type Stage,
} from "./importParts.tsx";

export function ImportDialog({
  onClose,
  initial = "paste",
}: {
  onClose: () => void;
  initial?: "paste" | "upload" | "prompt" | "ai";
}) {
  const { repo, refresh } = useBank();
  const [stage, setStage] = useState<Stage>("choose");
  const [source, setSource] = useState<Source>(initial);
  const [pasted, setPasted] = useState("");
  const [fileName, setFileName] = useState("");
  const [loaded, setLoaded] = useState<{ text: string; format: ImportFormat } | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [policy, setPolicy] = useState<"skip" | "keep" | "replace">("skip");
  const [skipSimilar, setSkipSimilar] = useState(true);
  // The report the student has confirmed they looked at; a new check starts unconfirmed.
  const [lookedAt, setLookedAt] = useState<ImportReport | null>(null);
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [shown, setShown] = useState(5);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fixCopied, setFixCopied] = useState(false);
  const [defaults, setDefaults] = useState<Defaults>(NO_DEFAULTS);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);

  async function check(text: string, format: ImportFormat, name: string) {
    setError(undefined);
    setChecking(true);
    try {
      const hashes = await repo.hashes();
      setLoaded({ text, format });
      setFileName(name);
      setReport(analyzeImport(text, format, hashes, await loadComparables(repo)));
      setShown(5);
      setStage("review");
    } catch (e) {
      setError(errorText(e));
    }
    setChecking(false);
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    const lower = file.name.toLowerCase();
    const format: ImportFormat | null = lower.endsWith(".json")
      ? "json"
      : lower.endsWith(".csv")
        ? "csv"
        : null;
    if (!format) {
      setError("Choose a .json or .csv file.");
      return;
    }
    try {
      await check(await readFile(file), format, file.name);
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function pasteFromClipboard() {
    try {
      setPasted(await navigator.clipboard.readText());
      setError(undefined);
    } catch {
      setError(
        "Your browser did not allow reading the clipboard. Press and hold in the box and choose Paste.",
      );
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(CHAT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Could not copy. Select the text in the guide and copy it by hand.");
    }
  }

  async function copyFix() {
    if (!report?.ok) return;
    try {
      await navigator.clipboard.writeText(buildFixPrompt(report.errors));
      setFixCopied(true);
      setTimeout(() => setFixCopied(false), 2500);
    } catch {
      setError("Could not copy the fix request.");
    }
  }

  const rows = (report?.ok ? report.rows : []).map((r) =>
    hasDefaults(defaults) ? { ...r, input: applyDefaults(r.input, defaults) } : r,
  );
  const similar = rows.filter((r) => r.duplicate === null && r.similar !== null);
  const toImport = rows.filter((r) =>
    policy === "keep" ? true : r.duplicate === null && (!skipSimilar || r.similar === null),
  );
  const hintsOf = new Map(rows.map((r) => [r.row, allHints(r.input, qualityHints(r.input))]));
  const quality = summarise(toImport.map((r) => hintsOf.get(r.row) ?? []));
  const mustLook = quality.needLook > 0 && lookedAt !== report;
  const toReplace = policy === "replace" ? rows.filter((r) => r.duplicate === "bank") : [];
  const total = toImport.length + toReplace.length;
  const inBank = rows.filter((r) => r.duplicate === "bank").length;
  const inFile = rows.filter((r) => r.duplicate === "file").length;
  const duplicates = inBank + inFile;
  const canClipboard = typeof navigator !== "undefined" && !!navigator.clipboard?.readText;

  async function run() {
    if (!report?.ok) return;
    setStage("importing");
    setError(undefined);
    setProgress(0);
    let done = 0;
    let replaced = 0;
    let failure: string | undefined;
    try {
      if (toReplace.length > 0) {
        const ids = await bankIdsByHash(repo);
        for (const row of toReplace) {
          const id = ids.get(contentHash(row.input.stem, row.input.qtype));
          if (id) {
            await repo.update(id, row.input);
            replaced += 1;
          } else {
            await repo.create([row.input]);
            done += 1;
          }
          setProgress(Math.round(((done + replaced) / total) * 100));
        }
      }
      for (let i = 0; i < toImport.length; i += BATCH) {
        const batch = toImport.slice(i, i + BATCH).map((r) => r.input);
        await repo.create(batch);
        done += batch.length;
        setProgress(Math.round(((done + replaced) / total) * 100));
      }
    } catch (e) {
      failure = errorText(e);
    }
    if (done + replaced > 0) refresh();
    setOutcome({
      imported: done,
      replaced,
      attempted: toImport.length + toReplace.length,
      skippedDuplicates: policy === "keep" ? 0 : duplicates - toReplace.length,
      skippedSimilar: policy === "keep" || !skipSimilar ? 0 : similar.length,
      skippedInvalid: report.errors.length,
      failure,
    });
    setStage("done");
  }

  const footer =
    stage === "review" && report?.ok ? (
      <>
        <Button variant="secondary" onClick={() => setStage("choose")}>
          Back
        </Button>
        <Button disabled={total === 0 || mustLook} onClick={() => void run()}>
          {`Import ${total} question${total === 1 ? "" : "s"}`}
        </Button>
      </>
    ) : stage === "done" && outcome?.failure && loaded ? (
      <>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button loading={checking} onClick={() => void check(loaded.text, loaded.format, fileName)}>
          Check again and retry
        </Button>
      </>
    ) : stage === "done" ? (
      <Button onClick={onClose}>Done</Button>
    ) : undefined;

  return (
    <Dialog open variant="modal" title="Import questions" onClose={onClose} footer={footer}>
      {stage === "choose" && (
        <div className="flex flex-col gap-4">
          <p className="m-0 text-muted">
            Add up to {MAX_IMPORT_ROWS.toLocaleString()} questions at once. You always review them
            before anything is saved.
          </p>
          <p className="m-0 text-sm text-muted">
            {source === "ai"
              ? "Fill the form and tap Generate. You will see the questions before anything is saved."
              : source === "prompt"
                ? "Step 1. Fill the form and copy the prompt. Give it to your AI chat with your notes or photos."
                : source === "paste"
                  ? "Step 2. Paste the JSON that AI gave you, or JSON you wrote yourself."
                  : "Or upload a JSON or CSV file, such as one you exported earlier."}
          </p>
          <div
            role="tablist"
            aria-label="Import method"
            className="grid grid-cols-2 gap-1 rounded-control bg-surface-2 p-1 sm:grid-cols-4"
          >
            {(
              [
                ["ai", "Generate with AI"],
                ["prompt", "Make a prompt"],
                ["paste", "Paste JSON"],
                ["upload", "Upload file"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                type="button"
                id={`import-tab-${k}`}
                aria-selected={source === k}
                aria-controls={`import-panel-${k}`}
                onClick={() => {
                  setSource(k);
                  setError(undefined);
                }}
                className={`rounded-control px-3 py-2 text-sm font-semibold ${
                  source === k ? "bg-surface shadow-sm" : "text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {source === "ai" ? (
            <div
              role="tabpanel"
              id="import-panel-ai"
              aria-labelledby="import-tab-ai"
              className="flex flex-col gap-3"
            >
              <PromptMaker
                mode="ai"
                onGenerated={(text) => {
                  setPasted(text);
                  void check(text, "json", "AI answer");
                }}
              />
            </div>
          ) : source === "prompt" ? (
            <div
              role="tabpanel"
              id="import-panel-prompt"
              aria-labelledby="import-tab-prompt"
              className="flex flex-col gap-3"
            >
              <PromptMaker />
              <div>
                <Button variant="secondary" onClick={() => setSource("paste")}>
                  I have the JSON, go to Paste
                </Button>
              </div>
            </div>
          ) : source === "paste" ? (
            <div
              role="tabpanel"
              id="import-panel-paste"
              aria-labelledby="import-tab-paste"
              className="flex flex-col gap-3"
            >
              <label htmlFor="import-json" className="text-sm font-semibold">
                Paste the JSON here
              </label>
              <textarea
                id="import-json"
                className="lv-input font-mono text-sm"
                style={{
                  minHeight: "11rem",
                  resize: "vertical",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                }}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                placeholder={
                  '[\n  { "type": "true_false", "stem": "…", "options": [{ "text": "…", "correct": true }] }\n]'
                }
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  loading={checking}
                  disabled={pasted.trim() === ""}
                  onClick={() => void check(pasted, "json", "Pasted JSON")}
                >
                  Check questions
                </Button>
                {canClipboard && (
                  <Button variant="secondary" onClick={() => void pasteFromClipboard()}>
                    Paste from clipboard
                  </Button>
                )}
                {pasted !== "" && (
                  <Button variant="ghost" onClick={() => setPasted("")}>
                    Clear
                  </Button>
                )}
                <span className="ml-auto text-xs text-muted" aria-live="polite">
                  {pasted.length.toLocaleString()} characters
                </span>
              </div>
              <p className="m-0 text-sm text-muted">
                Copied from an AI chat with the code block around it? That works too.
              </p>
            </div>
          ) : (
            <div
              role="tabpanel"
              id="import-panel-upload"
              aria-labelledby="import-tab-upload"
              className="flex flex-col gap-3"
            >
              <p className="m-0 text-sm text-muted">
                Choose a .json or .csv file from your device.
              </p>
              <div>
                <input
                  ref={input}
                  type="file"
                  accept=".json,.csv,application/json,text/csv"
                  aria-label="Choose a file"
                  className="sr-only"
                  onChange={(e) => {
                    void choose(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <Button loading={checking} onClick={() => input.current?.click()}>
                  Choose a file
                </Button>
              </div>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="m-0 rounded-control border border-danger px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <details className="rounded-control border border-line bg-surface-2 p-3 text-sm">
            <summary className="cursor-pointer font-semibold">Format guide and examples</summary>
            <div className="mt-3 flex flex-col gap-3">
              <p className="m-0 text-muted">
                Give this to your AI chat before your request, so the answer imports without
                changes.
              </p>
              <pre className="m-0 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-control border border-line bg-surface p-2 font-mono text-xs">
                {CHAT_PROMPT}
              </pre>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => void copyPrompt()}>
                  {copied ? "Copied" : "Copy this guide"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    download("learivo-example.json", exportJson([EXAMPLE]), "application/json")
                  }
                >
                  Download example JSON
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => download("learivo-example.csv", exportCsv([EXAMPLE]), "text/csv")}
                >
                  Download example CSV
                </Button>
              </div>
            </div>
          </details>
        </div>
      )}

      {stage === "review" && report && !report.ok && (
        <div className="flex flex-col gap-3">
          <p
            role="alert"
            className="m-0 rounded-control border border-danger px-3 py-2 text-danger"
          >
            {report.message}
          </p>
          <div>
            <Button variant="secondary" onClick={() => setStage("choose")}>
              {source === "upload" ? "Choose another file" : "Edit the pasted text"}
            </Button>
          </div>
        </div>
      )}

      {stage === "review" && report?.ok && (
        <div className="flex flex-col gap-4">
          <p className="m-0 font-semibold">{fileName}</p>
          {report.notice && (
            <p
              role="status"
              className="m-0 rounded-control border border-line bg-surface-2 px-3 py-2 text-sm"
            >
              {report.notice}
            </p>
          )}
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4">
            <Tile value={report.total} label="found" />
            <Tile value={report.rows.length} label="valid" />
            <Tile value={duplicates} label="duplicates" tone="warning" />
            <Tile value={similar.length} label="look similar" tone="warning" />
            <Tile value={quality.needLook} label="need a look" tone="warning" />
            <Tile value={report.errors.length} label="invalid" tone="danger" />
          </ul>
          {error && (
            <p role="alert" className="m-0 text-sm text-danger">
              {error}
            </p>
          )}
          {quality.needLook > 0 && (
            <label className="flex items-start gap-2 rounded-control border border-line bg-surface-2 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-[var(--lv-accent)]"
                checked={lookedAt === report}
                onChange={(e) => setLookedAt(e.target.checked ? report : null)}
              />
              <span>
                {quality.needLook} question{quality.needLook === 1 ? " is" : "s are"} marked
                &ldquo;Check this&rdquo; below, for example a missing answer key or an explanation
                that argues for another option. I have looked at{" "}
                {quality.needLook === 1 ? "it" : "them"}.
                <span className="block text-muted">
                  These are rules of thumb. They cannot tell whether a fact is true, so check the
                  facts yourself.
                </span>
              </span>
            </label>
          )}
          {similar.length > 0 && policy !== "keep" && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={skipSimilar}
                onChange={(e) => setSkipSimilar(e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--lv-accent)]"
              />
              <span>
                <strong>
                  Skip {similar.length} question{similar.length === 1 ? "" : "s"} that look like
                  ones you already have.
                </strong>{" "}
                They are worded a little differently, so they are not exact copies. Each one is
                marked in the preview with the question it resembles.
              </span>
            </label>
          )}
          {duplicates > 0 && (
            <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0 text-sm">
              <legend className="mb-1 font-semibold">
                {duplicates} duplicate{duplicates === 1 ? "" : "s"}
                {inBank > 0 && inFile > 0
                  ? ` (${inBank} already in your bank, ${inFile} repeated in this import)`
                  : inBank > 0
                    ? " (already in your bank)"
                    : " (repeated in this import)"}
              </legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="dup"
                  checked={policy === "skip"}
                  onChange={() => setPolicy("skip")}
                  className="size-4 accent-[var(--lv-accent)]"
                />
                Skip them
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="dup"
                  checked={policy === "keep"}
                  onChange={() => setPolicy("keep")}
                  className="size-4 accent-[var(--lv-accent)]"
                />
                Import them anyway
              </label>
              {inBank > 0 && (
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="dup"
                    checked={policy === "replace"}
                    onChange={() => setPolicy("replace")}
                    className="size-4 accent-[var(--lv-accent)]"
                  />
                  Replace the ones already in my bank
                </label>
              )}
            </fieldset>
          )}
          {report.errors.length > 0 && (
            <details open className="text-sm">
              <summary className="cursor-pointer font-semibold">
                {report.errors.length} invalid question{report.errors.length === 1 ? "" : "s"} (not
                imported)
              </summary>
              <ul className="m-0 mt-2 flex max-h-48 list-none flex-col gap-1 overflow-y-auto p-0">
                {report.errors.slice(0, 100).map((e, i) => (
                  <li key={i} className="text-danger">
                    {source === "upload" ? "Row" : "Question"} {e.row}: {e.message}
                  </li>
                ))}
                {report.errors.length > 100 && (
                  <li className="text-muted">…and {report.errors.length - 100} more.</li>
                )}
              </ul>
              <div className="mt-2 flex flex-col gap-1">
                <div>
                  <Button variant="secondary" size="sm" onClick={() => void copyFix()}>
                    {fixCopied ? "Copied" : "Copy a fix request for the AI"}
                  </Button>
                </div>
                <span className="text-xs text-muted">
                  Paste it in the same chat. The AI sends back only the broken questions.
                </span>
              </div>
            </details>
          )}
          {report.rows.length > 0 && <DefaultsForm value={defaults} onChange={setDefaults} />}
          {report.rows.length > 0 && (
            <section aria-label="Preview" className="flex flex-col gap-2 text-sm">
              <h3 className="m-0 text-base font-semibold">
                Preview ({Math.min(shown, report.rows.length)} of {report.rows.length})
              </h3>
              {rows.slice(0, shown).map((r) => (
                <div key={r.row} className="rounded-control border border-line p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>#{r.row}</span>
                    {r.similar && r.duplicate === null && (
                      <Badge tone="warning">
                        {r.similar.from === "bank"
                          ? "Looks like one you have"
                          : "Looks like an earlier one in this file"}
                      </Badge>
                    )}
                    {(hintsOf.get(r.row) ?? []).some((h) => h.level === "check") && (
                      <Badge tone="danger">Check this</Badge>
                    )}
                    {r.duplicate && (
                      <Badge tone="warning">
                        {r.duplicate === "bank"
                          ? "Already in your bank"
                          : "Repeated in this import"}
                      </Badge>
                    )}
                  </div>
                  <QuestionPreview question={r.input} />
                  {(hintsOf.get(r.row) ?? []).length > 0 && (
                    <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-xs">
                      {(hintsOf.get(r.row) ?? []).map((h) => (
                        <li
                          key={h.id}
                          className={
                            h.level === "check" ? "font-semibold text-danger" : "text-muted"
                          }
                        >
                          {h.level === "check" ? "Check: " : "Tip: "}
                          {h.message}
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.similar && r.duplicate === null && (
                    <p className="m-0 mt-2 rounded-control bg-surface-2 p-2 text-xs">
                      {r.similar.why} Resembles: “{r.similar.stem.slice(0, 140)}”
                    </p>
                  )}
                </div>
              ))}
              {shown < report.rows.length && (
                <div>
                  <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + 10)}>
                    Show more
                  </Button>
                </div>
              )}
            </section>
          )}
          {report.rows.length === 0 && (
            <p className="m-0 text-sm text-muted">
              No valid questions to import. Fix the problems above and try again.
            </p>
          )}
        </div>
      )}

      {stage === "importing" && (
        <div className="flex flex-col gap-3 py-4" role="status">
          <p className="m-0">Importing {toImport.length} questions…</p>
          <ProgressBar value={progress} label="Import progress" />
        </div>
      )}

      {stage === "done" && outcome && (
        <div className="flex flex-col gap-3">
          {outcome.failure ? (
            <p
              role="alert"
              className="m-0 rounded-control border border-danger px-3 py-2 text-danger"
            >
              Import stopped. {outcome.failure}
            </p>
          ) : (
            <p role="status" className="m-0 text-lg font-semibold">
              Imported {outcome.imported + outcome.replaced} question
              {outcome.imported + outcome.replaced === 1 ? "" : "s"}.
            </p>
          )}
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4">
            <Tile value={outcome.imported} label="imported" />
            {outcome.replaced > 0 && <Tile value={outcome.replaced} label="replaced" />}
            <Tile value={outcome.skippedDuplicates} label="duplicates skipped" />
            {outcome.skippedSimilar > 0 && (
              <Tile value={outcome.skippedSimilar} label="similar skipped" />
            )}
            <Tile value={outcome.skippedInvalid} label="invalid skipped" />
            <Tile
              value={Math.max(0, outcome.attempted - outcome.imported)}
              label="not imported"
              tone="danger"
            />
          </ul>
          {outcome.failure && (
            <p className="m-0 text-sm text-muted">
              Questions already saved stay in your bank. Checking again skips them as duplicates, so
              retrying will not create copies.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
