import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext.jsx';
import toast from 'react-hot-toast';

function EyeLogo() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#1a1a2e" />
      <ellipse cx="32" cy="32" rx="28" ry="18" stroke="url(#logoGrad)" strokeWidth="2.5" fill="none" />
      <circle cx="32" cy="32" r="10" stroke="url(#logoGrad)" strokeWidth="2" fill="url(#logoGrad)" fillOpacity="0.2" />
      <circle cx="32" cy="32" r="4" fill="url(#logoGrad)" />
    </svg>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'first-admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, createFirstAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'first-admin') {
        const user = await createFirstAdmin(email, password);
        toast.success('Admin account created!');
        navigate('/admin');
      } else {
        const user = await login(email, password);
        toast.success(`Welcome back!`);
        navigate(user.role === 'admin' ? '/admin' : '/client');
      }
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Login failed';
      if (message.includes('Admin already exists')) {
        setMode('login');
        toast.error('Please log in with your existing credentials');
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-dark flex items-center justify-center p-4">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary-900/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-accent-600/20 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm relative"
      >
        <div className="card text-center">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <EyeLogo />
          </div>
          <h1 className="text-3xl font-extrabold gradient-text mb-1">EyeMix</h1>
          <p className="text-slate-400 text-sm mb-8">Iris Art Fusion Platform</p>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field"
                autoComplete={mode === 'first-admin' ? 'new-password' : 'current-password'}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-base py-3 flex items-center justify-center gap-2"
            >
              {loading && (
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {mode === 'first-admin' ? 'Create Admin Account' : 'Sign In'}
            </button>
          </form>

          {/* First admin setup link */}
          <div className="mt-6 pt-4 border-t border-surface-border">
            {mode === 'login' ? (
              <button
                onClick={() => setMode('first-admin')}
                className="text-xs text-slate-500 hover:text-primary-400 transition-colors"
              >
                First time setup? Create admin account
              </button>
            ) : (
              <button
                onClick={() => setMode('login')}
                className="text-xs text-slate-500 hover:text-primary-400 transition-colors"
              >
                Already have an account? Sign in
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
