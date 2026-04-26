import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore } from './store/userStore';
import { AppStateProvider } from './contexts/AppStateContext';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import MeditationPage from './pages/MeditationPage';
import FounderStoryPage from './pages/FounderStoryPage';
import GlobalNowPlaying from './components/GlobalNowPlaying';
import ReflectionPage from './pages/ReflectionPage';
import ProgressPage from './pages/ProgressPage';
import ProfilePage from './pages/ProfilePage';
import TheLoopPage from './pages/TheLoopPage';
import CuratorPage from './features/curator/CuratorPage';

const ProtectedRoute = ({ children }) => {
  const user = useUserStore(state => state.user);
  const session = useUserStore(state => state.session);
  const isVerified = useUserStore(state => state.isVerified);
  if (!user || !session || !isVerified) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function AppRoutes() {
  const user = useUserStore(state => state.user);
  const session = useUserStore(state => state.session);
  const isVerified = useUserStore(state => state.isVerified);
  const isAuthenticated = Boolean(user && session && isVerified);

  return (
    <>
      <GlobalNowPlaying />
      <Routes>
        {/* Public */}
        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Onboarding />} />

        {/* Protected — existing pages */}
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="/meditation" element={
          <ProtectedRoute><MeditationPage /></ProtectedRoute>
        } />
        <Route path="/story" element={
          <ProtectedRoute><FounderStoryPage /></ProtectedRoute>
        } />
        <Route path="/reflection" element={
          <ProtectedRoute><ReflectionPage /></ProtectedRoute>
        } />

        {/* Protected — TODO pages (redirect to dashboard until built) */}
        <Route path="/loop" element={
          <ProtectedRoute><TheLoopPage /></ProtectedRoute>
        } />
        <Route path="/music" element={
          <ProtectedRoute><MeditationPage /></ProtectedRoute>
        } />
        <Route path="/curator" element={
          <ProtectedRoute><CuratorPage /></ProtectedRoute>
        } />
        <Route path="/books" element={
          <ProtectedRoute><Navigate to="/curator" replace /></ProtectedRoute>
        } />
        <Route path="/progress" element={
          <ProtectedRoute><ProgressPage /></ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute><ProfilePage /></ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

import { isSupabaseConfigured } from './lib/supabase';

// Production Diagnostic Guard
const CloudConfigGuard = () => {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      background: 'radial-gradient(circle at center, #064e3b, #022c22 80%)',
      color: 'white',
      padding: '2rem',
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '600px', background: 'rgba(0,0,0,0.3)', padding: '3rem', borderRadius: '24px', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#10b981' }}>Cloud Configuration Required</h1>
        <p style={{ fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '2.5rem', opacity: 0.9 }}>
          Your project is now in <strong>Strict Cloud Mode</strong>. 
          To enable the experience, you must link your Supabase project.
        </p>
        
        <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.4)', padding: '1.5rem', borderRadius: '12px', fontSize: '0.9rem', marginBottom: '2.5rem', borderLeft: '4px solid #10b981' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Instructions:</p>
          <ol style={{ marginLeft: '1.2rem', opacity: 0.8 }}>
            <li>Open the <code>frontend/.env</code> file in your editor.</li>
            <li>Ensure it contains: <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.</li>
            <li>Ensure the keys start with the <code>VITE_</code> prefix.</li>
            <li><strong>Save the file</strong> and the app will reload.</li>
          </ol>
        </div>

        <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>
          DEBUG INFO:<br/>
          URL: {import.meta.env.VITE_SUPABASE_URL ? '✅ LOADED' : '❌ MISSING'}<br/>
          KEY: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ LOADED' : '❌ MISSING'}
        </div>
      </div>
    </div>
  );
};

function App() {
  const { fetchUser, loading } = useUserStore();

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchUser();
    }
  }, [fetchUser]);

  if (!isSupabaseConfigured) {
    return <CloudConfigGuard />;
  }

  if (loading) {
    return <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: 'white'}}>Loading...</div>;
  }

  return (
    <Router>
      <AppStateProvider>
        <AppRoutes />
      </AppStateProvider>
    </Router>
  );
}


export default App;
