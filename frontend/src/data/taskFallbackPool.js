// ─── Complete Task Pool — Mapped to ALL 9 Onboarding Struggles ────────────────
// Each struggle from "What brought you here?" has dedicated tasks that address
// the specific psychological pattern behind it.

export const FALLBACK_POOL = [
  // ── Awareness Tasks ──
  {
    title: "Morning Journaling",
    subtitle: "5 minutes reflection",
    category: "awareness",
    detail_title: "Start your day by writing what's true.",
    detail_description: "Before the world pours in, capture what your mind already holds. Morning pages aren't about quality — they're about honesty.",
    why: "Journaling first thing activates the prefrontal cortex and externalizes circular thoughts. Research from the University of Rochester shows that expressive writing reduces intrusive thinking by up to 40%.",
    inline_quote: null,
    duration_minutes: 5,
    preferred_time: "morning",
    intensity: "light",
    cover_image: "quiet_room",
    _tags: ["I feel lost", "I don't know who I am", "I feel empty inside"],
  },
  {
    title: "Take a walk without your phone",
    subtitle: "Let your mind wander unguided",
    category: "awareness",
    detail_title: "Give your brain space to think freely.",
    detail_description: "Without input, your mind surfaces what it's actually processing. This is where clarity comes from.",
    why: "A Stanford study found that walking increases creative thinking by 60%. The key ingredient isn't the walking — it's the absence of input.",
    inline_quote: "The best ideas arrive when you stop searching for them.",
    duration_minutes: 15,
    preferred_time: "afternoon",
    intensity: "light",
    cover_image: "dawn_path",
    _tags: ["I overthink everything", "I can't stop scrolling"],
  },

  // ── Focus / Action Tasks ──
  {
    title: "Workout & Movement",
    subtitle: "30 minutes of physical activation",
    category: "body_activation",
    detail_title: "Move your body to build energy and resilience.",
    detail_description: "Reduce stress and unlock a stronger version of yourself. Movement is the fastest way to shift your state.",
    why: "Exercise increases BDNF (brain-derived neurotrophic factor), which literally grows new neurons. A 30-minute session produces endorphins equivalent to a mild antidepressant.",
    inline_quote: null,
    duration_minutes: 30,
    preferred_time: "morning",
    intensity: "medium",
    cover_image: "mountain_air",
    _tags: ["I have no motivation", "I feel empty inside", "I can't sleep"],
  },
  {
    title: "Micro Action",
    subtitle: "Do one tiny thing right now",
    category: "focus",
    detail_title: "The Starting Line",
    detail_description: "Pick the smallest possible task you've avoided. Spend exactly 5 minutes on it. Not more. Just 5.",
    why: "Motivation follows action, it doesn't precede it. Breaking the seal of inaction is the hardest part — and 5 minutes is too small to resist.",
    inline_quote: "You don't need motivation. You need momentum.",
    duration_minutes: 5,
    preferred_time: "afternoon",
    intensity: "light",
    cover_image: "sunrise_focus",
    _tags: ["I have no motivation", "I keep starting and quitting"],
  },
  {
    title: "Read 20 Pages",
    subtitle: "Feed your mind intentionally",
    category: "learning",
    detail_title: "Feed your mind with inspiring books.",
    detail_description: "Build a habit of daily reading to expand your knowledge and perspective.",
    why: "Reading for 20 minutes a day exposes you to roughly 1.8 million words per year. Each book is a compressed lifetime of someone else's thinking.",
    inline_quote: "Most people let their minds atrophy, you won't.",
    duration_minutes: 20,
    preferred_time: "evening",
    intensity: "light",
    cover_image: "quiet_room",
    _tags: ["I feel lost", "I don't know who I am"],
  },

  // ── Emotional Reset Tasks ──
  {
    title: "Night Reflection",
    subtitle: "Gratitude & Growth",
    category: "emotional_reset",
    detail_title: "Close the day with honest reflection.",
    detail_description: "Take a few minutes to notice what happened today — not to judge it, but to understand it.",
    why: "Reflective practice activates the default mode network, the brain's meaning-making system. People who reflect daily show 23% better emotional regulation.",
    inline_quote: null,
    duration_minutes: 10,
    preferred_time: "evening",
    intensity: "light",
    cover_image: "night_lantern",
    _tags: ["I feel empty inside", "I feel completely alone", "I overthink everything"],
  },

  // ── Scrolling / Distraction Tasks ──
  {
    title: "Digital Space",
    subtitle: "Break the dopamine loop",
    category: "distraction",
    detail_title: "Analog Hour",
    detail_description: "Put your phone in another room for exactly 1 hour. Notice the urge to check it and let it pass like a wave.",
    why: "Physical distance breaks the dopamine-seeking habit loop. Your brain needs to learn that boredom is safe, not dangerous.",
    inline_quote: "The urge to scroll is not hunger — it's a reflex.",
    duration_minutes: 60,
    preferred_time: "afternoon",
    intensity: "medium",
    cover_image: "forest_light",
    _tags: ["I can't stop scrolling"],
  },

  // ── Overthinking Tasks ──
  {
    title: "Brain Dump",
    subtitle: "Empty your mind onto paper",
    category: "overthinking",
    detail_title: "Paper Mind",
    detail_description: "Write down everything circling in your head for 5 minutes straight. Do not stop to edit or think — just write.",
    why: "Externalizing thoughts frees up cognitive load and reduces the intensity of rumination by up to 43%.",
    inline_quote: "Your mind is for having ideas, not holding them.",
    duration_minutes: 10,
    preferred_time: "evening",
    intensity: "light",
    cover_image: "still_water",
    _tags: ["I overthink everything", "I can't sleep"],
  },

  // ── Sleep Tasks ──
  {
    title: "Screen-Free Wind Down",
    subtitle: "Prepare your brain for rest",
    category: "healing",
    detail_title: "Dark Mode",
    detail_description: "No screens 30 minutes before bed. Read a physical book, stretch, or just sit with low light.",
    why: "Blue light suppresses melatonin production. A physical boundary between screens and sleep increases sleep quality by 27%.",
    inline_quote: "Sleep is not a reward for productivity. It's the foundation of it.",
    duration_minutes: 30,
    preferred_time: "night",
    intensity: "light",
    cover_image: "night_lantern",
    _tags: ["I can't sleep"],
  },

  // ── Lost / Empty Tasks ──
  {
    title: "One Curious Thing",
    subtitle: "Follow one thread of interest",
    category: "learning",
    detail_title: "Curiosity Spark",
    detail_description: "Think of one thing you're genuinely curious about — not useful, just interesting. Spend 10 minutes exploring it without purpose.",
    why: "When you feel lost, curiosity is the compass. It reconnects you with internal motivation without pressure to perform.",
    inline_quote: "You don't need a purpose right now. You need a direction.",
    duration_minutes: 10,
    preferred_time: "afternoon",
    intensity: "light",
    cover_image: "dawn_path",
    _tags: ["I feel lost", "I feel empty inside", "I don't know who I am"],
  },

  // ── Loneliness Tasks ──
  {
    title: "Honest Message",
    subtitle: "Reach out to one person",
    category: "emotional_reset",
    detail_title: "Connection Thread",
    detail_description: "Send one honest message to someone — not 'hey', but something real. Share a thought, a memory, or just say you were thinking of them.",
    why: "Loneliness shrinks when you take a micro-action of vulnerability. One genuine message rewires isolation patterns faster than passive scrolling.",
    inline_quote: "Connection is built one honest sentence at a time.",
    duration_minutes: 5,
    preferred_time: "afternoon",
    intensity: "light",
    cover_image: "rain_leaves",
    _tags: ["I feel completely alone"],
  },

  // ── Quitting / Discipline Tasks ──
  {
    title: "2-Minute Anchor",
    subtitle: "Build the smallest possible habit",
    category: "focus",
    detail_title: "Anchor Point",
    detail_description: "Choose one micro-habit (2 minutes or less) and attach it to something you already do daily. Do it today. Tomorrow, do it again.",
    why: "Consistency isn't built through willpower — it's built through attachment to existing routines. The goal isn't the action; it's the identity.",
    inline_quote: "You don't rise to the level of your goals. You fall to the level of your systems.",
    duration_minutes: 2,
    preferred_time: "morning",
    intensity: "light",
    cover_image: "sunrise_focus",
    _tags: ["I keep starting and quitting", "I have no motivation"],
  },

  // ── Identity Tasks ──
  {
    title: "Values Check-in",
    subtitle: "What actually matters to you?",
    category: "awareness",
    detail_title: "Inner Map",
    detail_description: "Write down 3 things you care about that no one told you to care about. Then notice which one you've given the least energy to.",
    why: "Identity confusion often comes from living other people's values. Naming your own is the first act of self-recovery.",
    inline_quote: "You already know who you are. You just haven't been listening.",
    duration_minutes: 10,
    preferred_time: "morning",
    intensity: "light",
    cover_image: "mountain_air",
    _tags: ["I don't know who I am", "I feel lost"],
  },

  // ── Physical Reset ──
  {
    title: "Physical Transition",
    subtitle: "Step away and breathe",
    category: "body_activation",
    detail_title: "Forest Light",
    detail_description: "Step outside and walk slowly for 12 minutes without consuming anything — no music, no podcasts, no phone.",
    why: "Movement physically breaks the cycle of overthinking. Your body leads where your mind will follow.",
    inline_quote: null,
    duration_minutes: 12,
    preferred_time: "afternoon",
    intensity: "medium",
    cover_image: "forest_light",
    _tags: ["I overthink everything", "I have no motivation", "I can't sleep"],
  },
];

