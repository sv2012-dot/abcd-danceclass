import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { auth as authApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync('sf_token').then(token => {
      if (token) {
        return authApi.me().then(data => { setUser(data.user); setSchool(data.school); });
      }
    }).catch(() => SecureStore.deleteItemAsync('sf_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login({ email, password });
    await SecureStore.setItemAsync('sf_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('sf_token');
    setUser(null); setSchool(null);
  };

  return <AuthContext.Provider value={{ user, school, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);