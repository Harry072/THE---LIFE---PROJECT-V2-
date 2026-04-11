import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore } from './store/userStore';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';

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
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Onboarding />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
    </Routes>
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
      <AppRoutes />
    </Router>
  );
}

export default App;
