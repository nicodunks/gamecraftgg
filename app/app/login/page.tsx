'use client';

import { useEffect, useState } from 'react';
import { signIn } from '@/lib/auth-client';

// GOOGLE-ONLY (founder call, 2026-07-25). The email + password form is
// commented out below rather than deleted: Google-asserted emails are always
// verified, which is what makes free credits defensible without a mail service.
// New accounts start with 2000 credits; the grant happens server-side on user
// creation, and account linking means a returning password user lands back in
// their original account instead of a duplicate.
export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // arrived mid-"Make a game"? Route back to the prompt after auth.
  const [fromMake, setFromMake] = useState(false);
  const [googleReady, setGoogleReady] = useState<boolean | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setFromMake(q.get('next') === 'make');
    // OAuth failures bounce back here with ?error=… — say something human
    if (q.get('error')) setNote('Google sign-in didn’t go through — give it another try.');
    fetch('/api/auth-config')
      .then((r) => r.json())
      .then((c) => setGoogleReady(!!c.google))
      .catch(() => setGoogleReady(false));
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
      setNote(res.error.message ?? 'Google sign-in didn’t go through — give it another try.');
      setBusy(false);
    }
  }

  /* ---------------------------------------------------------------------
   * EMAIL + PASSWORD (disabled — Google-only). Restore this block together
   * with `emailAndPassword` in lib/auth.ts to bring it back.
   *
   * const [mode, setMode] = useState<'in' | 'up'>('up');
   * const [email, setEmail] = useState('');
   * const [password, setPassword] = useState('');
   * const router = useRouter();
   *
   * async function submit(e: React.FormEvent) {
   *   e.preventDefault();
   *   if (busy) return;
   *   setBusy(true);
   *   setNote(null);
   *   const res =
   *     mode === 'up'
   *       ? await signUp.email({ email, password, name: email.split('@')[0] || 'player' })
   *       : await signIn.email({ email, password });
   *   if (res.error) {
   *     setNote(res.error.message ?? 'That didn’t work — check the email and password.');
   *     setBusy(false);
   *     return;
   *   }
   *   try {
   *     await fetch('/api/adopt', {
   *       method: 'POST',
   *       headers: { 'content-type': 'application/json' },
   *       body: JSON.stringify({ ref: getRef() }),
   *     });
   *   } catch {}
   *   router.push(fromMake ? '/#make' : '/');
   *   router.refresh();
   * }
   *
   * …and in the markup, above the Google button:
   * <form className="prompt-row" onSubmit={submit}> …email + password inputs… </form>
   * --------------------------------------------------------------------- */

  return (
    <main className="hero draw-in" style={{ minHeight: '60vh' }}>
      <h1>{fromMake ? 'One step from your game — 2000 free credits' : 'Make an account, get 2000 credits'}</h1>
      {fromMake && <p className="hero-sub">Your prompt is saved. Sign in and we’ll put it right back.</p>}

      {/* no hand-frame here: the button already carries its own border, and a
          drawn box around it reads as a stray mark rather than a frame */}
      <div className="login-panel">
        {googleReady === false ? (
          <p className="hero-sub" style={{ margin: 0 }}>
            Sign-in is briefly unavailable. Try again in a minute.
          </p>
        ) : (
          <button type="button" className="btn btn-biro oauth-google" onClick={googleSignIn} disabled={busy || googleReady === null}>
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2.1 5.1-4.4 6.7v5.5h7.1c4.2-3.9 6.6-9.6 6.6-16.2z" />
              <path fill="#34A853" d="M24 46c6 0 10.9-2 14.6-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z" />
              <path fill="#FBBC05" d="M11.6 28.2c-.4-1.3-.7-2.8-.7-4.2s.3-2.9.7-4.2v-5.7H4.3C2.9 17 2 20.4 2 24s.9 7 2.3 9.9l7.3-5.7z" />
              <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.3 30 2 24 2 15.4 2 7.9 6.9 4.3 14.1l7.3 5.7c1.8-5.2 6.6-9 12.4-9z" />
            </svg>
            {busy ? 'signing in…' : 'Continue with Google'}
          </button>
        )}
      </div>

      <p className="hero-sub">
        {note ?? 'Two free games on the house. A game costs 1000 credits to make, an edit 200.'}
      </p>
    </main>
  );
}
