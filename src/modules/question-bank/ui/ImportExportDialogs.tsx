import { useRef, useState } from "react";
import { Badge, Button, Dialog, ProgressBar } from "../../../design-system/index.ts";
import {
  MAX_IMPORT_ROWS,
  analyzeImport,
  exportCsv,
  exportJson,
  type ImportFormat,
  type ImportReport,
} from "../domain/importExport.ts";
import { blankQuestion, type QuestionInput } from "../domain/model.ts";
import { errorText, useBank } from "./bank.tsx";
import { QuestionPreview } from "./QuestionPreview.tsx";

const BATCH = 500;

function readFile(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

function download(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const EXAMPLE: QuestionInput = {
  ...blankQuestion("sba"),
  stem: "Which drug inhibits vitamin K dependent clotting factors?",
  answer: {
    options: [
      { text: "Aspirin", correct: false },
      { text: "Warfarin", correct: true },
      { text: "Heparin", correct: false },
      { text: "Clopidogrel", correct: false },
    ],
  },
  explanation: "Warfarin blocks vitamin K epoxide reductase.",
  difficulty: 2,
  path: ["Pharmacology", "Anticoagulants"],
  tags: ["high-yield"],
};

type Stage = "choose" | "review" | "importing" | "done";
type Source = "paste" | "upload";

interface Outcome {
  imported: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  /** Set when the import stopped part-way. */
  failure?: string;
  attempted: number;
}

/** What to tell ChatGPT so that its answer imports cleanly. */
const CHAT_PROMPT = `Write the questions as JSON only, with no text before or after it. Use this format:
[
  {
    "type": "sba",
    "stem": "The question text",
    "options": [
      { "text": "Option A", "correct": false },
      { "text": "Option B", "correct": true }
    ],
    "explanation": "Why the answer is right",
    "difficulty": 2,
    "subject": "Subject",
    "chapter": "Chapter",
    "tags": ["tag"]
  }
]
"type" is one of: sba, single_choice, multi_select, true_false, short_answer, fill_blank.
For true_false use "answer": true or false. For short_answer use "accepted": ["answer", "other accepted answer"].
For fill_blank write {{1}}, {{2}} in the stem and use "blanks": [["answer for 1"], ["answer for 2"]].
Every option type needs at least 2 options and exactly one correct option (multi_select needs one or more).`;

function Tile({
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

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const { repo, refresh } = useBank();
  const [stage, setStage] = useState<Stage>("choose");
  const [source, setSource] = useState<Source>("paste");
  const [pasted, setPasted] = useState("");
  const [fileName, setFileName] = useState("");
  const [loaded, setLoaded] = useState<{ text: string; format: ImportFormat } | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [shown, setShown] = useState(5);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);

  async function check(text: string, format: ImportFormat, name: string) {
    setError(undefined);
    setChecking(true);
    try {
      const hashes = await repo.hashes();
      setLoaded({ text, format });
      setFileName(name);
      setReport(analyzeImport(text, format, hashes));
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

  const rows = report?.ok ? report.rows : [];
  const toImport = rows.filter((r) => !(skipDuplicates && r.duplicate));
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
    let failure: string | undefined;
    try {
      for (let i = 0; i < toImport.length; i += BATCH) {
        const batch = toImport.slice(i, i + BATCH).map((r) => r.input);
        await repo.create(batch);
        done += batch.length;
        setProgress(Math.round((done / toImport.length) * 100));
      }
    } catch (e) {
      failure = errorText(e);
    }
    if (done > 0) refresh();
    setOutcome({
      imported: done,
      attempted: toImport.length,
      skippedDuplicates: skipDuplicates ? duplicates : 0,
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
        <Button disabled={toImport.length === 0} onClick={() => void run()}>
          {`Import ${toImport.length} question${toImport.length === 1 ? "" : "s"}`}
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
            Add up to {MAX_IMPORT_ROWS.toLocaleString()} questions at once. You review everything
            before anything is saved.
          </p>
          <div
            role="tablist"
            aria-label="Import method"
            className="grid grid-cols-2 gap-1 rounded-control bg-surface-2 p-1"
          >
            {(
              [
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

          {source === "paste" ? (
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
                placeholder={'[\n  { "type": "true_false", "stem": "…", "answer": true }\n]'}
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
                Copied from ChatGPT with the code block around it? That works too.
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
                Give this to ChatGPT before your request, so the answer imports without changes.
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
              {source === "paste" ? "Edit the pasted text" : "Choose another file"}
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
            <Tile value={report.errors.length} label="invalid" tone="danger" />
          </ul>
          {error && (
            <p role="alert" className="m-0 text-sm text-danger">
              {error}
            </p>
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
                  checked={skipDuplicates}
                  onChange={() => setSkipDuplicates(true)}
                  className="size-4 accent-[var(--lv-accent)]"
                />
                Skip them
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="dup"
                  checked={!skipDuplicates}
                  onChange={() => setSkipDuplicates(false)}
                  className="size-4 accent-[var(--lv-accent)]"
                />
                Import them anyway
              </label>
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
                    {source === "paste" ? "Question" : "Row"} {e.row}: {e.message}
                  </li>
                ))}
                {report.errors.length > 100 && (
                  <li className="text-muted">…and {report.errors.length - 100} more.</li>
                )}
              </ul>
            </details>
          )}
          {report.rows.length > 0 && (
            <section aria-label="Preview" className="flex flex-col gap-2 text-sm">
              <h3 className="m-0 text-base font-semibold">
                Preview ({Math.min(shown, report.rows.length)} of {report.rows.length})
              </h3>
              {report.rows.slice(0, shown).map((r) => (
                <div key={r.row} className="rounded-control border border-line p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>#{r.row}</span>
                    {r.duplicate && (
                      <Badge tone="warning">
                        {r.duplicate === "bank"
                          ? "Already in your bank"
                          : "Repeated in this import"}
                      </Badge>
                    )}
                  </div>
                  <QuestionPreview question={r.input} />
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
              Imported {outcome.imported} question{outcome.imported === 1 ? "" : "s"}.
            </p>
          )}
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4">
            <Tile value={outcome.imported} label="imported" />
            <Tile value={outcome.skippedDuplicates} label="duplicates skipped" />
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

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const { repo } = useBank();
  const [busy, setBusy] = useState<ImportFormat | null>(null);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  async function run(format: ImportFormat) {
    setBusy(format);
    setError(undefined);
    setMessage(undefined);
    try {
      const all = await repo.exportAll();
      if (all.length === 0) {
        setMessage("There are no active questions to export yet.");
      } else if (format === "json") {
        download("learivo-questions.json", exportJson(all), "application/json");
        setMessage(`Exported ${all.length} question${all.length === 1 ? "" : "s"}.`);
      } else {
        download("learivo-questions.csv", exportCsv(all), "text/csv");
        setMessage(`Exported ${all.length} question${all.length === 1 ? "" : "s"}.`);
      }
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(null);
  }

  return (
    <Dialog open variant="modal" title="Export questions" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="m-0 text-muted">
          Download every active question. JSON keeps everything and imports back into Learivo. CSV
          opens in a spreadsheet.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button loading={busy === "json"} onClick={() => void run("json")}>
            Export as JSON
          </Button>
          <Button variant="secondary" loading={busy === "csv"} onClick={() => void run("csv")}>
            Export as CSV
          </Button>
        </div>
        {message && (
          <p role="status" className="m-0 font-semibold">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="m-0 text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
