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
      { id: "music", label: "Music", icon: "music", path: "/music" },
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
    title: "Act",
    feature: "The Loop",
    purpose: "Take one honest action.",
    icon: "loop",
    path: "/loop",
    stateLabel: "Start here",
  },
  {
    id: "reset",
    order: 2,
    title: "Reset",
    feature: "Reset Space / Music",
    purpose: "Settle your system before forcing more.",
    icon: "meditate",
    path: "/meditation",
    stateLabel: "Then recover",
  },
  {
    id: "learn",
    order: 3,
    title: "Learn",
    feature: "Curator / Books",
    purpose: "Feed your direction with the right ideas.",
    icon: "books",
    path: "/curator",
    stateLabel: "When ready",
  },
  {
    id: "grow",
    order: 4,
    title: "Grow",
    feature: "Growth Tree",
    purpose: "See your consistency become visible.",
    icon: "progress",
    path: "/progress",
    stateLabel: "Visible over time",
  },
  {
    id: "reflect",
    order: 5,
    title: "Reflect",
    feature: "Reflection Journal",
    purpose: "Name what the day taught you.",
    icon: "leaf",
    path: "/reflection",
    stateLabel: "Close the loop",
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
    id: "music",
    label: "I want calm music",
    icon: "music",
    path: "/music",
  },
  {
    id: "understand",
    label: "I want to understand myself",
    icon: "leaf",
    path: "/reflection",
  },
  {
    id: "direction",
    label: "I feel lost about direction",
    icon: "books",
    path: "/curator",
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
