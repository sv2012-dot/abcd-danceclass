import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth as authApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sf_user')); } catch { return null; }
  });
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sf_token');
    if (token) {
      authApi.me()
        .then(data => { setUser(data.user); setSchool(data.school); })
        .catch(() => { localStorage.removeItem('sf_token'); localStorage.removeItem('sf_user'); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login({ email, password });
    localStorage.setItem('sf_token', data.token);
    localStorage.setItem('sf_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('sf_token');
    localStorage.removeItem('sf_user');
    setUser(null);
    setSchool(null);
  };

  return (
    <AuthContext.Provider value={{ user, school, loading, login, logout, setSchool }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);