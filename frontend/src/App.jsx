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

// TODO: These pages need to be built — routes are declared but will fallback
// import TheLoopPage from './pages/TheLoopPage';
// import MusicPage from './pages/MusicPage';
// import BooksPage from './pages/BooksPage';
// import ProgressPage from './pages/ProgressPage';
// import ProfilePage from './pages/ProfilePage';

const ProtectedRoute = ({ children }) => {
  const user = useUserStore(state => state.user);
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function AppRoutes() {
  const user = useUserStore(state => state.user);
  return (
    <>
      <GlobalNowPlaying />
      <Routes>
        {/* Public */}
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Onboarding />} />

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
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="/music" element={
          <ProtectedRoute><MeditationPage /></ProtectedRoute>
        } />
        <Route path="/books" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="/progress" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  const { fetchUser, loading } = useUserStore();

  useEffect(() => {
    fetchUser();
  }, []);

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
