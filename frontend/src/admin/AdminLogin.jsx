import React, { useState } from 'react';
import { Lock, User, LogIn } from 'lucide-react';
import { Admin } from '../api/client';

export default function AdminLogin({ onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!username || !password) return;
    setSubmitting(true);
    setError('');
    try {
      const { token } = await Admin.login(username.trim(), password);
      onLoggedIn(token);
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || 'Login failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-wati-primary/10 flex items-center justify-center mb-3">
            <Lock size={26} className="text-wati-primary" />
          </div>
          <h1 className="text-xl font-semibold text-wati-text">Admin login</h1>
          <p className="text-[13px] text-wati-muted mt-1">Vanigan Support panel</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-[12px] uppercase tracking-wide text-wati-muted font-medium">Username</span>
            <div className="mt-1 relative">
              <User
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-wati-muted"
              />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-wati-primary focus:bg-white transition-colors"
                placeholder="admin"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-[12px] uppercase tracking-wide text-wati-muted font-medium">Password</span>
            <div className="mt-1 relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-wati-muted"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-wati-primary focus:bg-white transition-colors"
                placeholder="••••••••"
              />
            </div>
          </label>

          {error && (
            <div className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !username || !password}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-wati-primary hover:bg-wati-primaryDark text-white font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <LogIn size={16} />
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="text-[11px] text-wati-muted text-center mt-6">
          Restricted area. All actions are logged.
        </div>
      </div>
    </div>
  );
}
