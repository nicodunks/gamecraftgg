'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import BuildLoop, { type LoopStage } from '@/components/BuildLoop';

// The build theater, for HUMANS: the loop diagram, a timer, and "go play —
// we'll keep cooking" are the whole show. The raw agent stream still exists
// behind a collapsed peek for the curious; it is never the default view.
type Gen = {
  id: string;
  slug: string | null;
  prompt: string;
  status: 'running' | 'published' | 'failed';
  brief: string | null;
  trace: string;
  cycles: number;
  verdict: string | null;
};

type Ev = { t: number; kind: string; detail: string; stream?: 'thinking' | 'tool' | 'say' };

const AVG_MS = 25 * 60 * 1000; // the honest average — shown to the creator

function fmtLeft(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Translate pipeline events into the creator's story. Returns null for events
// that are workshop plumbing (worker ids, harness output, spend lines).
function friendly(e: Ev): string | null {
  if (e.stream) return null;
  const d = e.detail;
  switch (e.kind) {
    case 'worker':
      return 'The workshop picked up your idea';
    case 'creator':
    case 'designer': // legacy kind — builds started before the creator merge
    case 'builder': // legacy kind
      if (d.startsWith('Brief ready')) {
        const m = d.match(/"([^"]+)"/);
        return m ? `The plan is ready — “${m[1]}”` : 'The plan is ready';
      }
      if (d.startsWith('index.html written')) return 'A playable version is done — now it gets tested';
      if (d.startsWith('Fixing per critique')) {
        const m = d.match(/cycle (\d)/);
        return `Making it better${m ? ` — round ${m[1]}` : ''}…`;
      }
      if (d.startsWith('Editing')) return 'Re-reading your game…';
      if (d.includes('retrying')) return null;
      return 'Dreaming it up, then building it…';
    case 'playtest':
      return d.startsWith('Smoke-testing') || d.startsWith('Play-testing') ? 'Test-driving it on phone and desktop…' : null;
    case 'judge':
      if (d.startsWith('score')) {
        const m = d.match(/score (\d+)\/100/);
        const score = m ? m[1] : null;
        if (d.includes('publish')) return score ? `The judges scored it ${score}/100 — it ships!` : 'The judges signed off!';
        return score ? `Judges: ${score}/100 — sending it back for another pass` : 'The judges want another pass';
      }
      return 'The judges are playing it…';
    case 'publish':
      return 'Your game is live';
    case 'fail':
      if (d.includes('credits')) return 'It didn’t make the cut — your credits are back in your account';
      if (d.includes('unchanged')) return 'The edit didn’t pass — your game is safe and unchanged';
      return 'This one didn’t make the cut';
    case 'error':
      return 'The build hit a snag';
    default:
      return null;
  }
}

