import { useUserStore } from '../store/userStore';

/**
 * Sign the user out of Supabase, clear Zustand state and local caches,
 * then redirect to the landing page.
 */
export async function handleSignOut(): Promise<void> {
  try {
    await useUserStore.getState().logout();

    // Hard redirect to landing / onboarding page
    window.location.href = '/';
  } catch (err: any) {
    console.error('Sign‑out failed:', err);
    // Simple UI fallback – you could replace with a toast
    alert('Unable to sign out. Please try again.');
  }
}
