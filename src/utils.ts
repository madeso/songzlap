export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToName(note: number): string {
  const chroma = ((note % 12) + 12) % 12;
  return NOTE_NAMES[chroma] + (Math.floor(note / 12) - 1);
}

export function isBlackKey(note: number): boolean {
  return [1, 3, 6, 8, 10].includes(((note % 12) + 12) % 12);
}

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats / bpm) * 60;
}

export function formatBeatTime(beat: number): string {
  const bar = Math.floor(beat / 4) + 1;
  const b = Math.floor(beat % 4) + 1;
  return `${bar}.${b}`;
}
