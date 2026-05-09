'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '@/lib/api';

type User = {
  id: string;
  name: string;
  email: string;
};

type School = {
  id: string;
  name: string;
};

type AuthContextType = {
  user: User | null;
  school: School | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  setSchool: (school: School | null) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('sf_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [school, setSchoolState] = useState<School | null>(() => {
    try {
      const stored = localStorage.getItem('sf_school');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  const persistSchool = (s: School | null) => {
    setSchoolState(s);
    if (s) {
      localStorage.setItem('sf_school', JSON.stringify(s));
    } else {
      localStorage.removeItem('sf_school');
    }
  };

  useEffect(() => {
    const token = typeof window !== 'undefined'
      ? (sessionStorage.getItem('sf_token') || localStorage.getItem('sf_token'))
      : null;

    if (token) {
      auth.me()
        .then((data) => {
          setUser(data.user);
          persistSchool(data.school);
        })
        .catch(() => {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('sf_token');
            localStorage.removeItem('sf_token');
            localStorage.removeItem('sf_user');
            localStorage.removeItem('sf_school');
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const data = await auth.login({ email, password });
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('sf_token', data.token);
      localStorage.setItem('sf_user', JSON.stringify(data.user));
    }
    setUser(data.user);

    // Fetch school immediately after login
    try {
      const me = await auth.me();
      persistSchool(me.school);
    } catch (_) {
      // Ignore errors
    }

    return data.user;
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('sf_token');
      localStorage.removeItem('sf_token');
      localStorage.removeItem('sf_user');
      localStorage.removeItem('sf_school');
    }
    setUser(null);
    setSchoolState(null);
  };

  return (
    <AuthContext.Provider value={{ user, school, loading, login, logout, setSchool: persistSchool }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
