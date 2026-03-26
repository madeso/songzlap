/** Encode a Web Audio AudioBuffer to a WAV Blob (PCM 16-bit stereo). */
export function encodeWAV(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(buffer.numberOfChannels, 2);
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const dataSize = numFrames * numChannels * bytesPerSample;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  function writeStr(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  function writeU32(offset: number, val: number) { view.setUint32(offset, val, true); }
  function writeU16(offset: number, val: number) { view.setUint16(offset, val, true); }

  // RIFF header
  writeStr(0, 'RIFF');
  writeU32(4, 36 + dataSize);
  writeStr(8, 'WAVE');
  // fmt chunk
  writeStr(12, 'fmt ');
  writeU32(16, 16);              // chunk size
  writeU16(20, 1);               // PCM
  writeU16(22, numChannels);
  writeU32(24, sampleRate);
  writeU32(28, sampleRate * numChannels * bytesPerSample); // byte rate
  writeU16(32, numChannels * bytesPerSample);              // block align
  writeU16(34, 16);              // bits per sample
  // data chunk
  writeStr(36, 'data');
  writeU32(40, dataSize);

  // Interleave channels and clamp to int16
  const channels = Array.from({ length: numChannels }, (_, ch) => buffer.getChannelData(ch));
  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
