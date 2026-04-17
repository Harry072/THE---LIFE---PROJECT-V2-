// 30 questions. System picks 3 daily based on date hash.
// Tone: warm, curious, honest, never clinical.

const QUESTIONS = [
  "What felt meaningful today, even if it was small?",
  "What stayed in your mind longer than expected?",
  "What did you avoid today — and what was underneath that?",
  "What is one honest thing you noticed about yourself today?",
  "When did you feel most like yourself today?",
  "What moment would you relive if you could?",
  "Who crossed your mind today, and why?",
  "What drained you today — and could you have said no?",
  "What did you do today that your past self would be proud of?",
  "If today had a title, what would it be?",
  "What are you carrying that you don’t need to carry?",
  "Where did you feel resistance today, and what was it protecting?",
  "What’s one thing you’d do differently if you replayed today?",
  "Did you create anything today, even if only a thought?",
  "What conversation do you wish you’d had?",
  "What made you smile when you weren’t expecting it?",
  "What is your body trying to tell you right now?",
  "What did you learn today without trying to?",
  "Is the path you’re on still the one you’d choose?",
  "What would you tell a friend going through your exact day?",
  "What are you grateful for that you usually overlook?",
  "Where were you fully present today, even briefly?",
  "What habit showed up today — one you’re building or one you’re breaking?",
  "What gave you energy today? What took it?",
  "If you could keep only one feeling from today, which?",
  "What’s one thing you’re slowly getting better at?",
  "What would tomorrow look like if today was your last rehearsal?",
  "What fear whispered to you today?",
  "Where did you show up as the version of yourself you’re becoming?",
  "What’s unfinished — and is it worth finishing?",
];

/**
 * Deterministic daily selection: same 3 questions all day,
 * different 3 tomorrow.
 */
export function getDailyQuestions(dateStr) {
  // Use YYYYMMDD to generate a seed
  const seed = dateStr.split("-").join("").slice(-6);
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  hash = Math.abs(hash);
  
  const pool = [...QUESTIONS];
  const picks = [];
  
  for (let i = 0; i < 3; i++) {
    // Offset each pick with different prime factors for variety
    const idx = (hash + i * 7 + i * i * 3) % pool.length;
    picks.push(pool.splice(idx, 1)[0]);
  }
  
  return picks;
}

export default QUESTIONS;
