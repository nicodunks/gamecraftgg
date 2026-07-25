'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import HandFrame from './HandFrame';
import { addCreation } from '@/lib/creations';
import { useSession } from '@/lib/auth-client';

// The key that carries a typed prompt through the login flow: hitting "Make a
// game" while signed out stashes the prompt here, opens /login, and this hero
// restores it when the player lands back — nothing they typed is lost.
const PENDING_KEY = 'gc_pending_prompt';

// Prompt box bounds, in px. These live here (not in CSS) because the grow
// logic must be the single owner of the height — see the effect below.
const PROMPT_MIN_H = 108;
const PROMPT_MAX_H = 260;

export default function PromptHero() {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // 'credits' from the API turns the note into an actionable link
  const [errCode, setErrCode] = useState<string | null>(null);
  // gentle nudge (wobble + red pencil stroke) when the prompt is empty
  const [attn, setAttn] = useState(false);
  const { data: session } = useSession();
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Auto-grow to fit the text, then stop and scroll. Measured from a height of
  // ZERO and clamped here in JS: reading scrollHeight while a CSS min/max-height
  // is in force measures the box, not the text, which feeds the next
  // measurement its own output and runs away. Runs on every value change, which
  // also covers the prompt restored after sign-in.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => {
      // Width must be resolved first: measuring mid-layout (width ~0) wraps the
      // placeholder into a dozen lines and pins the box to its max forever.
      if (!el.clientWidth) return;
      el.style.height = '0px';
      el.style.height = `${Math.min(Math.max(el.scrollHeight, PROMPT_MIN_H), PROMPT_MAX_H)}px`;
    };
    fit();
    // …and again after paint and after the display font swaps in, both of which
    // change how many lines the text occupies.
    const raf = requestAnimationFrame(fit);
    document.fonts?.ready.then(fit).catch(() => {});
    // The box is flex-sized, so a viewport change re-wraps it. Only WIDTH
    // changes matter — reacting to height would feed this observer its own
    // output and loop.
    let lastW = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === lastW) return;
      lastW = el.clientWidth;
      fit();
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [prompt]);

  useEffect(() => {
    const saved = sessionStorage.getItem(PENDING_KEY);
    if (saved) {
      sessionStorage.removeItem(PENDING_KEY);
      setPrompt(saved);
      setNote('Welcome back — your prompt is right where you left it.');
    }
  }, []);

  function goSignIn(text: string) {
    sessionStorage.setItem(PENDING_KEY, text);
    router.push('/login?next=make');
  }

  async function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (busy) return;
    const text = prompt.trim();
    if (text.length < 8) {
      setNote(text ? 'Give it a full sentence — what should the game feel like?' : 'First, type the game you want to play — one sentence is plenty.');
      setErrCode(null);
      setAttn(true);
      setTimeout(() => setAttn(false), 700);
      return;
    }
    // Signed out? Take them straight to sign-in with the prompt preserved.
    if (!session) {
      goSignIn(text);
      return;
    }
    setBusy(true);
    setNote(null);
    setErrCode(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        addCreation({ id: data.id, prompt: text, ts: Date.now() });
        router.push(`/build/${data.id}`);
      } else if (data.code === 'auth') {
        goSignIn(text); // stale session — same path, nothing lost
      } else {
        setNote(data.error ?? 'That prompt broke our pencil. Try again.');
        setErrCode(typeof data.code === 'string' ? data.code : null);
      }
    } catch {
      setNote('That prompt broke our pencil. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="hero draw-in" id="make">
      <h1>Create a game</h1>
      <form className="prompt-row" onSubmit={submit}>
        <div className={`prompt-frame${attn ? ' attn' : ''}`}>
          <HandFrame seed="prompt-box" strokeWidth={1.8} />
          {/* A game idea is a sentence or three, not a search query: the box
              grows with the typing and only starts scrolling once it would
              crowd the page. Enter submits (as it always did); Shift+Enter
              writes a new line. */}
          <textarea
            ref={boxRef}
            className="prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
            placeholder="a penguin learning to fly, one throw at a time…"
            aria-label="Describe the game you want"
            maxLength={400}
            rows={2}
          />
          {/* Send sits INSIDE the box, bottom-right, the way every message box
              works — so the box itself can run the full width and the heading
              stays centered over it. The textarea reserves bottom padding so
              text never slides under the button. */}
          <button
            className="prompt-send"
            type="submit"
            disabled={busy}
            aria-label="Make a game"
            aria-busy={busy}
            title="Make a game (Enter)"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 19V5M12 5l-6.2 6.2M12 5l6.2 6.2"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </form>
      <p className="hero-sub">
        {/* the icon button can't carry a "sharpening…" label, so the line below
            does that job while a build is being admitted */}
        {note ?? (busy ? 'sharpening your idea…' : 'No downloads. No accounts to play. Share a link, dare a friend.')}
        {errCode === 'credits' && (
          <>
            {' '}
            <Link href="/credits">Get credits →</Link>
          </>
        )}
      </p>
    </section>
  );
}
