'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HandFrame from '@/components/HandFrame';
import { signIn, signUp } from '@/lib/auth-client';
import { getRef } from '@/lib/ref';

// Email + password, plus Google when its secrets are configured (the button
// asks /api/auth-config so a creds-less deploy simply hides it). New accounts
// start with 2000 credits; the grant happens server-side on user creation —
// same hook for both methods, and account linking means one inbox never earns
// the grant twice.
export default function LoginPage() {
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // arrived mid-"Make a game"? Route back to the prompt after auth.
  const [fromMake, setFromMake] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setFromMake(q.get('next') === 'make');
    // OAuth failures bounce back here with ?error=… — say something human
    if (q.get('error')) setNote('Google sign-in didn’t go through — try again, or use email.');
    fetch('/api/auth-config')
      .then((r) => r.json())
      .then((c) => setGoogleReady(!!c.google))
      .catch(() => {});
  }, []);

  async function googleSignIn() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    // Redirect flow: the browser leaves for Google and returns to the landing
    // page, which adopts this browser's anonymous games and forwards home.
    const res = await signIn.social({
      provider: 'google',
      callbackURL: fromMake ? '/auth/landing?next=make' : '/auth/landing',
      errorCallbackURL: '/login?error=oauth',
    });
    if (res?.error) {
      setNote(res.error.message ?? 'Google sign-in didn’t go through — try again, or use email.');
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setNote(null);
    const res =
      mode === 'up'
        ? await signUp.email({ email, password, name: email.split('@')[0] || 'player' })
        : await signIn.email({ email, password });
    if (res.error) {
      setNote(res.error.message ?? 'That didn’t work — check the email and password.');
      setBusy(false);
      return;
    }
    // Adopt this browser's anonymous games into the account, so nothing made
    // before signing up is lost. Fire-and-forget: a failure here must not
    // block the sign-in itself.
    try {
      await fetch('/api/adopt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ref: getRef() }),
      });
    } catch {
      /* adopted next time they sign in */
    }
    router.push(fromMake ? '/#make' : '/');
    router.refresh();
  }

  return (
    <main className="hero draw-in" style={{ minHeight: '60vh' }}>
      <h1>{mode === 'up' ? (fromMake ? 'One step from your game — 2000 free credits' : 'Make an account, get 2000 credits') : 'Welcome back'}</h1>
      {fromMake && <p className="hero-sub">Your prompt is saved. Sign {mode === 'up' ? 'up' : 'in'} and we’ll put it right back.</p>}
      <form className="prompt-row" onSubmit={submit} style={{ flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div className="prompt-frame" style={{ width: 'min(420px, 90vw)' }}>
          <HandFrame seed="login-email" strokeWidth={1.8} />
          <input
            className="prompt-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@somewhere.com"
            aria-label="Email"
            autoComplete="email"
          />
        </div>
        <div className="prompt-frame" style={{ width: 'min(420px, 90vw)' }}>
          <HandFrame seed="login-password" strokeWidth={1.8} />
          <input
            className="prompt-input"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'up' ? 'a password (8+ characters)' : 'your password'}
            aria-label="Password"
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
          />
        </div>
        <button className="btn btn-biro" type="submit" disabled={busy}>
          {busy ? 'signing…' : mode === 'up' ? 'Create account' : 'Sign in'}
        </button>
      </form>
      {googleReady && (
        <div className="oauth-row">
          <span className="oauth-or">or</span>
          <button type="button" className="btn oauth-google" onClick={googleSignIn} disabled={busy}>
            <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2.1 5.1-4.4 6.7v5.5h7.1c4.2-3.9 6.6-9.6 6.6-16.2z" />
              <path fill="#34A853" d="M24 46c6 0 10.9-2 14.6-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z" />
              <path fill="#FBBC05" d="M11.6 28.2c-.4-1.3-.7-2.8-.7-4.2s.3-2.9.7-4.2v-5.7H4.3C2.9 17 2 20.4 2 24s.9 7 2.3 9.9l7.3-5.7z" />
              <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.3 30 2 24 2 15.4 2 7.9 6.9 4.3 14.1l7.3 5.7c1.8-5.2 6.6-9 12.4-9z" />
            </svg>
            Continue with Google
          </button>
        </div>
      )}
      <p className="hero-sub">
        {note ?? (mode === 'up' ? 'Two free games on the house. A game costs 1000 credits to make, an edit 200.' : '')}{' '}
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'up' ? 'in' : 'up');
            setNote(null);
          }}
          style={{ background: 'none', border: 'none', color: 'var(--biro)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}
        >
          {mode === 'up' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
      </p>
    </main>
  );
}
