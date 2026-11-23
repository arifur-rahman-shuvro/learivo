import { analyzeImport, parseImportFile } from "../question-bank/domain/importExport.ts";
import {
  BATCH_SIZE,
  COVERAGE_MAX,
  buildPlanPrompt,
  buildPrompt,
  type PromptSpec,
} from "../question-bank/domain/promptBuilder.ts";
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

export interface PlanItem {
  point: string;
  questions: number;
}

/** Reads the AI's coverage plan. Returns null when it cannot be used. Total is capped at COVERAGE_MAX. */
export function parsePlan(text: string): PlanItem[] | null {
  const fenced = /```[a-zA-Z]*[ \t]*\r?\n?([\s\S]*?)```/.exec(text);
  const body = (fenced?.[1] ?? text).trim();
  const from = body.indexOf("{");
  const to = body.lastIndexOf("}");
  if (from < 0 || to <= from) return null;
  let data: unknown;
  try {
    data = JSON.parse(body.slice(from, to + 1));
  } catch {
    return null;
  }
  const list = (data as { plan?: unknown }).plan;
  if (!Array.isArray(list)) return null;
  const plan: PlanItem[] = [];
  let total = 0;
  for (const raw of list.slice(0, 30)) {
    const r = raw as { point?: unknown; questions?: unknown };
    const point = typeof r.point === "string" ? r.point.trim().slice(0, 120) : "";
    const n = Math.round(Number(r.questions));
    if (point === "" || !Number.isFinite(n) || n < 1) continue;
    const questions = Math.min(5, n);
    if (total + questions > COVERAGE_MAX) break;
    plan.push({ point, questions });
    total += questions;
  }
  return plan.length > 0 ? plan : null;
}

/** Asks the AI what the topic needs, once more if the first reply cannot be read. */
export async function planCoverage(
  cfg: AiConfig,
  spec: PromptSpec,
  opts: AskOptions = {},
): Promise<PlanItem[]> {
  const prompt = buildPlanPrompt(spec);
  const first = parsePlan(await askAi(cfg, prompt, opts));
  if (first) return first;
  const second = parsePlan(
    await askAi(
      cfg,
      `${prompt}\n\nYour last reply could not be used. Reply again with the JSON only.`,
      opts,
    ),
  );
  if (second) return second;
  throw new Error("The AI did not give a usable plan of what to cover. Try again.");
}

/** Groups plan points into batches of at most BATCH_SIZE questions, keeping the plan order. */
export function planBatches(plan: PlanItem[]): PlanItem[][] {
  const batches: PlanItem[][] = [];
  let current: PlanItem[] = [];
  let size = 0;
  for (const item of plan) {
    if (size + item.questions > BATCH_SIZE && current.length > 0) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(item);
    size += item.questions;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export interface Progress {
  /** "plan" while the AI is deciding what to cover. */
  phase?: "plan" | "write";
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
  const auto = spec.mode === "create" && spec.autoCount;
  let plan: PlanItem[][] | null = null;
  if (auto) {
    onProgress?.({ phase: "plan", batch: 0, batches: 0, have: 0 });
    plan = planBatches(await planCoverage(cfg, spec, ask));
  }
  const wanted = plan
    ? plan.flat().reduce((n, i) => n + i.questions, 0)
    : spec.mode === "create"
      ? Math.min(Math.max(1, Math.round(spec.count) || 1), 200)
      : BATCH_SIZE;
  const batches = plan ? plan.length : Math.ceil(wanted / BATCH_SIZE);
  const records: Record<string, unknown>[] = [];
  let retried = false;
  let stoppedBecause: string | null = null;

  for (let b = 0; b < batches; b++) {
    onProgress?.({ phase: "write", batch: b + 1, batches, have: records.length });
    const part = plan?.[b];
    const count = part
      ? part.reduce((n, i) => n + i.questions, 0)
      : Math.min(BATCH_SIZE, wanted - records.length);
    const cover = part
      ? `Write exactly these questions, the number for each point in brackets:\n${part.map((i) => `- ${i.point} (${i.questions})`).join("\n")}`
      : "";
    const earlier = records
      .slice(-60)
      .map((r) => `- ${String(r.stem ?? "").slice(0, 90)}`)
      .join("\n");
    const note = [
      spec.extra,
      cover,
      earlier === ""
        ? ""
        : `Do not repeat or reword any of these questions already written:\n${earlier}`,
    ]
      .filter((x) => x.trim() !== "")
      .join("\n");
    try {
      const out = await generateQuestions(
        cfg,
        { ...spec, count, autoCount: false, extra: note },
        ask,
      );
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
