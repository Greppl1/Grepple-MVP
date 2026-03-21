'use client';

export default function ScoreRing({ score, size = 60 }: { score: number; size?: number }) {
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const center = size / 2;

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
          stroke="url(#scoreGrad)"
          strokeWidth={size * 0.07}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7B6BA8" />
            <stop offset="100%" stopColor="#4A6CF7" />
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
