import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import StudentsPage from './pages/StudentsPage';
import BatchesPage from './pages/BatchesPage';
import SchedulePage from './pages/SchedulePage';
import SchoolsPage from './pages/SchoolsPage';
import ParentPortalPage from './pages/ParentPortalPage';
import SchoolAboutPage from './pages/SchoolAboutPage';
import TodosPage from './pages/TodosPage';
import StudiosPage from './pages/StudiosPage';
import VendorsPage from './pages/VendorsPage';
import RecitalsPage from './pages/RecitalsPage';
import LandingPageA from './pages/LandingPageA';
import LandingPageC from './pages/LandingPageC';
import AppShell from './components/shared/AppShell';

const LOADING = (
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,height:'100vh',fontFamily:'var(--font-d)',fontSize:20,color:'#c4527a'}}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M10.8 1.4 L12 0.2 L13.2 1.4" stroke="#c4527a" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="3.4" r="2.1" fill="#c4527a"/><path d="M12 5.5 L12 12.5" stroke="#c4527a" strokeWidth="2" strokeLinecap="round"/><path d="M12 8 L17.2 4.8 L18.8 3.4" stroke="#c4527a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 8 L6.8 11.2 L5.2 12.8" stroke="#c4527a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 12.5 L16.5 16.5 L16.5 21" stroke="#c4527a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 12.5 L7.5 16.5 L7.5 21" stroke="#c4527a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 22 L19 22" stroke="#c4527a" strokeWidth="1.4" strokeLinecap="round"/></svg>
    Loading ManchQ...
  </div>
);

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return LOADING;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

// Shows landing page to logged-out visitors; the app shell to logged-in users.
function RootGuard() {
  const { user, loading } = useAuth();
  if (loading) return LOADING;
  if (!user) return <LandingPageA />;
  return <AppShell />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/landing-c" element={<LandingPageC />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<RootGuard />}>
        <Route index element={<HomePage />} />
        <Route path="students" element={<RequireAuth roles={['superadmin','school_admin','teacher']}><StudentsPage /></RequireAuth>} />
        <Route path="batches" element={<RequireAuth roles={['superadmin','school_admin','teacher']}><BatchesPage /></RequireAuth>} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="recitals" element={<Navigate to="/schedule" replace />} />
        <Route path="schools" element={<RequireAuth roles={['superadmin']}><SchoolsPage /></RequireAuth>} />
        <Route path="parent" element={<RequireAuth roles={['parent']}><ParentPortalPage /></RequireAuth>} />
        <Route path="about" element={<SchoolAboutPage />} />
        <Route path="todos" element={<RequireAuth roles={['superadmin','school_admin','teacher']}><TodosPage /></RequireAuth>} />
        <Route path="studios" element={<RequireAuth roles={['superadmin','school_admin','teacher']}><StudiosPage /></RequireAuth>} />
        <Route path="vendors" element={<RequireAuth roles={['superadmin','school_admin','teacher']}><VendorsPage /></RequireAuth>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}