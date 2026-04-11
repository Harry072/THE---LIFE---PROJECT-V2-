import { createClient } from '@supabase/supabase-js';

// We'd typically use process.env or import.meta.env, but for this demonstration:
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321'; // default local supabase API URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
