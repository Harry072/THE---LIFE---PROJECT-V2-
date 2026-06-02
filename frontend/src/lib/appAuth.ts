export const APP_ACCESS_TOKEN_KEY = 'lifeProject.accessToken';
export const APP_AUTH_USER_KEY = 'lifeProject.authUser';
export const AUTH_LOGIN_PATH = '/';

export const isAuthSessionError = (error: any) => {
  const text = [
    error?.name,
    error?.message,
    error?.status,
    error?.code,
  ].filter(Boolean).join(' ').toLowerCase();

  return (
    text.includes('invalid refresh token') ||
    text.includes('refresh token not found') ||
    text.includes('auth session missing') ||
    text.includes('session not found') ||
    text.includes('jwt expired')
  );
};

export const clearBrowserAuthState = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.clear();
  window.sessionStorage.clear();
};

export const redirectToLogin = () => {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === AUTH_LOGIN_PATH) return;
  window.location.assign(AUTH_LOGIN_PATH);
};

export const recoverFromDeadAuthSession = async (
  supabase: any,
  { redirect = true } = {}
) => {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // The browser storage purge below is the source of truth for recovery.
  }

  clearBrowserAuthState();

  if (redirect) {
    redirectToLogin();
  }
};

export const getStoredAppAccessToken = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(APP_ACCESS_TOKEN_KEY);
};

export const getSupabaseOrAppAccessToken = async (supabase: any) => {
  let sessionData: any = null;
  let sessionError: any = null;

  try {
    const sessionResult = await supabase.auth.getSession();
    sessionData = sessionResult?.data;
    sessionError = sessionResult?.error;
  } catch (error) {
    if (isAuthSessionError(error)) {
      await recoverFromDeadAuthSession(supabase);
      throw new Error('Your session expired. Please sign in again.');
    }
    throw error;
  }

  const supabaseToken = sessionData?.session?.access_token;
  if (supabaseToken) return supabaseToken;

  if (sessionError && isAuthSessionError(sessionError)) {
    await recoverFromDeadAuthSession(supabase);
    throw new Error('Your session expired. Please sign in again.');
  }

  const appToken = getStoredAppAccessToken();
  if (appToken) return appToken;

  if (sessionError) {
    throw sessionError;
  }
  return null;
};

export const setStoredAppAuth = (accessToken: string, user: any) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(APP_ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(APP_AUTH_USER_KEY, JSON.stringify(user || {}));
};

export const getStoredAppUser = () => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(APP_AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const clearStoredAppAuth = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(APP_ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(APP_AUTH_USER_KEY);
};
