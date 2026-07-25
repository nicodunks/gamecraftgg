'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { getRef } from '@/lib/ref';

// Where the Google OAuth redirect lands. The email flow adopts this browser's
// anonymous games inline after sign-in; a redirect flow can't, so this page
// does that one job and forwards to the real destination. Fire-and-forget:
// adoption failure must never strand the user here.
function Landing() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const next = params.get('next') === 'make' ? '/#make' : '/';
    (async () => {
      try {
        await fetch('/api/adopt', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ref: getRef() }),
        });
      } catch {
        /* adopted next time they sign in */
      }
      router.replace(next);
      router.refresh();
    })();
  }, [router, params]);
  return (
    <main className="hero draw-in" style={{ minHeight: '60vh' }}>
      <p className="hero-sub">Signing you in…</p>
    </main>
  );
}

export default function AuthLandingPage() {
  return (
    <Suspense fallback={null}>
      <Landing />
    </Suspense>
  );
}
