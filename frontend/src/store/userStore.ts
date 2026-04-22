import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';

interface UserState {
  user: any;
  profile: any;
  loading: boolean;
  fetchUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, struggles: string[]) => Promise<boolean>;
  logout: () => Promise<void>;
}

/**
 * Global Purge: Wipes all local traces of previous sessions
 * to prevent data bleed in production.
 */
const purgeAllLocalData = () => {
  localStorage.clear();
  sessionStorage.clear();
  queryClient.clear();
};

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,

  fetchUser: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
      if (!session) {
        set({ user: null, profile: null, loading: false });
        return;
      }
      
      // TABLES MISSING: Disabling profiles and growth_trees fetches to unblock UI
      const profile = null;
      const growthTree = null;
      /*
      let profile = null;
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        profile = profileData;
      } catch (e) {
        console.warn("Profiles table missing or inaccessible.");
      }
        
      let growthTree = null;
      try {
        const { data: growthTreeData } = await supabase
          .from('growth_trees')
          .select('*')
          .eq('user_id', session.user.id)
          .single();
        growthTree = growthTreeData;
      } catch (e) {
        console.warn("Growth_trees table missing or inaccessible.");
      }
      */

      set({ 
        user: session.user, 
        profile: { ...profile, growth_tree: growthTree }, 
        loading: false 
      });
    } catch (e) {
      console.error("Fetch User Error:", e);
      set({ loading: false });
    }
  },

  login: async (email, password) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await get().fetchUser();
      return true;
    } catch (error) {
      console.error("Login Error:", error);
      return false;
    }
  },

  register: async (email, password, struggles) => {
    try {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password 
      });
      if (error) throw error;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
         try {
           await supabase.from('profiles').update({
             struggle_tags: struggles,
             onboarding_completed: true
           }).eq('id', session.user.id);
         } catch (e) {
           console.warn("Could not update profiles table (table may be missing):", e);
         }
         
         // In production, we call the backend API rather than a localized mock
          try {
            await fetch('http://127.0.0.1:8000/api/generate-loop-tasks', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({ context: { struggle_profile: struggles } })
            });
          } catch (e) {
            console.error("Backend API call failed:", e);
          }
      }

      await get().fetchUser();
      return true;
    } catch (error) {
      console.error("Registration Error:", error);
      return false;
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    purgeAllLocalData();
    set({ user: null, profile: null });
  }
}));

// Initialize Auth State listener
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    purgeAllLocalData();
  }
  useUserStore.getState().fetchUser();
});

