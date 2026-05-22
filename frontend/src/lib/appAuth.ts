export const APP_ACCESS_TOKEN_KEY = 'lifeProject.accessToken';
export const APP_AUTH_USER_KEY = 'lifeProject.authUser';

export const getStoredAppAccessToken = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(APP_ACCESS_TOKEN_KEY);
};

export const getSupabaseOrAppAccessToken = async (supabase: any) => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const supabaseToken = sessionData?.session?.access_token;
  if (supabaseToken) return supabaseToken;

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