export default function BuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [gen, setGen] = useState<Gen | null>(null);
  const [missing, setMissing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [emails, setEmails] = useState(['', '', '']);
  const [emailSaved, setEmailSaved] = useState(false);

  async function saveEmails() {
    const list = emails.map((e) => e.trim()).filter(Boolean);
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, emails: list }),
    });
    if (res.ok) setEmailSaved(true);
  }

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch(`/api/generation/${id}`);
        if (res.status === 404) {
          setMissing(true);
          return;
        }
        const data = (await res.json()) as Gen;
        if (alive) setGen(data);
        if (alive && data.status === 'running') setTimeout(poll, 1500);
      } catch {
        if (alive) setTimeout(poll, 4000);
      }
    }
    poll();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(tick);
    };
  }, [id]);

  if (missing)
    return (
      <main className="game-page">
        <h1 className="display">That build does not exist.</h1>
      </main>
    );
  if (!gen)
    return (
      <main className="game-page">
        <p className="about-game">Opening the workshop…</p>
      </main>
    );

  const allEvents = JSON.parse(gen.trace || '[]') as Ev[];
  const stageEvents = allEvents.filter((e) => !e.stream);

  // the creator's story: humanized, deduped-in-sequence, newest last
  const story: { t: number; text: string }[] = [];
  for (const e of stageEvents) {
    const text = friendly(e);
    if (text && story[story.length - 1]?.text !== text) story.push({ t: e.t, text });
  }

  const lastStage = [...stageEvents].reverse().find((e) => ['creator', 'designer', 'builder', 'playtest', 'judge'].includes(e.kind));
  const rawStage = lastStage?.kind ?? 'creator';
  // legacy designer/builder events fold into the merged creator step
  const stage = (rawStage === 'designer' || rawStage === 'builder' ? 'creator' : rawStage) as LoopStage;

  const startT = allEvents[0]?.t ?? now;
  const elapsed = Math.max(0, now - startT);
  const running = gen.status === 'running';
  const pct = running ? Math.min(97, (elapsed / AVG_MS) * 100) : 100;
  const overTime = running && elapsed >= AVG_MS;

  return (
    <main className="game-page">
      <h1 className="display" style={{ fontSize: 30 }}>
        {running && 'Drawing your game…'}
        {gen.status === 'published' && 'Your game is ready.'}
        {gen.status === 'failed' && 'This one did not make the cut.'}
      </h1>
      <p className="about-game" style={{ marginTop: 8 }}>
        “{gen.prompt}”
      </p>

      <BuildLoop stage={stage} cycles={gen.cycles || 1} status={gen.status} />

      <div className="build-progress">
        <div className="build-bar">
          <div
            className={`build-bar-fill${overTime ? ' almost' : ''}${gen.status === 'published' ? ' done' : ''}${gen.status === 'failed' ? ' failed' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="build-eta">
          {running && !overTime && (
            <>
              <span>most games take about 25 minutes</span>
              <span className="eta-count">~{fmtLeft(AVG_MS - elapsed)} left</span>
            </>
          )}
          {running && overTime && <span>Almost there…</span>}
          {gen.status === 'published' && <span className="eta-count">Done.</span>}
          {gen.status === 'failed' && <span>Nothing was charged — your credits are back.</span>}
        </div>
      </div>

      {running && (
        <div className="build-leave">
          <span>No need to watch — go play, we’ll keep cooking.</span>
          <Link className="btn btn-biro" href="/#games">Play games</Link>
          <Link className="btn" href="/yours">Your games</Link>
        </div>
      )}

      {running && (
        <div className="email-invite">
          {emailSaved ? (
            <p className="ei-done">✓ We’ll email them the link the moment it’s live. Go play something.</p>
          ) : (
            <>
              <p className="ei-head">Send it to friends the moment it’s ready</p>
              <div className="ei-rows">
                {emails.map((v, i) => (
                  <input
                    key={i}
                    className="ei-input"
                    type="email"
                    inputMode="email"
                    value={v}
                    onChange={(e) => setEmails((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder="friend@email.com"
                    aria-label={`Friend email ${i + 1}`}
                  />
                ))}
              </div>
              <button className="btn btn-biro" onClick={saveEmails} disabled={!emails.some((e) => e.trim())}>
                Notify them
              </button>
              <span className="ei-note">Optional — we’ll email you too when it’s done.</span>
            </>
          )}
        </div>
      )}

      {gen.status === 'published' && gen.slug && (
        <p style={{ margin: '18px 0 4px' }}>
          <Link className="btn btn-biro" href={`/g/${gen.slug}`}>
            Play it now
          </Link>
        </p>
      )}
      {gen.status === 'failed' && (
        <p className="about-game" style={{ marginTop: 14 }}>
          The judges wouldn’t sign off. Tweak the idea and try again — a different twist usually does it.
        </p>
      )}

      <ol className="build-story">
        {story.slice(-4).map((s, i, arr) => (
          <li key={s.t} className={running && i === arr.length - 1 ? 'now' : 'done'}>
            <span className="story-mark">{running && i === arr.length - 1 ? '✎' : '✓'}</span>
            {s.text}
          </li>
        ))}
        {story.length === 0 && running && (
          <li className="now">
            <span className="story-mark">✎</span>Warming up the workshop…
          </li>
        )}
      </ol>
    </main>
  );
}
