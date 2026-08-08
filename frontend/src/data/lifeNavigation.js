export const FEATURE_PURPOSE = {
  dashboard: "Your current state and next step.",
  loop: "Your next honest action. Built from your recent signals.",
  reset: "Settle your system before forcing action.",
  music: "Use sound to return to yourself.",
  curator: "Books and ideas matched to your current direction.",
  progress: "Your consistency made visible.",
  reflection: "Name what is happening without turning it into a verdict.",
  weeklyMirror: "A quiet look at what your week has been teaching you.",
  companion: "Talk, plan, reset, or choose the next step.",
};

export const LIFE_PATH_INTRO = {
  storageKey: "lifeproject_life_path_intro_seen",
  eyebrow: "Life Path",
  text: "This app works as a path: Act, Reset, Learn, Grow, Reflect.",
  prompt: "Start with one honest action.",
  actionLabel: "Open The Loop",
  dismissLabel: "Not now",
};

export const LIFE_PATH_STATE_LABELS = {
  completed: "Done",
  current: "Current",
  start: "Start here",
  suggested: "Next",
  open: "Open",
};

export const NAV_GROUPS = [
  {
    label: "Today",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "dashboard", path: "/dashboard" },
      { id: "loop", label: "The Loop", icon: "loop", path: "/loop" },
    ],
  },
  {
    label: "Recover",
    items: [
      { id: "reset", label: "Reset Space", icon: "meditate", path: "/meditation" },
    ],
  },
  {
    label: "Understand",
    items: [
      { id: "reflection", label: "Reflection", icon: "leaf", path: "/reflection" },
      {
        id: "weeklyMirror",
        label: "Weekly Mirror",
        icon: "sparkle",
        path: "/dashboard#weekly-mirror",
        activeHash: "#weekly-mirror",
      },
    ],
  },
  {
    label: "Grow",
    items: [
      { id: "curator", label: "Curator", icon: "books", path: "/curator" },
      { id: "progress", label: "Progress", icon: "progress", path: "/progress" },
    ],
  },
  {
    label: "Support",
    items: [
      { id: "companion", label: "Companion", icon: "sparkle", path: "/companion" },
    ],
  },
];

export const LIFE_PATH_STEPS = [
  {
    id: "act",
    order: 1,
    title: "Start here",
    feature: "The Loop",
    microcopy: "Take one honest action.",
    purpose: FEATURE_PURPOSE.loop,
    icon: "loop",
    path: "/loop",
    actionLabel: "Begin The Loop",
  },
  {
    id: "reset",
    order: 2,
    title: "Then recover",
    feature: "Reset Space",
    microcopy: "Settle your system.",
    purpose: FEATURE_PURPOSE.reset,
    icon: "meditate",
    path: "/meditation",
    actionLabel: "Open Reset Space",
  },
  {
    id: "learn",
    order: 3,
    title: "When ready",
    feature: "Curator / Books",
    microcopy: "Feed your direction.",
    purpose: FEATURE_PURPOSE.curator,
    icon: "books",
    path: "/curator",
    actionLabel: "Open Curator",
  },
  {
    id: "grow",
    order: 4,
    title: "See growth",
    feature: "Progress / Growth Tree",
    microcopy: "See consistency become visible.",
    purpose: FEATURE_PURPOSE.progress,
    icon: "progress",
    path: "/progress",
    actionLabel: "Open Progress",
  },
  {
    id: "reflect",
    order: 5,
    title: "Close the loop",
    feature: "Reflection / Weekly Mirror",
    microcopy: "Name what the day taught you.",
    purpose: FEATURE_PURPOSE.reflection,
    icon: "leaf",
    path: "/reflection",
    actionLabel: "Open Reflection",
  },
];

export const GUIDE_ME_OPTIONS = [
  {
    id: "action",
    label: "I need one useful action",
    icon: "loop",
    path: "/loop",
  },
  {
    id: "heavy",
    label: "I feel heavy or restless",
    icon: "meditate",
    path: "/meditation",
  },
  {
    id: "direction",
    label: "I want direction",
    icon: "books",
    path: "/curator",
  },
  {
    id: "understand",
    label: "I want to understand myself",
    icon: "leaf",
    path: "/reflection",
  },
  {
    id: "growth",
    label: "I want to see my growth",
    icon: "progress",
    path: "/progress",
  },
  {
    id: "talk",
    label: "I want to talk",
    icon: "sparkle",
    path: "/companion",
  },
];

export const MOBILE_PRIMARY_NAV = [
  { id: "dashboard", label: "Home", icon: "dashboard", path: "/dashboard" },
  { id: "loop", label: "Loop", icon: "loop", path: "/loop" },
  { id: "reset", label: "Reset", icon: "meditate", path: "/meditation" },
  { id: "reflection", label: "Reflect", icon: "leaf", path: "/reflection" },
  { id: "companion", label: "Talk", icon: "sparkle", path: "/companion" },
];

// ── Icon-only navigation (dashboard redesign) ──────────────────────────────
// Four primary destinations + Discover. Icons guide the curious; labels are
// aria-only. Everything else lives in the Discover drawer.

export const PRIMARY_NAV = [
  { id: "dashboard", label: "Home", icon: "house", path: "/dashboard" },
  { id: "loop", label: "Loop", icon: "loop", path: "/loop" },
  { id: "companion", label: "Companion", icon: "chat", path: "/companion" },
  { id: "reflection", label: "Reflect", icon: "pen", path: "/reflection" },
];

// ── Dashboard Finalization Part C — text-labeled sidebar ──────────────────
// All seven destinations directly reachable from the rail; no Discover
// drawer trigger here (MobileBottomNav still uses DiscoverDrawer/
// DISCOVER_FEATURES independently — those stay untouched).
export const SIDEBAR_NAV = [
  { id: "dashboard", label: "Home", icon: "house", path: "/dashboard" },
  { id: "loop", label: "Loop", icon: "loop", path: "/loop" },
  { id: "reflection", label: "Reflection", icon: "pen", path: "/reflection" },
  { id: "companion", label: "Companion", icon: "chat", path: "/companion" },
  { id: "reset", label: "Reset Space", icon: "meditate", path: "/meditation" },
  { id: "tree", label: "Growth Tree", icon: "sprout", path: "/progress" },
  { id: "curator", label: "Curator", icon: "books", path: "/curator" },
];

export const DISCOVER_FEATURES = [
  {
    id: "reset",
    label: "Reset Space",
    icon: "meditate",
    path: "/meditation",
    purpose: FEATURE_PURPOSE.reset,
  },
  {
    id: "curator",
    label: "Curator",
    icon: "books",
    path: "/curator",
    purpose: FEATURE_PURPOSE.curator,
  },
  {
    id: "progress",
    label: "Progress / Tree",
    icon: "sprout",
    path: "/progress",
    purpose: FEATURE_PURPOSE.progress,
  },
  {
    id: "weeklyMirror",
    label: "Weekly Mirror",
    icon: "sparkle",
    path: "/mirror",
    purpose: FEATURE_PURPOSE.weeklyMirror,
  },
  {
    id: "settings",
    label: "Settings",
    icon: "settings",
    path: "/profile",
    purpose: "Your account and preferences.",
  },
];
