/**
 * SINC: Auth page — Login + Signup
 * Route: /auth
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from '@remix-run/react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = typeof window !== 'undefined' ? (window as any).__ENV?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL : '';
const supabaseAnonKey = typeof window !== 'undefined' ? (window as any).__ENV?.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY : '';

function getSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // If already logged in, redirect to app
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/');
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = getSupabase();

    try {
      if (mode === 'signup') {
        const { error: signupErr } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });

        if (signupErr) throw signupErr;

        setError('');
        alert('Check your email to confirm your account, then log in!');
        setMode('login');
      } else {
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });

        if (loginErr) throw loginErr;

        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const supabase = getSupabase();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow background */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(123,95,255,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Circuit grid pattern */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(123,95,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(123,95,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 10 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/">
            <img
              src="/sinc-logo.png"
              alt="SINC"
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                boxShadow: '0 0 40px rgba(123,95,255,0.5)',
                marginBottom: 16,
              }}
            />
          </Link>
          <div
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontWeight: 900,
              fontSize: 28,
              letterSpacing: '0.15em',
              background: 'linear-gradient(135deg, #A78BFA, #60D4F5)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            SINC
          </div>
          <div style={{ color: '#888', fontSize: 13, marginTop: 4, fontFamily: 'Inter, sans-serif' }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'rgba(14,14,28,0.9)',
            border: '1px solid rgba(123,95,255,0.25)',
            borderRadius: 20,
            padding: 32,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          }}
        >
          {/* Google */}
          <button
            onClick={handleGoogle}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              color: '#fff',
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              marginBottom: 20,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: 18, height: 18 }} />
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ color: '#555', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'signup' && (
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6, fontFamily: 'Space Grotesk, sans-serif' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Shiva Kumar"
                  required
                  style={inputStyle}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6, fontFamily: 'Space Grotesk, sans-serif' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6, fontFamily: 'Space Grotesk, sans-serif' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  style={{ ...inputStyle, paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#555',
                    cursor: 'pointer',
                    fontSize: 16,
                  }}
                >
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: 'rgba(255,80,80,0.1)',
                  border: '1px solid rgba(255,80,80,0.3)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: '#FF6B6B',
                  fontSize: 13,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '13px 16px',
                background: loading ? 'rgba(123,95,255,0.4)' : 'linear-gradient(135deg, #7B5FFF, #5B3FDF)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'Space Grotesk, sans-serif',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 0 20px rgba(123,95,255,0.4)',
                transition: 'all 0.2s',
                marginTop: 4,
              }}
            >
              {loading ? '⏳ Please wait...' : mode === 'login' ? '⚡ Sign In' : '🚀 Create Account'}
            </button>
          </form>

          <p
            style={{
              textAlign: 'center',
              fontSize: 13,
              color: '#666',
              marginTop: 20,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#A78BFA',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {mode === 'login' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 11, color: '#444', marginTop: 20, fontFamily: 'Inter, sans-serif' }}>
          By continuing, you agree to SINC's Terms & Privacy Policy
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#fff',
  fontSize: 14,
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};
