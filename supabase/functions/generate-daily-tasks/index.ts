import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const TASK_TEMPLATES: Record<string, Record<string, string[]>> = {
  dopamine_loop: {
    awareness: [
      "Notice the moment you reach for your phone out of boredom. Don't stop — just name it.",
      "Count how many times you unlock your phone before noon. Just observe.",
      "Notice what emotion you're feeling right before each scroll session.",
    ],
    action: [
      "Replace your first 10 minutes of phone use tomorrow morning with 10 minutes outside.",
      "Put your phone in another room during one meal today.",
      "Set a 20-minute timer before opening any social app. When it rings, close the app.",
    ],
    meaning: [
      "Write one sentence: what would your future self thank you for doing today?",
      "Name one thing you care about that scrolling has stolen time from.",
      "Describe the person you want to be in 6 months — without mentioning your phone.",
    ],
  },
  directionless: {
    awareness: [
      "Notice one moment today where you felt engaged, even for a minute.",
      "Observe what you do when you don't know what to do."
    ],
    action: [
      "Pick one tiny task you've been putting off. Do it now.",
      "Walk outside for 10 minutes intentionally without a destination."
    ],
    meaning: [
      "What is one thing that holds value to you, regardless of what others think?",
      "Who is someone you admire, and what specific trait do you admire in them?"
    ]
  }
};
 
serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // service_role to bypass RLS
  );
 
  const today = new Date().toISOString().split('T')[0];
  const { data: users } = await supabase
    .from('profiles')
    .select('id, struggle_tags, streak_count')
    .eq('onboarding_completed', true)
    .not('struggle_tags', 'eq', '[]');
 
  for (const user of users || []) {
    const { count } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('assigned_date', today);
 
    if ((count || 0) >= 3) continue;
 
    const primaryTag = user.struggle_tags[0] === "I can't stop scrolling" ? 'dopamine_loop' : 'directionless';
    const templates = TASK_TEMPLATES[primaryTag] || TASK_TEMPLATES['directionless'];
    const difficulty = Math.min(5, 1 + Math.floor(user.streak_count / 7));
 
    const { data: recentTasks } = await supabase
      .from('tasks')
      .select('content')
      .eq('user_id', user.id)
      .gte('assigned_date', new Date(Date.now() - 5*86400000).toISOString().split('T')[0])
      .limit(15);
 
    const recentContent = new Set((recentTasks || []).map(t => t.content));
 
    const domains: Array<'awareness'|'action'|'meaning'> = ['awareness', 'action', 'meaning'];
    const tasks = domains.map(domain => {
      const pool = templates[domain].filter(t => !recentContent.has(t));
      const content = pool[Math.floor(Math.random() * pool.length)] || templates[domain][0];
      return {
        user_id: user.id,
        domain,
        content,
        assigned_date: today,
        struggle_tags: user.struggle_tags,
        difficulty_level: difficulty,
      };
    });
 
    await supabase.from('tasks').insert(tasks);
  }
 
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
