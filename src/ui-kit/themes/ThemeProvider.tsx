import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getTheme, isThemeId, resolveMode } from "./registry.ts";
import type { Mode, ModePreference, ThemeDefinition, ThemeId } from "./types.ts";

const THEME_KEY = "learivo.theme";
const MODE_KEY = "learivo.mode";

interface ThemeContextValue {
  theme: ThemeDefinition;
  themeId: ThemeId;
  /** What the user chose: light, dark or follow the system. */
  modePreference: ModePreference;
  /** The mode actually applied (a theme may not support the chosen mode). */
  mode: Mode;
  setTheme: (id: ThemeId) => void;
  setModePreference: (m: ModePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice simply is not remembered on this device */
  }
}

function systemMode(): Mode {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const saved = read(THEME_KEY);
    return isThemeId(saved) ? saved : "default";
  });
  const [modePreference, setModePref] = useState<ModePreference>(() => {
    const saved = read(MODE_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });
  const [system, setSystem] = useState<Mode>(systemMode);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = () => setSystem(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const theme = getTheme(themeId);
  const requested: Mode = modePreference === "system" ? system : modePreference;
  const mode = resolveMode(theme, requested);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme.id);
    root.setAttribute("data-mode", mode);
  }, [theme.id, mode]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeId(id);
    write(THEME_KEY, id);
  }, []);

  const setModePreference = useCallback((m: ModePreference) => {
    setModePref(m);
    write(MODE_KEY, m);
  }, []);

  const value = useMemo(
    () => ({ theme, themeId: theme.id, modePreference, mode, setTheme, setModePreference }),
    [theme, modePreference, mode, setTheme, setModePreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
