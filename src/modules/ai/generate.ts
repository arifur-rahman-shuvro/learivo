import { analyzeImport } from "../question-bank/domain/importExport.ts";
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
