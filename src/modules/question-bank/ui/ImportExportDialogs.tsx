import { useRef, useState } from "react";
import { Button, Dialog, ProgressBar } from "../../../design-system/index.ts";
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

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const { repo, refresh } = useBank();
  const [stage, setStage] = useState<Stage>("choose");
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);

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
      const text = await readFile(file);
      const hashes = await repo.hashes();
      setFileName(file.name);
      setReport(analyzeImport(text, format, hashes));
      setStage("review");
    } catch (e) {
      setError(errorText(e));
    }
  }

  const rows = report?.ok ? report.rows : [];
  const toImport = rows.filter((r) => !(skipDuplicates && r.duplicate));
  const duplicates = rows.filter((r) => r.duplicate).length;

  async function run() {
    setStage("importing");
    setError(undefined);
    let done = 0;
    try {
      for (let i = 0; i < toImport.length; i += BATCH) {
        const batch = toImport.slice(i, i + BATCH).map((r) => r.input);
        await repo.create(batch);
        done += batch.length;
        setProgress(Math.round((done / toImport.length) * 100));
      }
      setImported(done);
      refresh();
      setStage("done");
    } catch (e) {
      setImported(done);
      refresh();
      setError(
        `${errorText(e)} ${done} question${done === 1 ? " was" : "s were"} imported before it stopped.`,
      );
      setStage("review");
    }
  }

  return (
    <Dialog
      open
      variant="modal"
      title="Import questions"
      onClose={onClose}
      footer={
        stage === "review" && report?.ok ? (
          <>
            <Button variant="secondary" onClick={() => setStage("choose")}>
              Choose another file
            </Button>
            <Button disabled={toImport.length === 0} onClick={() => void run()}>
              {`Import ${toImport.length} question${toImport.length === 1 ? "" : "s"}`}
            </Button>
          </>
        ) : stage === "done" ? (
          <Button onClick={onClose}>Done</Button>
        ) : undefined
      }
    >
      {stage === "choose" && (
        <div className="flex flex-col gap-4">
          <p className="m-0 text-muted">
            Import up to {MAX_IMPORT_ROWS.toLocaleString()} questions from a JSON or CSV file.
            Nothing is saved until you review the file and confirm.
          </p>
          <div>
            <input
              ref={input}
              type="file"
              accept=".json,.csv,application/json,text/csv"
              aria-label="Choose a file"
              className="sr-only"
              onChange={(e) => void choose(e.target.files?.[0])}
            />
            <Button onClick={() => input.current?.click()}>Choose a file</Button>
          </div>
          {error && (
            <p role="alert" className="m-0 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="rounded-control border border-line bg-surface-2 p-3 text-sm">
            <div className="mb-2 font-semibold">Need a starting point?</div>
            <div className="flex flex-wrap gap-2">
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
        </div>
      )}

      {stage === "review" && report && !report.ok && (
        <div className="flex flex-col gap-3">
          <p role="alert" className="m-0 text-danger">
            {report.message}
          </p>
          <div>
            <Button variant="secondary" onClick={() => setStage("choose")}>
              Choose another file
            </Button>
          </div>
        </div>
      )}

      {stage === "review" && report?.ok && (
        <div className="flex flex-col gap-4">
          <p className="m-0 font-semibold">{fileName}</p>
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 text-sm sm:grid-cols-4">
            <li className="rounded-control border border-line p-2">
              <div className="text-xl font-bold">{report.total}</div>
              <div className="text-muted">in file</div>
            </li>
            <li className="rounded-control border border-line p-2">
              <div className="text-xl font-bold">{report.rows.length}</div>
              <div className="text-muted">valid</div>
            </li>
            <li className="rounded-control border border-line p-2">
              <div className="text-xl font-bold">{report.errors.length}</div>
              <div className="text-muted">with problems</div>
            </li>
            <li className="rounded-control border border-line p-2">
              <div className="text-xl font-bold">{duplicates}</div>
              <div className="text-muted">duplicates</div>
            </li>
          </ul>
          {error && (
            <p role="alert" className="m-0 text-sm text-danger">
              {error}
            </p>
          )}
          {duplicates > 0 && (
            <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0 text-sm">
              <legend className="mb-1 font-semibold">Duplicates (same text and type)</legend>
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
                {report.errors.length} problem{report.errors.length === 1 ? "" : "s"} (these rows
                are skipped)
              </summary>
              <ul className="m-0 mt-2 flex max-h-48 list-none flex-col gap-1 overflow-y-auto p-0">
                {report.errors.slice(0, 100).map((e, i) => (
                  <li key={i} className="text-danger">
                    Row {e.row}: {e.message}
                  </li>
                ))}
                {report.errors.length > 100 && (
                  <li className="text-muted">…and {report.errors.length - 100} more.</li>
                )}
              </ul>
            </details>
          )}
          {report.rows.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold">
                Preview the first 5 questions
              </summary>
              <div className="mt-2 flex flex-col gap-3">
                {report.rows.slice(0, 5).map((r) => (
                  <div key={r.row} className="rounded-control border border-line p-3">
                    <QuestionPreview question={r.input} />
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {stage === "importing" && (
        <div className="flex flex-col gap-3 py-4" role="status">
          <p className="m-0">Importing {toImport.length} questions…</p>
          <ProgressBar value={progress} label="Import progress" />
        </div>
      )}

      {stage === "done" && (
        <p role="status" className="m-0 text-lg font-semibold">
          Imported {imported} question{imported === 1 ? "" : "s"}.
        </p>
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
