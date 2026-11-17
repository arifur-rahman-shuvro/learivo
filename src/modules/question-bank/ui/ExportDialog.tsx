import { useState } from "react";
import { Button, Dialog } from "../../../design-system/index.ts";
import { exportCsv, exportJson, type ImportFormat } from "../domain/importExport.ts";
import { errorText, useBank } from "./bank.tsx";
import { download } from "./importParts.tsx";

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
