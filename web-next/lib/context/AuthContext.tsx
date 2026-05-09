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
  // Start with null - don't trust localStorage on initial load
  const [user, setUser] = useState<User | null>(null);
  const [school, setSchoolState] = useState<School | null>(null);
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
    // Check on client-side only
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    // Check if there's a valid token
    const token = sessionStorage.getItem('sf_token') || localStorage.getItem('sf_token');

    if (token) {
      // Verify token with backend
      auth.me()
        .then((data: any) => {
          setUser(data.user);
          localStorage.setItem('sf_user', JSON.stringify(data.user));
          persistSchool(data.school);
        })
        .catch(() => {
          // Token is invalid or expired, clear everything
          sessionStorage.removeItem('sf_token');
          localStorage.removeItem('sf_token');
          localStorage.removeItem('sf_user');
          localStorage.removeItem('sf_school');
          setUser(null);
          persistSchool(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      // No token, so user is not authenticated
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const data: any = await auth.login({ email, password });
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('sf_token', data.token);
      localStorage.setItem('sf_user', JSON.stringify(data.user));
    }
    setUser(data.user);

    // Fetch school immediately after login
    try {
      const me: any = await auth.me();
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
