import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/nunito-sans";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "virtual:learivo-theme.css";
import "./styles/index.css";
import AppShell from "./shell/AppShell.tsx";
import { AuthProvider } from "./auth/AuthProvider.tsx";
import { createSupabaseAuth } from "./auth/supabaseClient.ts";
import { ThemeProvider } from "./ui-kit/themes/ThemeProvider.tsx";
import { registerServiceWorker } from "./platform/pwa/pwa.ts";
import { startMonitoring } from "./core/monitoring.ts";
import { trackOrigins } from "./motion/index.ts";

trackOrigins();
registerServiceWorker();
void startMonitoring();
const authClient = createSupabaseAuth();
const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider client={authClient}>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
