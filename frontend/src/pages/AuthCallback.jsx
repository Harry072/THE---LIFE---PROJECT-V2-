import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/userStore';

function AuthCallback() {
  const navigate = useNavigate();
  const fetchUser = useUserStore((state) => state.fetchUser);
  const [message, setMessage] = useState('Completing Google sign-in...');

  useEffect(() => {
    let cancelled = false;

    const finishGoogleSignIn = async () => {
      const url = new URL(window.location.href);
      const authError = url.searchParams.get('error_description') || url.searchParams.get('error');
      const code = url.searchParams.get('code');

      if (authError) {
        if (!cancelled) {
          setMessage('Google sign-in was cancelled or failed. Returning to login...');
          setTimeout(() => navigate('/', { replace: true }), 900);
        }
        return;
      }

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const isAuthenticated = await fetchUser();
        if (!cancelled) {
          navigate(isAuthenticated ? '/dashboard' : '/', { replace: true });
        }
      } catch (error) {
        console.error('Google auth callback failed:', error);
        if (!cancelled) {
          setMessage('Google sign-in could not be completed. Returning to login...');
          setTimeout(() => navigate('/', { replace: true }), 900);
        }
      }
    };

    finishGoogleSignIn();

    return () => {
      cancelled = true;
    };
  }, [fetchUser, navigate]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      background: 'radial-gradient(circle at center, #064e3b, #022c22 80%)',
      fontFamily: 'system-ui, sans-serif',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <div>
        <h1 style={{ marginBottom: '0.75rem' }}>The Life Project</h1>
        <p style={{ opacity: 0.75 }}>{message}</p>
      </div>
    </div>
  );
}

export default AuthCallback;
