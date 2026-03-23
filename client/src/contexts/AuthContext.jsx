import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api.js';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load current user on mount
  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = useCallback(async () => {
    try {
      const data = await authAPI.getMe();
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authAPI.login(email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch {
      // Ignore errors on logout
    }
    setUser(null);
  }, []);

  const register = useCallback(async (email, password, role = 'client') => {
    const data = await authAPI.register(email, password, role);
    return data.user;
  }, []);

  const createFirstAdmin = useCallback(async (email, password) => {
    const data = await authAPI.createFirstAdmin(email, password);
    setUser(data.user);
    return data.user;
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    register,
    createFirstAdmin,
    refreshUser: loadCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
