// Test-only entry used by `pnpm e2e` through the Vite dev server. It runs the real app screens
// with in-memory data and a built-in signed-in student, so browser tests need no account and
// touch no real data. It is not part of the production build (only index.html is built).
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

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <AuthProvider client={fakeAuth({ id: "e2e", email: "e2e@example.test" })}>
      <AppShell
        makeRepo={() => bank}
        makeAttempts={() => attempts}
        makeWorkspace={() => workspace}
      />
    </AuthProvider>
  </ThemeProvider>,
);
