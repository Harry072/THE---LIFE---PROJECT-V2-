import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import {
  clearBrowserAuthState,
  clearStoredAppAuth,
  getStoredAppAccessToken,
  getStoredAppUser,
  isAuthSessionError,
  recoverFromDeadAuthSession,
  redirectToLogin,
  setStoredAppAuth,
} from '../lib/appAuth';

type AuthFailureReason =
  | 'invalid_credentials'
  | 'email_unverified'
  | 'oauth_error'
  | 'oauth_not_configured'
  | 'provider_disabled'
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
  completeGoogleLogin: (authData: any) => AuthResult;
  logout: () => Promise<void>;
}

/**
 * Global Purge: Wipes all local traces of previous sessions
 * to prevent data bleed in production.
 */
const purgeAllLocalData = () => {
  clearBrowserAuthState();
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

// After Google OAuth (or any login where struggles weren't saved to metadata),
// recover the struggle selections stored in sessionStorage during onboarding
// and persist them to Supabase auth metadata so they show in Focus Areas.
const tryPersistPendingStruggles = async (userId: string): Promise<string[]> => {
  if (typeof window === 'undefined') return [];
  try {
    // Check both key names: pendingNeed (pre-login) and selectedNeed (post-login)
    const pendingRaw =
      sessionStorage.getItem('lifeProject.pendingNeed') ||
      sessionStorage.getItem(`lifeProject.selectedNeed.${userId}`);
    if (!pendingRaw) return [];

    const pending = JSON.parse(pendingRaw);
    const struggles: string[] = Array.isArray(pending?.struggles)
      ? pending.struggles.filter((s: unknown) => typeof s === 'string' && (s as string).trim())
      : [];
    if (struggles.length === 0) return [];

    await supabase.auth.updateUser({
      data: { struggle_tags: struggles, onboarding_completed: true },
    });

    // Clean up so we don't re-save on every login
    sessionStorage.removeItem('lifeProject.pendingNeed');
    sessionStorage.removeItem(`lifeProject.selectedNeed.${userId}`);

    return struggles;
  } catch {
    return [];
  }
};

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  isVerified: false,
  loading: true,

  fetchUser: async () => {
    try {
      const appAccessToken = getStoredAppAccessToken();
      const appUser = getStoredAppUser();
      if (appAccessToken && appUser?.id) {
        const profile = buildProfileFromMetadata(appUser);
        set({
          user: appUser,
          session: {
            access_token: appAccessToken,
            provider: 'app_google',
            user: appUser,
          },
          profile: { ...(profile || {}), growth_tree: null },
          isVerified: true,
          loading: false,
        });
        return true;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const session = sessionData?.session ?? null;

      if (sessionError) {
        if (isAuthSessionError(sessionError)) {
          await recoverFromDeadAuthSession(supabase);
        }
        set({ ...clearedAuthState, loading: false });
        return false;
      }

      if (!session) {
        set({ ...clearedAuthState, loading: false });
        return false;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const authUser = userData?.user ?? null;

      if (userError) {
        if (isAuthSessionError(userError)) {
          await recoverFromDeadAuthSession(supabase);
        }
        set({ ...clearedAuthState, loading: false });
        return false;
      }

      if (!authUser || authUser.id !== session.user?.id) {
        set({ ...clearedAuthState, loading: false });
        return false;
      }

      if (!isAuthUserAllowed(authUser)) {
        set({ ...clearedAuthState, loading: false });
        return false;
      }

      const profile = buildProfileFromMetadata(authUser);

      // For Google OAuth users (and any user where struggle_tags wasn't saved to
      // metadata at signup), recover struggles stored in sessionStorage during
      // onboarding and persist them so Focus Areas shows the correct tags.
      if (profile && !profile.struggle_tags?.length) {
        const savedStruggles = await tryPersistPendingStruggles(authUser.id);
        if (savedStruggles.length > 0) {
          profile.struggle_tags = savedStruggles;
        }
      }

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
      if (isAuthSessionError(e)) {
        await recoverFromDeadAuthSession(supabase);
      }
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
      // Include struggle_tags in the initial signUp so they're in the JWT
      // immediately — no race condition between updateUser and fetchUser.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: cleanUsername,
            full_name: cleanUsername,
            struggle_tags: struggles,
            onboarding_completed: struggles.length > 0,
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

      // updateUser is a redundant backup to ensure metadata is up-to-date
      // even if signUp's data field was trimmed by Supabase.
      await supabase.auth.updateUser({
        data: { struggle_tags: struggles, onboarding_completed: struggles.length > 0 },
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

  completeGoogleLogin: (authData) => {
    const accessToken = authData?.access_token;
    const appUser = authData?.user;
    if (!accessToken || !appUser?.id) {
      set({ ...clearedAuthState, loading: false });
      return { ok: false, reason: 'oauth_error', message: 'Google sign-in did not return a valid app session.' };
    }

    clearStoredAppAuth();
    setStoredAppAuth(accessToken, appUser);
    const profile = buildProfileFromMetadata(appUser);
    set({
      user: appUser,
      session: {
        access_token: accessToken,
        provider: 'app_google',
        user: appUser,
      },
      profile: { ...(profile || {}), growth_tree: null },
      isVerified: true,
      loading: false,
    });
    return { ok: true };
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Logout Error:", error);
    }
    clearStoredAppAuth();
    purgeAllLocalData();
    set({ ...clearedAuthState, loading: false });
  }
}));

// Initialize Auth State listener
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed successfully');
  }

  if (event === 'SIGNED_OUT') {
    purgeAllLocalData();
    useUserStore.setState({ ...clearedAuthState, loading: false });
    redirectToLogin();
    return;
  }

  if (session) {
    useUserStore.getState().fetchUser();
  } else {
    const appAccessToken = getStoredAppAccessToken();
    const appUser = getStoredAppUser();
    if (appAccessToken && appUser?.id) {
      useUserStore.getState().fetchUser();
      return;
    }
    purgeAllLocalData();
    useUserStore.setState({ ...clearedAuthState, loading: false });
  }
});
