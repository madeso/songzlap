/** Inline SVG waveform icons for the four oscillator types. */

const PATHS: Record<string, string> = {
  sine:     'M 0 5 C 2 5 4 1 6 1 C 8 1 10 5 12 5 C 14 5 16 9 18 9 C 20 9 22 5 24 5',
  square:   'M 0 2 L 11 2 L 11 8 L 23 8 L 23 2',
  sawtooth: 'M 0 8 L 12 2 L 12 8 L 24 2',
  triangle: 'M 0 8 L 6 2 L 12 8 L 18 2 L 24 8',
};

interface Props {
  type: string;
  size?: number;
  className?: string;
}

export default function WaveformIcon({ type, size = 24, className }: Props) {
  const path = PATHS[type] ?? PATHS['sine'];
  return (
    <svg
      viewBox="0 0 24 10"
      width={size}
      height={Math.round(size * 10 / 24)}
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