// ─── Intelligent Struggle-Aware Fallback Generator ──────────────────────────
// Maps the exact user selections from onboarding to the right tasks.
// This replaces a static pool with a pseudo-AI matching engine.

export function getFallbackTasks(context) {
  const recentTitles = context.recentTitles || [];
  const struggles = context.struggle_profile || [];

  let scored = FALLBACK_POOL.map(task => {
    // Calculate relevance score based on how many user struggles this task addresses
    const matchCount = (task._tags || []).filter(tag => struggles.includes(tag)).length;
    return { ...task, _score: matchCount };
  });

  // Filter out recently completed tasks
  scored = scored.filter(t => !recentTitles.includes(t.title));

  // Sort by relevance score (highest first), then shuffle ties for variety
  scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return Math.random() - 0.5;
  });

  // Ensure category diversity — pick from different categories
  const picked = [];
  const usedCategories = new Set();

  for (const task of scored) {
    if (picked.length >= 4) break;
    // Allow same category only if we've run out of unique ones
    if (!usedCategories.has(task.category) || picked.length >= 3) {
      picked.push(task);
      usedCategories.add(task.category);
    }
  }

  // If we still don't have 4, fill from remaining
  if (picked.length < 4) {
    for (const task of scored) {
      if (picked.length >= 4) break;
      if (!picked.some(p => p.title === task.title)) {
        picked.push(task);
      }
    }
  }

  return picked.slice(0, 4).map((t, i) => {
    // Clean internal tags before returning
    const { _tags, _score, ...clean } = t;
    return {
      ...clean,
      id: `fb-${i}-${Date.now()}`,
      is_optional: i === 3,
      sort_order: i + 1,
      ai_generated: false,
    };
  });
}

export function getFallbackSingle(category, intensity, context) {
  const matches = FALLBACK_POOL.filter(t =>
    t.category === category
    && t.intensity === intensity
    && !context.recentTitles?.includes(t.title));
  if (matches.length === 0) {
    return FALLBACK_POOL.find(t => t.intensity === "light") || FALLBACK_POOL[0];
  }
  return matches[Math.floor(Math.random() * matches.length)];
}
