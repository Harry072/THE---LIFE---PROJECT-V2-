import React, { useState } from 'react';
import { useUserStore } from '../store/userStore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PremiumButton, GlassCard, InputGroup, PageTransition } from '../components/common/ThemeUI';
import { Mail, Lock, Shield, ArrowRight, Compass, Info, User } from 'lucide-react';
import heroImage from '../assets/hero-tree.png';

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

function Onboarding() {
  const [selectedStruggles, setSelectedStruggles] = useState([]);
  const [step, setStep] = useState(0); // 0: Enter, 1: Struggles, 2: Insight, 3: Auth
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(false);
  const [error, setError] = useState(null);
  
  const { register, login, loginWithGoogle } = useUserStore();
  const navigate = useNavigate();

  const toggleStruggle = (struggle) => {
    setSelectedStruggles(prev => 
      prev.includes(struggle) 
        ? prev.filter(s => s !== struggle)
        : [...prev, struggle]
    );
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
    if (result?.reason === 'email_unverified') {
      return "Check your email to verify your account before entering.";
    }
    if (modeIsLogin || result?.reason === 'invalid_credentials') {
      return "Invalid email or password.";
    }
    return "Authentication failed. Please try again.";
  };

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

  const handleGoogleAuth = async () => {
    setError(null);
    const result = await loginWithGoogle();
    if (!result.ok && result.reason !== 'oauth_started') {
      setError("Authentication failed. Please try again.");
    }
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
                        onClick={() => setStep(2)}
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
