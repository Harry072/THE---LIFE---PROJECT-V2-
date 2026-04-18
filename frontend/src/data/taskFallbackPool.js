export const FALLBACK_POOL = [
  {
    title: "Morning Journaling",
    subtitle: "5 minutes reflection",
    category: "awareness",
    detail_title: "Start your day by writing what's true.",
    detail_description: "Before the world pours in, capture what your mind already holds. Morning pages aren't about quality — they're about honesty.",
    why: "Journaling first thing activates the prefrontal cortex and externalizes circular thoughts. Research from the University of Rochester shows that expressive writing reduces intrusive thinking by up to 40%.",
    inline_quote: null,
    duration_minutes: 5,
    preferred_time: "6:00 AM",
    intensity: "light",
  },
  {
    title: "Workout & Movement",
    subtitle: "30 minutes",
    category: "health",
    detail_title: "Move your body to build energy and resilience.",
    detail_description: "Reduce stress and unlock a stronger version of yourself. Movement is the fastest way to shift your state.",
    why: "Exercise increases BDNF (brain-derived neurotrophic factor), which literally grows new neurons. A 30-minute session produces endorphins equivalent to a mild antidepressant — without the side effects.",
    inline_quote: null,
    duration_minutes: 30,
    preferred_time: "7:30 AM",
    intensity: "medium",
  },
  {
    title: "Read 20 Pages",
    subtitle: "5 minutes reflection",
    category: "meaning",
    detail_title: "Feed your mind with inspiring books.",
    detail_description: "Build a habit of daily reading to expand your knowledge and perspective.",
    why: "Reading for 20 minutes a day exposes you to roughly 1.8 million words per year. That's about 7-8 books. Each book is a compressed lifetime of someone else's thinking, available to you for the price of attention.",
    inline_quote: "Most people let their minds atrophy, you won't.",
    duration_minutes: 20,
    preferred_time: "8:30 PM",
    intensity: "light",
  },
  {
    title: "Night Reflection",
    subtitle: "Gratitude & Growth",
    category: "reflection",
    detail_title: "Close the day with honest reflection.",
    detail_description: "Take a few minutes to notice what happened today — not to judge it, but to understand it.",
    why: "Reflective practice activates the default mode network, the brain's meaning-making system. People who reflect daily show 23% better emotional regulation and higher life satisfaction scores.",
    inline_quote: null,
    duration_minutes: 10,
    preferred_time: "10:00 PM",
    intensity: "light",
  },
  {
    title: "Take a walk without your phone",
    subtitle: "Let your mind wander unguided",
    category: "awareness",
    detail_title: "Give your brain space to think freely.",
    detail_description: "Without input, your mind surfaces what it's actually processing. This is where clarity comes from.",
    why: "A Stanford study found that walking increases creative thinking by 60%. But the key ingredient isn't the walking — it's the absence of input. Your phone-free attention is the most valuable thing you own.",
    inline_quote: "The best ideas arrive when you stop searching for them.",
    duration_minutes: 15,
    preferred_time: "afternoon",
    intensity: "light",
  },
];

export function getFallbackTasks(context) {
  const recentTitles = context.recentTitles || [];
  const pool = [...FALLBACK_POOL].filter(t => !recentTitles.includes(t.title));
  
  // Pick 4 tasks (3 core + 1 optional - simplified for sample)
  const picks = pool.slice(0, 4).map((t, i) => ({
    ...t,
    id: `fb-${i}`,
    is_optional: i === 3,
    sort_order: i + 1,
    ai_generated: false
  }));

  return picks;
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

