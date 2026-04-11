import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  const { reflection_id } = await req.json();
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
 
  const { data: reflection } = await supabase
    .from('reflections')
    .select('*')
    .eq('id', reflection_id)
    .single();
 
  if (!reflection) return new Response('Not found', { status: 404 });
 
  const answers = reflection.answers || [];
  const allText = answers.map((a: any) => a.answer || '').join(' ');
  const words = allText.split(/\s+/).filter(Boolean);
 
  // === QUALITY SCORING ===
  const wordCount = words.length;
  const uniqueWords = new Set(words.map((w: string) => w.toLowerCase()));
  const vocabDiversity = wordCount > 0 ? uniqueWords.size / wordCount : 0;
 
  // Quality
  const roboticAnswers = ['done', 'yes', 'no', 'ok', 'good', 'fine', 'idk'];
  const isRobotic = words.length <= 3 && words.every((w: string) => roboticAnswers.includes(w.toLowerCase()));
  const qualityScore = isRobotic ? 0.2 :
    Math.min(1.0, (Math.min(wordCount, 100) / 100) * 0.4 + vocabDiversity * 0.4 + 0.2);
 
  // === PATTERN DETECTION ===
  const patternTags: string[] = [];
  const textLower = allText.toLowerCase();
  if (/avoid|didn't do|skipped|put off|later/i.test(textLower)) patternTags.push('avoidance');
  if (/hope|better|forward|progress|proud/i.test(textLower)) patternTags.push('hope');
  if (/stupid|failure|worthless|can't|never/i.test(textLower)) patternTags.push('self_criticism');
  if (/grateful|thankful|lucky|appreciate/i.test(textLower)) patternTags.push('gratitude');
  if (/alone|nobody|no one|invisible/i.test(textLower)) patternTags.push('isolation');
  if (/phone|scroll|social media|tiktok|instagram/i.test(textLower)) patternTags.push('digital');
 
  // === DISTRESS DETECTION ===
  const IMMEDIATE = ['hurt myself', 'kill myself', 'end it all', 'no point living', 'suicide', 'want to die'];
  const ELEVATED = ['hopeless', 'worthless', "can't go on", 'nobody cares', 'better off without me', 'give up'];
 
  const foundImmediate = IMMEDIATE.filter(kw => textLower.includes(kw));
  const foundElevated = ELEVATED.filter(kw => textLower.includes(kw));
  const distressFlag = foundImmediate.length > 0 || foundElevated.length >= 2;
 
  // Update reflection
  await supabase.from('reflections').update({
    word_count: wordCount,
    vocabulary_diversity: vocabDiversity,
    quality_score: qualityScore,
    pattern_tags: patternTags,
    sentiment_score: patternTags.includes('hope') ? 0.3 : patternTags.includes('self_criticism') ? -0.3 : 0,
    distress_flag: distressFlag,
    distress_keywords: [...foundImmediate, ...foundElevated],
  }).eq('id', reflection_id);
 
  if (distressFlag) {
    await supabase.from('distress_flags').insert({
      user_id: reflection.user_id,
      source: 'reflection',
      trigger_keywords: [...foundImmediate, ...foundElevated],
      severity: foundImmediate.length > 0 ? 'immediate' : 'elevated',
      reflection_id: reflection_id,
    });
    
    await supabase.from('profiles').update({
      distress_resource_shown: true
    }).eq('id', reflection.user_id);
  }
 
  return new Response(JSON.stringify({
    quality_score: qualityScore,
    distress_flag: distressFlag,
    pattern_tags: patternTags,
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
});
