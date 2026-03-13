import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import StudentsPage from './pages/StudentsPage';
import BatchesPage from './pages/BatchesPage';
import SchedulePage from './pages/SchedulePage';
import SchoolsPage from './pages/SchoolsPage';
import ParentPortalPage from './pages/ParentPortalPage';
import SchoolAboutPage from './pages/SchoolAboutPage';
import AppShell from './components/shared/AppShell';

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'var(--font-d)',fontSize:20,color:'#c4527a'}}>🩰 Loading StudioFlow...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<HomePage />} />
        <Route path="students" element={<RequireAuth roles={['superadmin','school_admin','teacher']}><StudentsPage /></RequireAuth>} />
        <Route path="batches" element={<RequireAuth roles={['superadmin','school_admin','teacher']}><BatchesPage /></RequireAuth>} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="schools" element={<RequireAuth roles={['superadmin']}><SchoolsPage /></RequireAuth>} />
        <Route path="parent" element={<RequireAuth roles={['parent']}><ParentPortalPage /></RequireAuth>} />
        <Route path="about" element={<SchoolAboutPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}