const FIXED_REFLECTION_PROMPT = "What stayed with you today?";

const SECOND_PROMPT_POOL = [
  "Where did you act from your better self today?",
  "What disturbed your mind more than it deserved?",
  "Where did you feel most like yourself — or least like yourself?",
  "What did you give power to today?",
  "Where did you act with patience instead of ego?",
  "What truth did you avoid today?",
  "What did today reveal about your character?",
];

const THIRD_PROMPT_POOL = [
  "What is one thing you want to carry forward or do differently tomorrow?",
  "What small duty will you meet tomorrow?",
  "What can you release before sleep?",
  "What is one honest action for tomorrow?",
  "If this happens again tomorrow, how will you respond?",
  "What will you protect tomorrow: your peace, your focus, or your honesty?",
  "What is one small act of self-command for tomorrow?",
];

const QUESTIONS = [
  FIXED_REFLECTION_PROMPT,
  ...SECOND_PROMPT_POOL,
  ...THIRD_PROMPT_POOL,
];

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

export function getDailyReflectionPrompts(dateString) {
  const seed = dateString || "";
  const secondIndex = hashString(`${seed}:second`) % SECOND_PROMPT_POOL.length;
  const thirdIndex = hashString(`${seed}:third`) % THIRD_PROMPT_POOL.length;

  return [
    FIXED_REFLECTION_PROMPT,
    SECOND_PROMPT_POOL[secondIndex],
    THIRD_PROMPT_POOL[thirdIndex],
  ];
}

export function getDailyQuestions(dateString) {
  return getDailyReflectionPrompts(dateString);
}

export default QUESTIONS;
