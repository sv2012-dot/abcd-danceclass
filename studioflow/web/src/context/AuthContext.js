import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth as authApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sf_user')); } catch { return null; }
  });
  const [school, setSchool] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sf_school')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const persistSchool = (s) => {
    setSchool(s);
    if (s) localStorage.setItem('sf_school', JSON.stringify(s));
    else localStorage.removeItem('sf_school');
  };

  useEffect(() => {
    const token = sessionStorage.getItem('sf_token') || localStorage.getItem('sf_token');
    if (token) {
      authApi.me()
        .then(data => { setUser(data.user); persistSchool(data.school); })
        .catch(() => {
          sessionStorage.removeItem('sf_token');
          localStorage.removeItem('sf_token');
          localStorage.removeItem('sf_user');
          localStorage.removeItem('sf_school');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  const login = async (email, password) => {
    const data = await authApi.login({ email, password });
    sessionStorage.setItem('sf_token', data.token);
    localStorage.setItem('sf_user', JSON.stringify(data.user));
    setUser(data.user);
    // Fetch school immediately after login so sidebar shows the name right away
    try {
      const me = await authApi.me();
      persistSchool(me.school);
    } catch (_) {}
    return data.user;
  };

  const logout = () => {
    sessionStorage.removeItem('sf_token');
    localStorage.removeItem('sf_token');
    localStorage.removeItem('sf_user');
    localStorage.removeItem('sf_school');
    setUser(null);
    setSchool(null);
  };

  return (
    <AuthContext.Provider value={{ user, school, loading, login, logout, setSchool: persistSchool }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
