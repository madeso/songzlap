// Song Zlap logo — "SZ" in a circle
// S = lightning bolt (angular zigzag, violet glow)
// Z = heavy metal (thick bold stroke + serifs)
export default function Logo({ size = 32 }: { size?: number }) {
  // All coordinates verified inside circle r=18 at cx=20,cy=20
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Song Zlap">
      <defs>
        <filter id="sz-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Circle */}
      <circle cx="20" cy="20" r="18" fill="#09090b" stroke="#7c3aed" strokeWidth="1.5" />

      {/* ── S as lightning bolt ──────────────────────────────────────
          Two zig-zag bends: top bar (left), diagonal (right), middle bar (left), diagonal (right)
          Coordinates: x range 8–14, y range 9–31 (all inside circle) */}
      <polyline
        points="14,9 8,9 14,20 8,20 14,31"
        stroke="#c4b5fd"
        strokeWidth="3.8"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
        filter="url(#sz-glow)"
      />

      {/* ── Z heavy metal ────────────────────────────────────────────
          Simple 4-point polyline — unmistakably a Z.
          x range 22–32, y range 9–31 (all inside circle) */}

      {/* Dark outer halo for depth */}
      <polyline
        points="22,9 32,9 22,31 32,31"
        stroke="#4c1d95"
        strokeWidth="7"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
      {/* Main Z stroke — near-white, chunky */}
      <polyline
        points="22,9 32,9 22,31 32,31"
        stroke="#f4f4f5"
        strokeWidth="4.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
      {/* Heavy-metal serifs — vertical bars at all four bar ends */}
      <line x1="22" y1="7"  x2="22" y2="12" stroke="#f4f4f5" strokeWidth="2.5" strokeLinecap="square" />
      <line x1="32" y1="7"  x2="32" y2="12" stroke="#f4f4f5" strokeWidth="2.5" strokeLinecap="square" />
      <line x1="22" y1="28" x2="22" y2="33" stroke="#f4f4f5" strokeWidth="2.5" strokeLinecap="square" />
      <line x1="32" y1="28" x2="32" y2="33" stroke="#f4f4f5" strokeWidth="2.5" strokeLinecap="square" />
    </svg>
  );
}
