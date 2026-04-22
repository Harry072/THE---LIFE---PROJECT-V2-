import { supabase } from './supabase';
import { useUserStore } from '../store/userStore';

/**
 * Sign the user out of Supabase, clear Zustand state and local caches,
 * then redirect to the landing page.
 */
export async function handleSignOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Purge any persisted data (localStorage / sessionStorage)
    localStorage.clear();
    sessionStorage.clear();
    // If you use React Query, clear its cache here (import queryClient if needed)

    // Reset Zustand store – use setState directly
    useUserStore.setState({
      user: null,
      profile: null,
      loading: false,
      error: null,
    });

    // Hard redirect to landing / onboarding page
    window.location.href = '/';
  } catch (err: any) {
    console.error('Sign‑out failed:', err);
    // Simple UI fallback – you could replace with a toast
    alert('Unable to sign out. Please try again.');
  }
}
