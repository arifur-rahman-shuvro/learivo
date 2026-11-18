import { analyzeImport, parseImportFile } from "../question-bank/domain/importExport.ts";
import { BATCH_SIZE, buildPrompt, type PromptSpec } from "../question-bank/domain/promptBuilder.ts";
import { askAi, type AiConfig, type AskOptions } from "./providers.ts";

export interface Generated {
  /** The AI's reply, ready for the import checker. */
  text: string;
  /** True when the first reply was unreadable and the AI was asked once more. */
  retried: boolean;
  /** Questions actually asked for (never above one batch). */
  asked: number;
}

/**
 * Asks the student's AI for questions using the prompt maker's prompt. If the reply cannot be read
 * at all, asks once more with what went wrong. Whatever comes back still goes through the import
 * preview, so nothing is saved without the student seeing it.
 */
export async function generateQuestions(
  cfg: AiConfig,
  spec: PromptSpec,
  opts: AskOptions = {},
): Promise<Generated> {
  const asked =
    spec.mode === "create"
      ? Math.min(Math.max(1, Math.round(spec.count) || 1), BATCH_SIZE)
      : BATCH_SIZE;
  const prompt = buildPrompt({ ...spec, count: asked });
  const first = await askAi(cfg, prompt, opts);
  const rep = analyzeImport(first, "json", new Set());
  if (rep.ok && rep.rows.length > 0) return { text: first, retried: false, asked };

  const why = rep.ok
    ? rep.errors
        .slice(0, 10)
        .map((e) => `- Question ${e.row}: ${e.message}`)
        .join("\n")
    : rep.message;
  const second = await askAi(
    cfg,
    `${prompt}\n\nYour last reply could not be used:\n${why}\n\nReply again with the complete, corrected JSON only.`,
    opts,
  );
  return { text: second, retried: true, asked };
}

export interface Progress {
  batch: number;
  batches: number;
  /** Questions collected so far. */
  have: number;
}

export interface GeneratedMany extends Generated {
  /** Questions the student asked for. */
  wanted: number;
  /** Set when a later batch failed: the earlier questions are still returned. */
  stoppedBecause: string | null;
}

/**
 * Writes more than one batch's worth of questions, one request per batch. Each request lists the
 * statements already written so the AI does not repeat them. If a later batch fails, the questions
 * collected so far are kept and the reason is returned.
 */
export async function generateMany(
  cfg: AiConfig,
  spec: PromptSpec,
  opts: AskOptions & { onProgress?: (p: Progress) => void } = {},
): Promise<GeneratedMany> {
  const { onProgress, ...ask } = opts;
  const wanted =
    spec.mode === "create" ? Math.min(Math.max(1, Math.round(spec.count) || 1), 200) : BATCH_SIZE;
  const batches = Math.ceil(wanted / BATCH_SIZE);
  const records: Record<string, unknown>[] = [];
  let retried = false;
  let stoppedBecause: string | null = null;

  for (let b = 0; b < batches; b++) {
    onProgress?.({ batch: b + 1, batches, have: records.length });
    const count = Math.min(BATCH_SIZE, wanted - records.length);
    const earlier = records
      .slice(-60)
      .map((r) => `- ${String(r.stem ?? "").slice(0, 90)}`)
      .join("\n");
    const note =
      earlier === ""
        ? spec.extra
        : `${spec.extra}\nDo not repeat or reword any of these questions already written:\n${earlier}`.trim();
    try {
      const out = await generateQuestions(cfg, { ...spec, count, extra: note }, ask);
      retried ||= out.retried;
      const file = parseImportFile(out.text, "json");
      if (!file.ok) throw new Error(file.message);
      records.push(...file.records.map((r) => r.raw));
    } catch (e) {
      if (records.length === 0) throw e;
      stoppedBecause = e instanceof Error ? e.message : "A later batch failed.";
      break;
    }
  }
  return {
    text: JSON.stringify(records),
    retried,
    asked: records.length,
    wanted,
    stoppedBecause,
  };
}
