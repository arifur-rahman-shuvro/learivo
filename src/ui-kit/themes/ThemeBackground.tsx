import { useTheme } from "../themes/ThemeProvider.tsx";
import { slots } from "../themes/slots.tsx";

export function ThemeBackground() {
  const { themeId } = useTheme();
  return <>{slots[themeId].Background()}</>;
}
