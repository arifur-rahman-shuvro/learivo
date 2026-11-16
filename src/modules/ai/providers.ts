export type ProviderId = "gemini" | "openai" | "openrouter" | "anthropic";

export interface Provider {
  id: ProviderId;
  label: string;
  /** One line on cost, so the student knows what they are signing up for. */
  cost: string;
  /** Official page where the student creates a key. */
  keyUrl: string;
  /** Model used until the student picks another. */
  defaultModel: string;
  /** Suggestions in the model box. The student can type any model name. */
  models: string[];
}

export const PROVIDERS: Provider[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    cost: "Has a free plan with daily limits. Check Google's terms on how free-plan data is used.",
    keyUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-flash-latest",
    models: ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-pro"],
  },
  {
    id: "openai",
    label: "OpenAI",
    cost: "Paid. You add credit first and each request uses a little of it.",
    keyUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-5-mini",
    models: ["gpt-5-mini", "gpt-4.1-mini", "gpt-4o-mini"],
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    cost: "Paid. You add credit first and each request uses a little of it.",
    keyUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-haiku-5-5",
    models: ["claude-haiku-5-5", "claude-sonnet-5-5"],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    cost: "One key for many models. Model names ending in :free cost nothing; others use your credit.",
    keyUrl: "https://openrouter.ai/keys",
    defaultModel: "openrouter/auto",
    models: ["openrouter/auto"],
  },
];

export const providerOf = (id: ProviderId): Provider =>
  PROVIDERS.find((p) => p.id === id) ?? (PROVIDERS[0] as Provider);

export type AiErrorKind = "key" | "limit" | "credit" | "model" | "network" | "blocked" | "other";

export class AiError extends Error {
  readonly kind: AiErrorKind;
  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export interface AiConfig {
  provider: ProviderId;
  key: string;
  model: string;
}

export interface AskOptions {
  signal?: AbortSignal;
  /** Replaces fetch in tests. */
  fetchImpl?: typeof fetch;
  maxTokens?: number;
}

const OPENAI_BASE: Partial<Record<ProviderId, string>> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

function request(cfg: AiConfig, prompt: string, maxTokens: number) {
  const json = { "content-type": "application/json" };
  if (cfg.provider === "gemini") {
    const model = encodeURIComponent(cfg.model);
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      init: {
        method: "POST",
        headers: { ...json, "x-goog-api-key": cfg.key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      },
    };
  }
  if (cfg.provider === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      init: {
        method: "POST",
        headers: {
          ...json,
          "x-api-key": cfg.key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: prompt }],
        }),
      },
    };
  }
  return {
    url: `${OPENAI_BASE[cfg.provider]}/chat/completions`,
    init: {
      method: "POST",
      headers: { ...json, authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: "user", content: prompt }] }),
    },
  };
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** The provider's own error text, with the key removed and shortened. */
function detail(body: unknown, key: string): string {
  const e = obj(obj(body).error);
  const raw =
    typeof e.message === "string"
      ? e.message
      : typeof obj(body).message === "string"
        ? String(obj(body).message)
        : "";
  const clean = key ? raw.split(key).join("***") : raw;
  return clean.replace(/\s+/g, " ").trim().slice(0, 200);
}

function failure(status: number, body: unknown, cfg: AiConfig): AiError {
  const label = providerOf(cfg.provider).label;
  const why = detail(body, cfg.key);
  const more = why ? ` (${why})` : "";
  if (
    status === 401 ||
    status === 403 ||
    (status === 400 && /api key|api_key|key not valid/i.test(why))
  ) {
    return new AiError(
      "key",
      `${label} did not accept this key. Check that you copied all of it.${more}`,
    );
  }
  if (status === 402) {
    return new AiError("credit", `${label} says your account has no credit left.${more}`);
  }
  if (status === 404) {
    return new AiError(
      "model",
      `${label} does not know the model "${cfg.model}". Change the model name.${more}`,
    );
  }
  if (status === 429) {
    return new AiError(
      "limit",
      `${label} says you have used up your limit for now. Wait a little, or check your plan.${more}`,
    );
  }
  if (status >= 500) {
    return new AiError(
      "other",
      `${label} is busy or down right now. Try again in a minute.${more}`,
    );
  }
  return new AiError("other", `${label} could not do that (error ${status}).${more}`);
}

function textOf(cfg: AiConfig, body: unknown): string {
  const b = obj(body);
  if (cfg.provider === "gemini") {
    const parts = obj(obj(Array.isArray(b.candidates) ? b.candidates[0] : undefined).content).parts;
    const text = (Array.isArray(parts) ? parts : [])
      .map((p) => (typeof obj(p).text === "string" ? String(obj(p).text) : ""))
      .join("");
    if (!text && obj(b.promptFeedback).blockReason) {
      throw new AiError(
        "blocked",
        "Gemini refused this request. Change the topic or notes and try again.",
      );
    }
    return text;
  }
  if (cfg.provider === "anthropic") {
    return (Array.isArray(b.content) ? b.content : [])
      .map((p) => (typeof obj(p).text === "string" ? String(obj(p).text) : ""))
      .join("");
  }
  const msg = obj(obj(Array.isArray(b.choices) ? b.choices[0] : undefined).message);
  return typeof msg.content === "string" ? msg.content : "";
}

/** Sends one prompt to the student's AI and returns its text. The key is only ever sent to that provider. */
export async function askAi(cfg: AiConfig, prompt: string, opts: AskOptions = {}): Promise<string> {
  const doFetch = opts.fetchImpl ?? fetch;
  const { url, init } = request(cfg, prompt, opts.maxTokens ?? 16000);
  let res: Response;
  try {
    res = await doFetch(url, { ...init, signal: opts.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new AiError("other", "Stopped.");
    }
    throw new AiError(
      "network",
      `Could not reach ${providerOf(cfg.provider).label}. Check your internet and try again.`,
    );
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw failure(res.status, body, cfg);
  const text = textOf(cfg, body).trim();
  if (!text)
    throw new AiError(
      "other",
      `${providerOf(cfg.provider).label} sent back an empty answer. Try again.`,
    );
  return text;
}
