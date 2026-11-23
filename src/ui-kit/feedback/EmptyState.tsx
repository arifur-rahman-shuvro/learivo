import { type ReactNode } from "react";
import { useTheme } from "../themes/ThemeProvider.tsx";
import { slots } from "../themes/slots.tsx";

export function EmptyState({
  title,
  description,
  action,
  icon,
  art,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  /** A small icon that says what is missing. Without it the theme's own picture is shown. */
  icon?: ReactNode;
  /** A larger scene drawn with theme colours. Shown instead of the icon. */
  art?: ReactNode;
}) {
  const { themeId } = useTheme();
  const Art = slots[themeId].EmptyArt;
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      {art ? (
        art
      ) : icon ? (
        <span
          aria-hidden="true"
          className="grid size-20 place-items-center rounded-full bg-surface-2 text-accent"
        >
          {icon}
        </span>
      ) : (
        <Art />
      )}
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-muted">{description}</p>
      {action}
    </div>
  );
}
