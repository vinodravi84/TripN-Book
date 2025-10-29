// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { setAuthToken } from '../services/api';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('authToken') || null);

  // initialize axios auth header on app start
  useEffect(() => {
    if (token) setAuthToken(token);
  }, []); // only on mount

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setAuthToken(authToken); // also stores token in localStorage via setAuthToken
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    setAuthToken(null); // removes token from localStorage
  };

  // keep context logging for debug
  useEffect(() => {
    console.log('🔹 Auth state updated:');
    console.log('User:', user);
    console.log('Token:', token);
  }, [user, token]);

  const isLoggedIn = !!user && !!token;

  // sync across tabs
  useEffect(() => {
    const onStorage = () => {
      try {
        const u = JSON.parse(localStorage.getItem('user'));
        setUser(u);
      } catch {
        setUser(null);
      }
      setToken(localStorage.getItem('authToken') || null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
