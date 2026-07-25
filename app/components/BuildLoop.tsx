'use client';

// The build journey, drawn as three friendly steps: making → trying → judging.
// No role diagrams, no fix-cycle plumbing — the ACTIVE step shimmers, done
// steps are inked, steps not yet reached sit faint. A small "extra polish"
// note appears when the loop goes around again; that's all a creator needs.
export type LoopStage = 'creator' | 'playtest' | 'judge';

const NODES: { key: LoopStage; name: string; desc: string }[] = [
  { key: 'creator', name: 'making it', desc: 'dreaming up the game, then coding it' },
  { key: 'playtest', name: 'trying it', desc: 'played for real, phone and desktop' },
  { key: 'judge', name: 'judging it', desc: 'only fun games get through' },
];

export default function BuildLoop({
  stage,
  cycles,
  status,
}: {
  stage: LoopStage;
  cycles: number;
  status: 'running' | 'published' | 'failed';
}) {
  const activeIdx = NODES.findIndex((n) => n.key === stage);
  const state = (i: number) => {
    if (status !== 'running') return 'done';
    if (i < activeIdx || cycles > 1) return 'done'; // past round 1, everything has run at least once
    if (i === activeIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="loop-wrap" aria-label={`Build progress — currently ${status === 'running' ? NODES[activeIdx]?.name : status}`}>
      <div className="loop-row">
        {NODES.map((n, i) => (
          <div key={n.key} style={{ display: 'contents' }}>
            <div className={`loop-node ${state(i)}${status === 'running' && i === activeIdx ? ' active' : ''}`}>
              <div className="ln-name">{n.name}</div>
              <div className="ln-desc">{n.desc}</div>
            </div>
            {i < NODES.length - 1 && (
              <div className="loop-arrow" aria-hidden>
                ⟶
              </div>
            )}
          </div>
        ))}
      </div>
      {status === 'running' && cycles > 1 && (
        <div className="loop-under">
          <span className="loop-cycle mono hot">giving it extra polish — round {cycles}</span>
        </div>
      )}
    </div>
  );
}
