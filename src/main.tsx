import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/nunito-sans";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "virtual:learivo-theme.css";
import "./app.css";
import AppShell from "./app/AppShell.tsx";
import { AuthProvider } from "./auth/AuthProvider.tsx";
import { createSupabaseAuth } from "./auth/supabaseClient.ts";
import { ThemeProvider } from "./themes/ThemeProvider.tsx";
import { registerServiceWorker } from "./pwa/pwa.ts";

registerServiceWorker();
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
