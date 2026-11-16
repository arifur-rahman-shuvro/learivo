import { providerOf, type ProviderId } from "./providers.ts";

/** A prompt the student can give to any AI chat so it walks them through getting a key. */
export function keyGuidePrompt(id: ProviderId): string {
  const p = providerOf(id);
  return [
    `I want to use ${p.label} inside a study app that lets me paste my own API key.`,
    'I am not a programmer. Guide me one small step at a time, and wait for me to say "done" before the next step.',
    "",
    "Please help me:",
    `1. Open the official page to create an API key: ${p.keyUrl}`,
    "2. Sign in or sign up, and tell me honestly if I need to add a payment method or credit, and whether there is a free plan.",
    '3. Create a key, give it a name like "learivo", and copy it.',
    "4. Set a low monthly spending limit if the site allows it.",
    "5. Tell me how to paste the key into the app: open Settings, then AI connection, choose the provider, paste the key, and tap Test connection.",
    "",
    "Rules for you:",
    "- Send me only to official websites for this provider. If you are not sure a page or button still exists, say so instead of guessing.",
    "- Never ask me to paste my key into this chat. If I do by mistake, tell me to delete that key and make a new one.",
    "- Explain in simple words and keep each step short.",
  ].join("\n");
}
