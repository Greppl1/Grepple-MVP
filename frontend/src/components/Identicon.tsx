'use client';

/**
 * Deterministic avatar from a hex string (wallet address).
 * Generates a symmetric 5x5 pixel grid.
 */
export default function Identicon({ address, size = 56 }: { address: string; size?: number }) {
  const hash = address.toLowerCase().replace('0x', '');
  const hue = parseInt(hash.slice(0, 2), 16) * 1.41;
  const sat = 50 + (parseInt(hash.slice(2, 4), 16) % 30);
  const fg = `hsl(${hue}, ${sat}%, 65%)`;
  const bg = `hsl(${hue}, ${sat}%, 20%)`;

  // Generate 15 bits for a 5x5 symmetric grid (only need left half + center column)
  const bits: boolean[] = [];
  for (let i = 0; i < 15; i++) {
    const hexChar = hash[4 + i] || '0';
    bits.push(parseInt(hexChar, 16) % 2 === 0);
  }

  // Build 5x5 grid with horizontal symmetry
  const grid: boolean[][] = [];
  let bitIdx = 0;
  for (let row = 0; row < 5; row++) {
    const r: boolean[] = [];
    for (let col = 0; col < 5; col++) {
      const mirrorCol = col > 2 ? 4 - col : col;
      const idx = row * 3 + mirrorCol;
      r.push(bits[idx] ?? false);
    }
    grid.push(r);
  }

  const cellSize = size / 5;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rounded-full"
      style={{ background: bg }}
    >
      {grid.map((row, ri) =>
        row.map((filled, ci) =>
          filled ? (
            <rect
              key={`${ri}-${ci}`}
              x={ci * cellSize}
              y={ri * cellSize}
              width={cellSize}
              height={cellSize}
              fill={fg}
            />
          ) : null
        )
      )}
    </svg>
  );
}
