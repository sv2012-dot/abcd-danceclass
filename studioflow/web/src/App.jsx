import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import BatchesPage from './pages/BatchesPage';
import SchedulePage from './pages/SchedulePage';
import RecitalsPage from './pages/RecitalsPage';
import FeesPage from './pages/FeesPage';
import SchoolsPage from './pages/SchoolsPage';
import ParentPage from './pages/ParentPage';

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontSize:32}}>🩰</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="schools"  element={<RequireAuth roles={['superadmin']}><SchoolsPage /></RequireAuth>} />
          <Route path="students" element={<RequireAuth roles={['superadmin','school_admin','teacher']}><StudentsPage /></RequireAuth>} />
          <Route path="batches"  element={<RequireAuth roles={['superadmin','school_admin','teacher']}><BatchesPage /></RequireAuth>} />
          <Route path="schedule" element={<RequireAuth roles={['superadmin','school_admin','teacher']}><SchedulePage /></RequireAuth>} />
          <Route path="recitals" element={<RequireAuth roles={['superadmin','school_admin','teacher']}><RecitalsPage /></RequireAuth>} />
          <Route path="fees"     element={<RequireAuth roles={['superadmin','school_admin']}><FeesPage /></RequireAuth>} />
          <Route path="parent"   element={<RequireAuth roles={['parent']}><ParentPage /></RequireAuth>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
