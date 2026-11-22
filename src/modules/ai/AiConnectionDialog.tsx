import { useState } from "react";
import { Button, Dialog, Picker } from "../../ui-kit/index.ts";
import { keyGuidePrompt } from "./guidePrompt.ts";
import { aiState, removeKey, saveAi, useAiState } from "./keys.ts";
import { closeAiConnection, useAiDialogOpen } from "../../core/dialogs/ai.ts";
import {
  AiError,
  PROVIDERS,
  askAi,
  providerOf,
  type AiErrorKind,
  type ProviderId,
} from "./providers.ts";
import { resetUsage, useUsage } from "./usage.ts";

/** What to do next, for each kind of failure. The provider's own words come first. */
export const ADVICE: Record<AiErrorKind, string> = {
  key: "Open the key page below, make a new key and paste all of it. A key that was deleted or copied in part will not work.",
  credit: "Add credit on the provider's billing page, then test again.",
  limit: "You have hit the provider's limit. Wait a few minutes, or use another provider.",
  model: "Pick a model from the list in the Model box, or clear the box to use the default.",
  network: "Check that your internet works. Some school or office networks block AI sites.",
  blocked: "The provider refused the test. Try again, or use another provider.",
  other: "Try again in a minute. If it keeps failing, use another provider.",
};

type Test =
  | { state: "idle" }
  | { state: "busy" }
  | { state: "ok" }
  | { state: "bad"; message: string; kind: AiErrorKind };

/** Connects the student's own AI account. The key stays on this device. */
export function AiConnectionDialog() {
  const open = useAiDialogOpen();
  return open ? <Inner /> : null;
}

