import type { ReactNode, SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { size?: number; title?: string };

function Icon({ size = 22, title, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="var(--lv-icon-stroke, 1.75)"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v9h12v-9" />
  </Icon>
);
export const QuestionsIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8 9h8M8 13h8M8 17h5" />
  </Icon>
);
export const PracticeIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M10.5 9l4 3-4 3z" />
  </Icon>
);
export const ReviewIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12a7 7 0 0 1 12-4.9L19 9" />
    <path d="M19 4v5h-5" />
    <path d="M19 12a7 7 0 0 1-12 4.9L5 15" />
    <path d="M5 20v-5h5" />
  </Icon>
);
export const InsightsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 20V10M12 20V4M19 20v-7" />
  </Icon>
);
export const StudyIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="13" r="7.5" />
    <path d="M12 9.5V13l2.5 1.5M9.5 3h5" />
  </Icon>
);
export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
  </Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Icon>
);
export const SparkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
    <path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16z" />
  </Icon>
);

export const BackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
);
export const ChevronIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);
export const MoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5" cy="12" r="1.2" />
    <circle cx="12" cy="12" r="1.2" />
    <circle cx="19" cy="12" r="1.2" />
  </Icon>
);
export const GamesIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="7" width="18" height="11" rx="5" />
    <path d="M8 10v5M5.5 12.5h5" />
    <circle cx="15.5" cy="11.5" r="0.9" />
    <circle cx="18" cy="14" r="0.9" />
  </Icon>
);
export const CardsIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="6" width="14" height="12" rx="2.5" />
    <path d="M7 3h12a2 2 0 0 1 2 2v10" />
  </Icon>
);
export const MistakeIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </Icon>
);
export const BookmarkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4h10v16l-5-3.5L7 20z" />
  </Icon>
);
export const NoteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M9 12h7M9 16h5" />
  </Icon>
);
export const GlossaryIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 5a2 2 0 0 1 2-2h11v15H7a2 2 0 0 0-2 2z" />
    <path d="M5 20a2 2 0 0 0 2 2h11" />
    <path d="M9 8h5" />
  </Icon>
);
export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5l3 2" />
  </Icon>
);
