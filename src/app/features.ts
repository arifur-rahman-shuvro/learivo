/** Every feature a student can reach, grouped for the "All features" screen. */
export type FeatureIcon =
  | "bank"
  | "add"
  | "import"
  | "prompt"
  | "subjects"
  | "export"
  | "practice"
  | "exam"
  | "due"
  | "mistakes"
  | "bookmarks"
  | "notes"
  | "flashcards"
  | "glossary"
  | "insights"
  | "achievements"
  | "goal"
  | "guide";

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: FeatureIcon;
  route: string;
  /** Opens a named part of the screen, see Intent "open". */
  target?: string;
  /** Opens the add form, or the import dialog. */
  action?: "add" | "import" | "guide" | "backup";
}

export interface FeatureGroup {
  title: string;
  features: Feature[];
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: "Build your question bank",
    features: [
      {
        id: "add",
        title: "Add a question",
        description: "Write one question by hand.",
        icon: "add",
        route: "#/questions",
        action: "add",
      },
      {
        id: "import",
        title: "Import questions",
        description: "Paste JSON from ChatGPT or upload a file.",
        icon: "import",
        route: "#/questions",
        action: "import",
      },
      {
        id: "prompt",
        title: "Make an AI prompt",
        description: "Fill a form, copy a ready prompt for ChatGPT.",
        icon: "prompt",
        route: "#/questions",
        target: "prompt",
      },
      {
        id: "subjects",
        title: "Subjects and topics",
        description: "Add subjects, chapters and topics. Rename or merge them.",
        icon: "subjects",
        route: "#/questions",
        target: "subjects",
      },
      {
        id: "bank",
        title: "All questions",
        description: "Search, filter, tag and clean up your bank.",
        icon: "bank",
        route: "#/questions",
      },
      {
        id: "export",
        title: "Export",
        description: "Download your questions as JSON or CSV.",
        icon: "export",
        route: "#/questions",
        target: "export",
      },
    ],
  },
  {
    title: "Practise",
    features: [
      {
        id: "practice",
        title: "Practice session",
        description: "Pick a subject and answer with instant feedback.",
        icon: "practice",
        route: "#/practice",
      },
      {
        id: "exam",
        title: "Timed exam",
        description: "Build an exam with marks, negative marking and a timer.",
        icon: "exam",
        route: "#/practice",
        target: "exam",
      },
    ],
  },
  {
    title: "Revise",
    features: [
      {
        id: "due",
        title: "Due for revision",
        description: "Cards that are ready to review today.",
        icon: "due",
        route: "#/review",
        target: "due",
      },
      {
        id: "mistakes",
        title: "Mistake notebook",
        description: "Every question you missed, ready to retry.",
        icon: "mistakes",
        route: "#/review",
        target: "mistakes",
      },
      {
        id: "bookmarks",
        title: "Bookmarks",
        description: "Questions you saved to come back to.",
        icon: "bookmarks",
        route: "#/review",
        target: "bookmarks",
      },
      {
        id: "notes",
        title: "Notes",
        description: "Your own notes, searchable.",
        icon: "notes",
        route: "#/review",
        target: "notes",
      },
      {
        id: "flashcards",
        title: "Flashcards",
        description: "Make cards and revise them on a schedule.",
        icon: "flashcards",
        route: "#/review",
        target: "flashcards",
      },
      {
        id: "glossary",
        title: "Glossary",
        description: "Terms that underline themselves in questions.",
        icon: "glossary",
        route: "#/review",
        target: "glossary",
      },
    ],
  },
  {
    title: "Help",
    features: [
      {
        id: "guide",
        title: "User guide",
        description: "First steps that tick themselves, and short answers.",
        icon: "guide",
        route: "#/home",
        action: "guide",
      },
      {
        id: "backup",
        title: "Back up and restore",
        description: "Save everything to one file, or restore from one.",
        icon: "export",
        route: "#/home",
        action: "backup",
      },
    ],
  },
  {
    title: "Track your progress",
    features: [
      {
        id: "insights",
        title: "Insights",
        description: "Accuracy, streak, activity and why you lose marks.",
        icon: "insights",
        route: "#/insights",
      },
      {
        id: "achievements",
        title: "Achievements",
        description: "Badges earned from your own sessions.",
        icon: "achievements",
        route: "#/insights",
        target: "achievements",
      },
      {
        id: "goal",
        title: "Goal and exam date",
        description: "Set a daily goal and count down to your exam.",
        icon: "goal",
        route: "#/home",
      },
    ],
  },
];

export const ALL_FEATURES: Feature[] = FEATURE_GROUPS.flatMap((g) => g.features);
