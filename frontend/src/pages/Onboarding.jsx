import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useUserStore } from '../store/userStore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PremiumButton, GlassCard, InputGroup, PageTransition } from '../components/common/ThemeUI';
import { Mail, Lock, Shield, ArrowRight, Compass, Info, User } from 'lucide-react';
import heroImage from '../assets/hero-tree.png';
import { API_BASE_URL } from '../lib/apiConfig';

const STRUGGLES = [
  "I can't stop scrolling",
  "I feel lost",
  "I overthink everything",
  "I have no motivation",
  "I can't sleep",
  "I feel empty inside",
  "I keep starting and quitting",
  "I don't know who I am",
  "I feel completely alone"
];

const MotionDiv = motion.div;
const MotionP = motion.p;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_AUTH_ORIGIN = import.meta.env.VITE_GOOGLE_AUTH_ORIGIN ?? 'http://localhost:5173';
const GOOGLE_AUTH_DRAFT_HASH_PREFIX = 'googleAuthDraft=';

let googleIdentityInitialized = false;
let googleScriptPromise = null;

const loadGoogleIdentityScript = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google sign-in is only available in the browser.'));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Google Identity Services failed to load.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Google Identity Services failed to load.'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
};

const getGoogleAuthDraft = () => {
  if (typeof window === 'undefined') return null;

  const hashValue = window.location.hash.replace(/^#/, '');
  if (hashValue.startsWith(GOOGLE_AUTH_DRAFT_HASH_PREFIX)) {
    try {
      const draft = JSON.parse(decodeURIComponent(hashValue.slice(GOOGLE_AUTH_DRAFT_HASH_PREFIX.length)));
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      return draft;
    } catch {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      return null;
    }
  }

  try {
    return JSON.parse(sessionStorage.getItem('lifeProject.googleAuthDraft') || 'null');
  } catch {
    return null;
  }
};

const normalizeOrigin = (origin) => origin.replace(/\/+$/, '');

const ensureGoogleAuthOrigin = (draft = {}) => {
  if (typeof window === 'undefined') return true;

  const expectedOrigin = normalizeOrigin(GOOGLE_AUTH_ORIGIN);
  if (!expectedOrigin || window.location.origin === expectedOrigin) {
    return true;
  }

  const expectedHost = new URL(expectedOrigin).hostname;
  const localHosts = ['localhost', '127.0.0.1', '[::1]', '::1'];
  const isLocalhostAlias = localHosts.includes(window.location.hostname) && localHosts.includes(expectedHost);
  if (!isLocalhostAlias) {
    return true;
  }

  const encodedDraft = encodeURIComponent(JSON.stringify(draft));
  window.location.replace(
    `${expectedOrigin}${window.location.pathname}${window.location.search}#${GOOGLE_AUTH_DRAFT_HASH_PREFIX}${encodedDraft}`
  );
  return false;
};

function Onboarding() {
  const authDraft = getGoogleAuthDraft();
  const [selectedStruggles, setSelectedStruggles] = useState(authDraft?.selectedStruggles || []);
  const [step, setStep] = useState(authDraft?.step ?? 0); // 0: Enter, 1: Struggles, 2: Insight, 3: Auth
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(authDraft?.isLogin || false);
  const [error, setError] = useState(null);
  
  const { register, login, completeGoogleLogin } = useUserStore();
  const navigate = useNavigate();

  const toggleStruggle = (struggle) => {
    setSelectedStruggles(prev => 
      prev.includes(struggle) 
        ? prev.filter(s => s !== struggle)
        : [...prev, struggle]
    );
  };

  const handleContinueToStep2 = () => {
    if (selectedStruggles.length > 0) {
      const pendingNeed = {
        label: selectedStruggles[0],
        struggles: selectedStruggles,
        createdAt: new Date().toISOString()
      };
      sessionStorage.setItem('lifeProject.pendingNeed', JSON.stringify(pendingNeed));
    }
    setStep(2);
  };

  const getInsightMessage = () => {
    if (selectedStruggles.includes("I can't stop scrolling") && selectedStruggles.includes("I feel empty inside")) {
      return "What you're describing sounds like a dopamine cycle — your brain is seeking stimulation to avoid sitting with discomfort. That's not a character flaw. It's a pattern. And you're not the only one here who recognizes it.";
    }
    if (selectedStruggles.includes("I overthink everything")) {
      return "Your mind is working overtime trying to solve a problem that isn't logical—it's emotional. That exhaustion is real, but it's a loop, not a life sentence. We can break it down.";
    }
    return "You're carrying a heavy cognitive load right now. Feeling adrift isn't a sign of failure; it's a sign that your current map doesn't match the territory. Let's build a new one slowly.";
  };

  const validateUsername = () => {
    const cleanUsername = username.trim().replace(/\s+/g, ' ');
    if (!cleanUsername) return "Username is required.";
    if (cleanUsername.length < 2) return "Username must be at least 2 characters.";
    if (cleanUsername.length > 30) return "Username must be 30 characters or less.";
    if (!/^[A-Za-z0-9_ ]+$/.test(cleanUsername)) {
      return "Username can use letters, numbers, spaces, and underscore only.";
    }
    return null;
  };

  const authMessageFor = (result, modeIsLogin) => {
    if (result?.reason === 'oauth_not_configured') {
      return "Google sign-in is missing VITE_GOOGLE_CLIENT_ID. Add it to frontend/.env and restart the app.";
    }
    if (result?.reason === 'provider_disabled') {
      return "Google sign-in is not enabled in Supabase. Enable Google under Authentication > Providers, add the Google Client ID and Secret, then try again.";
    }
    if (result?.reason === 'oauth_error' && result?.message) {
      return result.message;
    }
    if (result?.reason === 'email_unverified') {
      return "Check your email to verify your account before entering.";
    }
    if (modeIsLogin || result?.reason === 'invalid_credentials') {
      return "Invalid email or password.";
    }
    return "Authentication failed. Please try again.";
  };

  const handleGoogleResponse = async (response) => {
    const credential = response?.credential;
    if (!credential) {
      setError("Google did not return an ID token. Please try again.");
      return;
    }

    console.log('[Google Auth] ID token received from Google Identity Services.');

    try {
      setError(null);
      const backendResponse = await axios.post(`${API_BASE_URL}/api/v1/auth/google`, {
        token: credential,
      });
      const result = completeGoogleLogin(backendResponse.data);

      if (result.ok) {
        navigate('/dashboard');
      } else {
        setError(authMessageFor(result, isLogin));
      }
    } catch (googleError) {
      console.error('[Google Auth] Backend token exchange failed:', googleError);
      const message = googleError?.response?.data?.detail
        || googleError?.message
        || "Google authentication failed. Please try again.";
      setError(message);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.error('[Google Auth] Missing import.meta.env.VITE_GOOGLE_CLIENT_ID.');
      setError("Google sign-in is missing VITE_GOOGLE_CLIENT_ID. Add it to frontend/.env and restart the app.");
      return;
    }

    let isMounted = true;

    loadGoogleIdentityScript()
      .then(() => {
        if (!isMounted || googleIdentityInitialized) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
        });
        googleIdentityInitialized = true;
      })
      .catch((scriptError) => {
        console.error('[Google Auth] Failed to load Google Identity Services:', scriptError);
        if (isMounted) {
          setError("Google sign-in could not load. Check your connection and try again.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    let result;
    if (isLogin) {
      result = await login(email, password);
    } else {
      const usernameError = validateUsername();
      if (usernameError) {
        setError(usernameError);
        return;
      }
      result = await register(email, password, selectedStruggles, username.trim().replace(/\s+/g, ' '));
    }

    if (result.ok) {
      navigate('/dashboard');
    } else {
      setError(authMessageFor(result, isLogin));
    }
  };

  const handleGoogleAuth = () => {
    setError(null);
    if (!ensureGoogleAuthOrigin({ step, selectedStruggles, isLogin })) {
      return;
    }

    if (!GOOGLE_CLIENT_ID) {
      console.error('[Google Auth] Missing import.meta.env.VITE_GOOGLE_CLIENT_ID.');
      setError("Google sign-in is missing VITE_GOOGLE_CLIENT_ID. Add it to frontend/.env and restart the app.");
      return;
    }

    if (!window.google?.accounts?.id || !googleIdentityInitialized) {
      setError("Google sign-in is still loading. Please try again in a moment.");
      return;
    }

    window.google.accounts.id.prompt();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      
      {/* Background Image with Overlay */}
      <div 
        style={{ 
          position: 'absolute', 
          inset: 0, 
          backgroundImage: `url(${heroImage})`, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          zIndex: -1,
          opacity: 0.4
        }} 
      />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, transparent, var(--bg-primary) 90%)', zIndex: -1 }} />

      <main className="container" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <AnimatePresence mode="wait">
          
          {step === 0 && (
            <PageTransition key="step0">
              <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
                <MotionDiv
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 1.2 }}
                >
                  <h1 className="text-gradient" style={{ fontSize: '3.5rem', marginBottom: '1.5rem', lineHeight: '1.1' }}>The Life Project</h1>
                  <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '3rem' }}>
                    A space to slow down, look inward, and grow beyond the loop.
                  </p>
                </MotionDiv>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                  <PremiumButton onClick={() => setStep(1)} style={{ width: '100%', maxWidth: '280px' }}>
                    Begin Journey <ArrowRight size={20} style={{ marginLeft: '0.5rem' }} />
                  </PremiumButton>
                </div>
              </div>
            </PageTransition>
          )}

          {step === 1 && (
            <PageTransition key="step1">
              <div style={{ textAlign: 'center', maxWidth: '800px' }}>
                <h1 style={{ marginBottom: '1rem' }}>What brought you here?</h1>
                <p style={{ marginBottom: '2.5rem', color: 'var(--text-secondary)' }}>Select what feels true right now. There are no wrong answers.</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '3rem' }}>
                  {STRUGGLES.map((struggle, idx) => (
                    <MotionDiv
                      key={struggle}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <div 
                        className="glass-card"
                        onClick={() => toggleStruggle(struggle)}
                        style={{ 
                          cursor: 'pointer', 
                          padding: '1.25rem',
                          textAlign: 'left',
                          fontSize: '0.95rem',
                          border: selectedStruggles.includes(struggle) ? '1px solid var(--emerald)' : '1px solid var(--glass-border)',
                          background: selectedStruggles.includes(struggle) ? 'rgba(16, 185, 129, 0.1)' : 'var(--glass)',
                          boxShadow: selectedStruggles.includes(struggle) ? '0 0 20px rgba(16, 185, 129, 0.15)' : 'none'
                        }}
                      >
                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Compass size={16} className={selectedStruggles.includes(struggle) ? 'text-emerald' : 'text-muted'} />
                            {struggle}
                         </div>
                      </div>
                    </MotionDiv>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <PremiumButton variant="secondary" onClick={() => setStep(0)}>Back</PremiumButton>
                    <PremiumButton 
                        onClick={handleContinueToStep2}
                        disabled={selectedStruggles.length === 0}
                        style={{ width: '200px' }}
                    >
                        Continue
                    </PremiumButton>
                </div>
              </div>
            </PageTransition>
          )}

          {step === 2 && (
            <PageTransition key="step2">
              <div style={{ textAlign: 'center', maxWidth: '700px' }}>
                <GlassCard style={{ padding: '4rem 3rem' }}>
                    <div style={{ color: 'var(--emerald)', marginBottom: '2rem' }}>
                        <Info size={40} />
                    </div>
                  <h2 style={{ marginBottom: '2rem', fontSize: '2rem' }}>A Moment of Insight</h2>
                  <MotionP
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 1 }}
                    style={{ fontSize: '1.4rem', fontStyle: 'italic', marginBottom: '4rem', lineHeight: '1.8', color: 'var(--text-primary)' }}
                  >
                    "{getInsightMessage()}"
                  </MotionP>
                  <PremiumButton onClick={() => setStep(3)} style={{ minWidth: '240px' }}>
                    Step into The Loop
                  </PremiumButton>
                </GlassCard>
              </div>
            </PageTransition>
          )}

          {step === 3 && (
            <PageTransition key="step3">
              <div style={{ maxWidth: '420px', width: '100%', margin: '0 auto' }}>
                <GlassCard>
                  <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                    {isLogin ? 'Welcome Back' : 'Create Your Space'}
                  </h2>
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>
                    {isLogin ? 'Continue your journey where you left off.' : 'Your sanctuary is almost ready.'}
                  </p>
                  
                  {error && (
                    <MotionDiv
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ color: '#ef4444', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.9rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}
                    >
                        {error}
                    </MotionDiv>
                  )}

                  <form onSubmit={handleAuthSubmit}>
                    {!isLogin && (
                      <InputGroup
                          label="Username"
                          icon={User}
                          type="text"
                          placeholder="Your name"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          minLength={2}
                          maxLength={30}
                          required
                      />
                    )}
                    <InputGroup 
                        label="Email Address"
                        icon={Mail}
                        type="email" 
                        placeholder="you@example.com" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <InputGroup 
                        label="Password"
                        icon={Lock}
                        type="password" 
                        placeholder="••••••••" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    
                    <PremiumButton type="submit" style={{ width: '100%', marginTop: '1rem' }}>
                      {isLogin ? 'Sign In' : 'Create Account'}
                    </PremiumButton>
                  </form>

                  <PremiumButton
                    type="button"
                    variant="secondary"
                    onClick={handleGoogleAuth}
                    style={{ width: '100%', marginTop: '1rem' }}
                  >
                    Continue with Google
                  </PremiumButton>

                  <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <button 
                      className="btn" 
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9rem' }}
                      onClick={() => {
                        setError(null);
                        setIsLogin(!isLogin);
                      }}
                    >
                      {isLogin ? "New here? Join the journey" : "Already have an account? Sign in"}
                    </button>
                  </div>
                </GlassCard>
                
                <div style={{ marginTop: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <Shield size={14} />
                    <span>Your data is encrypted and private.</span>
                </div>
              </div>
            </PageTransition>
          )}

        </AnimatePresence>
      </main>

      {/* Footer Branding */}
      <footer style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
        EST. 2026 — THE LIFE PROJECT — BUILT FOR MEANING
      </footer>
    </div>
  );
}

export default Onboarding;
