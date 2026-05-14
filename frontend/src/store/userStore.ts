import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';

type AuthFailureReason =
  | 'invalid_credentials'
  | 'email_unverified'
  | 'oauth_error'
  | 'oauth_started'
  | 'no_session'
  | 'unknown';

type AuthResult =
  | { ok: true }
  | { ok: false; reason: AuthFailureReason; message?: string };

interface UserState {
  user: any;
  session: any;
  profile: any;
  isVerified: boolean;
  loading: boolean;
  fetchUser: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, password: string, struggles: string[], username: string) => Promise<AuthResult>;
  loginWithGoogle: () => Promise<AuthResult>;
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

const clearedAuthState = {
  user: null,
  session: null,
  profile: null,
  isVerified: false,
};

const isGoogleProvider = (user: any) => {
  const primaryProvider = user?.app_metadata?.provider;
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  return primaryProvider === 'google' || identities.some((identity: any) => identity?.provider === 'google');
};

const isEmailVerified = (user: any) => Boolean(user?.email_confirmed_at || user?.confirmed_at);

const isAuthUserAllowed = (user: any) => Boolean(user && (isGoogleProvider(user) || isEmailVerified(user)));

const getAuthFailureReason = (error: any): AuthFailureReason => {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('email') && (message.includes('confirm') || message.includes('verified'))) {
    return 'email_unverified';
  }
  if (
    message.includes('invalid login credentials')
    || message.includes('invalid credentials')
    || message.includes('invalid email')
    || message.includes('password')
  ) {
    return 'invalid_credentials';
  }
  return 'unknown';
};

// Build a profile-shaped object from Supabase Auth user_metadata.
// No DB query — zero network requests, zero 404s.
// Normalises struggle_tags across all legacy key names written at signup.
const buildProfileFromMetadata = (user: any) => {
  if (!user) return null;
  const meta = user?.user_metadata ?? {};
  const tags: string[] = Array.isArray(meta.struggle_tags)
    ? meta.struggle_tags
    : Array.isArray(meta.struggles)
    ? meta.struggles
    : Array.isArray(meta.onboarding_answers)
    ? meta.onboarding_answers
    : [];
  return {
    id: user.id,
    struggle_tags: tags,
    username: meta.username ?? meta.full_name ?? null,
    onboarding_completed: meta.onboarding_completed ?? false,
  };
};

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  isVerified: false,
  loading: true,

  fetchUser: async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const session = sessionData?.session ?? null;

      if (sessionError || !session) {
        set({ ...clearedAuthState, loading: false });
        return false;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const authUser = userData?.user ?? null;

      if (userError || !authUser || authUser.id !== session.user?.id) {
        set({ ...clearedAuthState, loading: false });
        return false;
      }

      if (!isAuthUserAllowed(authUser)) {
        set({ ...clearedAuthState, loading: false });
        return false;
      }

      const profile = buildProfileFromMetadata(authUser);

      set({
        user: authUser,
        session,
        profile: { ...(profile || {}), growth_tree: null },
        isVerified: true,
        loading: false
      });
      return true;
    } catch (e) {
      console.error("Fetch User Error:", e);
      set({ ...clearedAuthState, loading: false });
      return false;
    }
  },

  login: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        set({ ...clearedAuthState, loading: false });
        return { ok: false, reason: getAuthFailureReason(error), message: error.message };
      }

      if (!data?.session || !data?.user) {
        set({ ...clearedAuthState, loading: false });
        return { ok: false, reason: 'invalid_credentials' };
      }

      if (!isAuthUserAllowed(data.user)) {
        await supabase.auth.signOut({ scope: 'local' });
        set({ ...clearedAuthState, loading: false });
        return { ok: false, reason: 'email_unverified' };
      }

      const isValid = await get().fetchUser();
      return isValid ? { ok: true } : { ok: false, reason: 'no_session' };
    } catch (error) {
      console.error("Login Error:", error);
      set({ ...clearedAuthState, loading: false });
      return { ok: false, reason: getAuthFailureReason(error) };
    }
  },

  register: async (email, password, struggles, username) => {
    try {
      const cleanUsername = username.trim().replace(/\s+/g, ' ');
      const { data, error } = await supabase.auth.signUp({
        email, 
        password,
        options: {
          data: {
            username: cleanUsername,
            full_name: cleanUsername,
          },
        },
      });
      if (error) {
        set({ ...clearedAuthState, loading: false });
        return { ok: false, reason: getAuthFailureReason(error), message: error.message };
      }

      if (!data?.session || !data?.user) {
        set({ ...clearedAuthState, loading: false });
        return { ok: false, reason: 'email_unverified' };
      }

      if (!isAuthUserAllowed(data.user)) {
        await supabase.auth.signOut({ scope: 'local' });
        set({ ...clearedAuthState, loading: false });
        return { ok: false, reason: 'email_unverified' };
      }

      // Persist struggle_tags in Auth user_metadata so every session can
      // read them without a DB query. Non-critical — failure doesn't block signup.
      await supabase.auth.updateUser({
        data: { struggle_tags: struggles, onboarding_completed: true },
      }).catch(() => {
        if (import.meta.env.DEV) {
          console.warn('[userStore] Could not persist struggle_tags to user_metadata');
        }
      });

      const isValid = await get().fetchUser();
      return isValid ? { ok: true } : { ok: false, reason: 'no_session' };
    } catch (error) {
      console.error("Registration Error:", error);
      set({ ...clearedAuthState, loading: false });
      return { ok: false, reason: getAuthFailureReason(error) };
    }
  },

  loginWithGoogle: async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        set({ ...clearedAuthState, loading: false });
        return { ok: false, reason: 'oauth_error', message: error.message };
      }

      return { ok: false, reason: 'oauth_started' };
    } catch (error) {
      console.error("Google Login Error:", error);
      set({ ...clearedAuthState, loading: false });
      return { ok: false, reason: 'oauth_error' };
    }
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Logout Error:", error);
    }
    purgeAllLocalData();
    set({ ...clearedAuthState, loading: false });
  }
}));

// Initialize Auth State listener
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    purgeAllLocalData();
    useUserStore.setState({ ...clearedAuthState, loading: false });
    return;
  }
  if (session) {
    useUserStore.getState().fetchUser();
  } else {
    useUserStore.setState({ ...clearedAuthState, loading: false });
  }
});
