import { useTheme } from "../themes/ThemeProvider.tsx";
import { slots } from "../themes/slots.tsx";

export function Spinner({ size = 28, inherit = false }: { size?: number; inherit?: boolean }) {
  const { themeId } = useTheme();
  const Loader = slots[themeId].Loader;
  // `inherit` keeps the surrounding text colour (needed on an accent-coloured button).
  return (
    <span className={inherit ? "inline-flex" : "inline-flex text-accent"}>{Loader({ size })}</span>
  );
}
