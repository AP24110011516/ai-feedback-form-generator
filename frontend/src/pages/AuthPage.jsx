import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const { signIn, signUp, authError } = useAuth();
  const [mode, setMode] = useState('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isSignUp = mode === 'sign-up';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const { data, error: authRequestError } = isSignUp
        ? await signUp(email.trim(), password)
        : await signIn(email.trim(), password);

      if (authRequestError) throw authRequestError;
      if (isSignUp && !data.session) {
        setMessage('Account created. Check your email to confirm your address, then sign in.');
      }
    } catch (authRequestError) {
      setError(authRequestError.message || 'Supabase authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
      <section className="card" style={{ width: '100%', maxWidth: '440px', padding: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800' }}>FormGenius AI</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            {isSignUp ? 'Create an account to manage your feedback forms.' : 'Sign in to manage your feedback forms.'}
          </p>
        </div>

        {(error || authError) && (
          <p role="alert" style={{ color: '#b91c1c', marginBottom: '1rem', overflowWrap: 'anywhere' }}>
            {error || `Authentication initialization failed: ${authError}`}
          </p>
        )}
        {message && (
          <p role="status" style={{ color: '#047857', marginBottom: '1rem' }}>{message}</p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem', fontWeight: '600' }}>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem', fontWeight: '600' }}>
            Password
            <input
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={isSignUp ? 6 : undefined}
              required
              style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}
            />
          </label>
          <button className="btn-primary" type="submit" disabled={submitting} style={{ justifyContent: 'center' }}>
            {submitting ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(isSignUp ? 'sign-in' : 'sign-up');
            setError('');
            setMessage('');
          }}
          style={{ marginTop: '1.25rem', background: 'none', color: 'var(--primary)', fontWeight: '600' }}
        >
          {isSignUp ? 'Already have an account? Sign in' : 'New to FormGenius? Create an account'}
        </button>
      </section>
    </main>
  );
}
