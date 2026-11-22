// Test-only entry for the offline flows. The real offline layer (copy on the device, queue of
// changes, sync) runs in the browser on top of an in-memory stand-in for the database. The
// stand-in fails like a dead connection whenever the browser says it is offline, so switching
// the test browser offline behaves like losing signal. Not part of the production build.
import { createRoot } from "react-dom/client";
import "../src/ui-kit/themes/fonts.css";
import "virtual:learivo-theme.css";
import "../src/styles/index.css";
import AppShell from "../src/shell/AppShell.tsx";
import { AuthProvider } from "../src/auth/AuthProvider.tsx";
import { ThemeProvider } from "../src/ui-kit/themes/ThemeProvider.tsx";
import { fakeAuth } from "../src/testing/fakeAuth.ts";
import { MemoryRepo } from "../src/modules/question-bank/data/memoryRepo.ts";
import { MemoryAttempts } from "../src/modules/practice/data/memoryAttempts.ts";
import { MemoryWorkspace } from "../src/modules/workspace/data/memoryWorkspace.ts";

const bank = new MemoryRepo();
const attempts = new MemoryAttempts();
const workspace = new MemoryWorkspace();

/** Every call fails like a lost connection while the browser is offline. */
function viaNetwork<T extends object>(target: T): T {
  return new Proxy(target, {
    get(t, key, receiver) {
      const value = Reflect.get(t, key, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        if (!navigator.onLine) return Promise.reject(new TypeError("Failed to fetch"));
        return (value as (...a: unknown[]) => unknown).apply(t, args);
      };
    },
  });
}

// The test reads what the "database" holds through this.
(window as unknown as { __bank: MemoryRepo }).__bank = bank;

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <AuthProvider client={fakeAuth({ id: "e2e", email: "e2e@example.test" })}>
      <AppShell
        makeLive={() => ({ bank: viaNetwork(bank), attempts: viaNetwork(attempts) })}
        makeWorkspace={() => workspace}
      />
    </AuthProvider>
  </ThemeProvider>,
);
