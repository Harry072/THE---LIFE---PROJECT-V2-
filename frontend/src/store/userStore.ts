import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface UserState {
  user: any;
  profile: any;
  loading: boolean;
  demoMode: boolean;
  fetchUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, struggles: string[]) => Promise<boolean>;
  logout: () => Promise<void>;
  toggleDemoMode: (val: boolean) => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  demoMode: false,

  fetchUser: async () => {
    try {
      if (get().demoMode) {
        set({ 
          user: { id: 'demo-user', email: 'demo@lifeproject.com' },
          profile: { 
            display_name: 'Explorer', 
            struggle_tags: ['I feel lost'], 
            onboarding_completed: true,
            streak_count: 5,
            growth_tree: { branch_level: 2, leaf_density: 3 }
          },
          loading: false 
        });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      if (!session) {
        set({ user: null, profile: null, loading: false });
        return;
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      const { data: growthTree } = await supabase
        .from('growth_trees')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      set({ 
        user: session.user, 
        profile: { ...profile, growth_tree: growthTree }, 
        loading: false 
      });
    } catch (e) {
      console.error(e);
      set({ loading: false });
    }
  },

  login: async (email, password) => {
    if (get().demoMode) {
      await get().fetchUser();
      return true;
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await get().fetchUser();
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  },

  register: async (email, password, struggles) => {
    if (get().demoMode) {
       set({ 
        user: { id: 'demo-user', email },
        profile: { display_name: 'Explorer', struggle_tags: struggles, onboarding_completed: true, streak_count: 0, growth_tree: { branch_level: 1, leaf_density: 1 } }
       });
       return true;
    }
    try {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password 
      });
      if (error) throw error;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
         await supabase.from('profiles').update({
           struggle_tags: struggles,
           onboarding_completed: true
         }).eq('id', session.user.id);
         
         await supabase.functions.invoke('generate-daily-tasks', {
           body: { user_id: session.user.id }
         });
      }

      await get().fetchUser();
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  },

  logout: async () => {
    if (!get().demoMode) await supabase.auth.signOut();
    set({ user: null, profile: null, demoMode: false });
  },

  toggleDemoMode: (val) => set({ demoMode: val })
}));

// Initialize Auth State listener
supabase.auth.onAuthStateChange((event, session) => {
  useUserStore.getState().fetchUser();
});
