/** Inline SVG waveform icons for the four oscillator types. */

// All paths use a 16×16 viewBox; midline at y=8, peaks at y=2/y=14
const PATHS: Record<string, string> = {
  sine:     'M 0 8 C 2 2 6 2 8 8 C 10 14 14 14 16 8',
  square:   'M 0 3 L 7 3 L 7 13 L 15 13 L 15 3',
  sawtooth: 'M 0 14 L 8 2 L 8 14 L 16 2',
  triangle: 'M 0 8 L 4 2 L 12 14 L 16 8',
};

interface Props {
  type: string;
  size?: number;
  className?: string;
}

export default function WaveformIcon({ type, size = 16, className }: Props) {
  const path = PATHS[type] ?? PATHS['sine'];
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