function Inner() {
  const saved = useAiState();
  const [provider, setProvider] = useState<ProviderId>(saved.provider);
  const [key, setKey] = useState(saved.keys[saved.provider] ?? "");
  const [model, setModel] = useState(saved.models[saved.provider] ?? "");
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<Test>({ state: "idle" });
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const info = providerOf(provider);
  const use = useUsage(provider);

  const pick = (id: ProviderId) => {
    const s = aiState();
    setProvider(id);
    setKey(s.keys[id] ?? "");
    setModel(s.models[id] ?? "");
    setTest({ state: "idle" });
  };

  async function check() {
    setTest({ state: "busy" });
    try {
      await askAi(
        { provider, key: key.trim(), model: model.trim() || info.defaultModel },
        "Reply with the single word OK.",
        { maxTokens: 64, signal: AbortSignal.timeout(30000) },
      );
      saveAi(provider, key, model);
      setTest({ state: "ok" });
    } catch (e) {
      setTest({
        state: "bad",
        message: e instanceof AiError ? e.message : "Something went wrong. Try again.",
        kind: e instanceof AiError ? e.kind : "other",
      });
    }
  }

  async function copyGuide() {
    try {
      await navigator.clipboard.writeText(keyGuidePrompt(provider));
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied(null), 2500);
  }

  const connected = Boolean((saved.keys[provider] ?? "").trim());
  return (
    <Dialog
      open
      variant="modal"
      title="AI connection"
      onClose={closeAiConnection}
      footer={<Button onClick={closeAiConnection}>Done</Button>}
    >
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm text-muted">
          Connect your own AI account and Learivo can write questions for you. Your key stays on
          this device. It is not sent to Learivo&apos;s servers. Any cost or limit is between you
          and the AI provider, and the key is forgotten when you sign out.
        </p>

        <div className="flex flex-col gap-1">
          <Picker
            label="AI provider"
            value={provider}
            options={PROVIDERS.map((p) => ({
              value: p.id,
              label: p.label,
              hint: (saved.keys[p.id] ?? "").trim() ? "Connected" : undefined,
              description: p.cost,
            }))}
            onChange={(v) => pick(v as ProviderId)}
          />
          <p className="m-0 text-xs text-muted">{info.cost}</p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ai-key" className="text-sm font-semibold">
            API key
          </label>
          <div className="flex gap-2">
            <input
              id="ai-key"
              className="lv-input min-w-0 flex-1"
              type={show ? "text" : "password"}
              value={key}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => {
                setKey(e.target.value);
                setTest({ state: "idle" });
              }}
            />
            <Button variant="ghost" size="sm" onClick={() => setShow((v) => !v)}>
              {show ? "Hide" : "Show"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ai-model" className="text-sm font-semibold">
            Model
          </label>
          <input
            id="ai-model"
            className="lv-input"
            list="ai-models"
            value={model}
            placeholder={info.defaultModel}
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => setModel(e.target.value)}
          />
          <datalist id="ai-models">
            {info.models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <p className="m-0 text-xs text-muted">
            Leave it as it is unless the test says the model is not found. Providers rename their
            models from time to time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            loading={test.state === "busy"}
            disabled={key.trim() === ""}
            onClick={() => void check()}
          >
            Test and save
          </Button>
          {connected && (
            <Button
              variant="ghost"
              onClick={() => {
                removeKey(provider);
                setKey("");
                setTest({ state: "idle" });
              }}
            >
              Remove key from this device
            </Button>
          )}
        </div>
        {test.state === "ok" && (
          <p role="status" className="m-0 text-sm font-semibold">
            Connected. {info.label} answered, and the key is saved on this device.
          </p>
        )}
        {test.state === "bad" && (
          <div role="alert" className="flex flex-col gap-1 text-sm">
            <p className="m-0 text-danger">{test.message}</p>
            <p className="m-0">{ADVICE[test.kind]}</p>
          </div>
        )}

        <section
          aria-label="Use on this device"
          className="flex flex-col gap-1 border-t border-line pt-3"
        >
          <h3 className="m-0 text-base font-semibold">Use on this device</h3>
          <p className="m-0 text-sm">
            {info.label}: {use.todayRequests} {use.todayRequests === 1 ? "request" : "requests"}{" "}
            today, {use.requests} in all.
            {use.tokens > 0 && ` About ${use.tokens.toLocaleString("en")} tokens in all.`}
          </p>
          <p className="m-0 text-xs text-muted">
            This only counts what this device sent. The provider&apos;s site shows your real usage
            and bill.
          </p>
          {use.requests > 0 && (
            <div>
              <Button variant="ghost" size="sm" onClick={resetUsage}>
                Reset counter
              </Button>
            </div>
          )}
        </section>

        <section
          aria-label="How to get a key"
          className="flex flex-col gap-2 border-t border-line pt-3"
        >
          <h3 className="m-0 text-base font-semibold">How to get a key</h3>
          <ol className="m-0 flex flex-col gap-1 pl-5 text-sm">
            <li>
              Open the official key page:{" "}
              <a href={info.keyUrl} target="_blank" rel="noreferrer noopener" className="underline">
                {info.keyUrl.replace("https://", "")}
              </a>
            </li>
            <li>Sign in, then choose to create a new key and name it &quot;learivo&quot;.</li>
            <li>Copy the key, come back here and paste it above.</li>
            <li>
              Tap Test and save. Set a low spending limit on the provider&apos;s site if it has one.
            </li>
          </ol>
          <p className="m-0 text-xs text-muted">
            Never share the key with anyone, and never paste it in a chat. If it leaks, delete it on
            the provider&apos;s site and make a new one.
          </p>
          <div className="flex flex-col gap-1">
            <p className="m-0 text-sm">
              Stuck? Copy this and give it to any AI chat. It will guide you step by step.
            </p>
            <div>
              <Button variant="secondary" size="sm" onClick={() => void copyGuide()}>
                {copied === "ok"
                  ? "Copied"
                  : copied === "fail"
                    ? "Copy failed"
                    : "Copy guide prompt"}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Dialog>
  );
}
