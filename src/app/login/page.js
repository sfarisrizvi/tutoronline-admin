'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const supabase = createClient();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      const user = data.user;
      const role = user?.user_metadata?.role;

      if (role !== 'admin') {
        // Sign out non-admins immediately
        await supabase.auth.signOut();
        setErrorMsg('Access Denied: You do not have permission to access the admin panel.');
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch (err) {
      setErrorMsg('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--brand-teal-deep)',
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: 'var(--canvas)',
        borderRadius: 'var(--rounded-lg)',
        width: '100%',
        maxWidth: '400px',
        padding: '32px',
        boxShadow: 'var(--shadow-modal)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img 
            src="/light-logo.svg" 
            alt="Tutor Online" 
            style={{ height: '40px', width: 'auto', display: 'inline-block', marginBottom: '8px' }} 
          />
          <h3 style={{ margin: 0, color: 'var(--ink)' }}>Admin Login</h3>
          <p style={{ fontSize: '14px', color: 'var(--steel)', margin: '8px 0 0 0' }}>
            Tutor Online Control Center
          </p>
        </div>

        {errorMsg && (
          <div style={{
            backgroundColor: '#FFEBEE',
            border: '1px solid #FFCDD2',
            color: '#B71C1C',
            borderRadius: 'var(--rounded-sm)',
            padding: '12px',
            fontSize: '14px',
            marginBottom: '20px'
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--slate)', marginBottom: '8px' }}>
              Email Address
            </label>
            <input
              type="email"
              required
              className="admin-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@findtutors.pk"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--slate)', marginBottom: '8px' }}>
              Password
            </label>
            <input
              type="password"
              required
              className="admin-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="admin-btn admin-btn-primary"
            style={{ width: '100%', height: '44px', marginTop: '8px' }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
