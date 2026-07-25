import Link from 'next/link';
import type { Metadata } from 'next';
import { getTopMakers } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Top users — GameCraft' };

// The leaderboard of PEOPLE — gamertags ranked by how much the community plays
// their games. Each name shows its hit games right underneath, so "top user"
// reads as "made the games everyone is playing", not an abstract number.
export default function MakersPage() {
  const makers = getTopMakers(100);
  return (
    <main className="makers-page">
      <div className="feed-head">
        <h2>Top users</h2>
        <span className="rule" />
        <span className="feed-note">the people behind the most-played games</span>
      </div>
      {makers.length === 0 ? (
        <p className="about-game">No makers yet — be the first name on the board.</p>
      ) : (
        <ol className="makers-list">
          {makers.map((m, i) => (
            <li key={m.name}>
              <span className={`maker-rank${i < 3 ? ` top r${i + 1}` : ''}`}>{i + 1}</span>
              <div className="maker-cell">
                <div className="maker-row">
                  <Link href={`/u/${encodeURIComponent(m.name)}`} className="maker-name">
                    {m.name}
                  </Link>
                  <span className="maker-stat mono">{m.plays.toLocaleString()} {m.plays === 1 ? 'play' : 'plays'}</span>
                  <span className="maker-stat mono dim">{m.games} {m.games === 1 ? 'game' : 'games'}</span>
                </div>
                <div className="maker-games">
                  {m.topGames.map((g) => (
                    <Link key={g.slug} href={`/g/${g.slug}`} className="maker-game">
                      {g.title}
                      <span className="mono">{g.plays.toLocaleString()}</span>
                    </Link>
                  ))}
                  {m.games > m.topGames.length && (
                    <Link href={`/u/${encodeURIComponent(m.name)}`} className="maker-game more">
                      +{m.games - m.topGames.length} more
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
