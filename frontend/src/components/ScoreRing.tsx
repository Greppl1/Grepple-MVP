'use client';

import { useId } from 'react';

function scoreStroke(score: number): [string, string] {
  if (score >= 85) return ['#18DC7E', '#4AE89E'];
  if (score >= 60) return ['#7B6BA8', '#4A6CF7'];
  return ['#F5A623', '#FF6B35'];
}

export default function ScoreRing({ score, size = 60 }: { score: number; size?: number }) {
  const id = useId();
  const gradId = `score-grad-${id}`;
  const s = Math.max(0, Math.min(100, score));
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (s / 100) * circ;
  const center = size / 2;
  const [c1, c2] = scoreStroke(s);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="#2D2855"
          strokeWidth={size * 0.07}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={size * 0.07}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c1} />
            <stop offset="100%" stopColor={c2} />
          </linearGradient>
        </defs>
      </svg>
      <span
        className="absolute font-mono font-bold text-white"
        style={{ fontSize: size * 0.24 }}
      >
        {score}
      </span>
    </div>
  );
}
