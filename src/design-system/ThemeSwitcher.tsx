import { supportedModes, themeList } from "../themes/registry.ts";
import { useTheme } from "../themes/ThemeProvider.tsx";
import type { ModePreference } from "../themes/types.ts";

const modeLabels: Record<ModePreference, string> = { system: "System", light: "Light", dark: "Dark" };

export function ThemeSwitcher() {
  const { theme, themeId, setTheme, modePreference, setModePreference } = useTheme();
  const available = supportedModes(theme);
  const modeOptions: ModePreference[] = available.length > 1 ? ["system", "light", "dark"] : [available[0] ?? "dark"];

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 text-sm font-semibold">Theme</legend>
        <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-2">
          {themeList.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={t.id === themeId}
              onClick={() => setTheme(t.id)}
              className={`lv-btn ${t.id === themeId ? "lv-btn-primary" : "lv-btn-secondary"}`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">{theme.description}</p>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 text-sm font-semibold">Mode</legend>
        <div role="radiogroup" aria-label="Mode" className="flex flex-wrap gap-2">
          {modeOptions.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={available.length > 1 ? m === modePreference : true}
              disabled={available.length === 1}
              onClick={() => setModePreference(m)}
              className={`lv-btn lv-btn-sm ${(available.length > 1 ? m === modePreference : true) ? "lv-btn-primary" : "lv-btn-secondary"}`}
            >
              {modeLabels[m]}
            </button>
          ))}
        </div>
        {available.length === 1 && <p className="mt-2 text-sm text-muted">{theme.name} has one mode only.</p>}
      </fieldset>
    </div>
  );
}
