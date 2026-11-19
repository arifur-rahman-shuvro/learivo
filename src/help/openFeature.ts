import { openAiConnection } from "../core/dialogs/ai.ts";
import { openBackup } from "../core/dialogs/backup.ts";
import { openGuide } from "../core/dialogs/guide.ts";
import { sendIntent } from "../core/intents.ts";
import type { Feature } from "./features.ts";

/** Does what a feature tile promises: opens its dialog, or its screen (and the part of it). */
export function openFeature(f: Feature, onNavigate: (route: string) => void) {
  if (f.action === "guide") return openGuide();
  if (f.action === "ai") return openAiConnection();
  if (f.action === "backup") return openBackup();
  if (f.action) sendIntent({ kind: f.action });
  else if (f.target) sendIntent({ kind: "open", target: f.target });
  onNavigate(f.route);
}
