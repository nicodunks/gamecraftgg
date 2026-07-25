import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { db, getGameAny } from '@/lib/db';
import { auth } from '@/lib/auth';
import { readJson } from '@/lib/http';

const GAMES_DIR = path.join(process.cwd(), 'games');

// Delete a game you made. Ownership is decided SERVER-SIDE from the session —
// creator_ref in the body would be forgeable.
//
// Order matters, and it is not the obvious one. `published.json` is what the
// boot-time disk sync treats as "this folder is a published game", so it is
// removed FIRST: if anything later in this handler fails, the leftover folder
// is inert instead of resurrecting the game as published on the next deploy.
// Only then do the DB rows go, and the folder last.
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ error: 'Sign in first.', code: 'auth' }, { status: 401 });

  const body = await readJson(req);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  if (!/^[a-z0-9-]{3,50}$/.test(slug)) return NextResponse.json({ error: 'bad slug' }, { status: 400 });

  const game = getGameAny(slug);
  if (!game) return NextResponse.json({ error: 'unknown game' }, { status: 404 });
  if (!game.creator_ref || game.creator_ref !== session.user.id) {
    return NextResponse.json({ error: 'That is not your game.' }, { status: 403 });
  }

  const dir = path.resolve(GAMES_DIR, slug);
  // containment: never let a slug walk outside the games dir
  if (dir !== path.join(GAMES_DIR, slug)) return NextResponse.json({ error: 'bad slug' }, { status: 400 });

  // 1. kill the publish marker first (see note above)
  try {
    fs.rmSync(path.join(dir, 'published.json'), { force: true });
  } catch {
    /* already gone — fine */
  }

  // 2. the row and everything hanging off it, in one transaction
  try {
    db().transaction(() => {
      for (const table of ['scores', 'plays', 'ratings', 'reports']) {
        db().prepare(`DELETE FROM ${table} WHERE slug = ?`).run(slug);
      }
      db().prepare('DELETE FROM games WHERE slug = ?').run(slug);
    })();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'delete failed' }, { status: 500 });
  }

  // 3. the files. A failure here leaves an orphan folder with no marker and no
  // row — invisible to players and to disk sync — so it is safe to swallow.
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* orphan folder is inert */
  }

  return NextResponse.json({ ok: true });
}
