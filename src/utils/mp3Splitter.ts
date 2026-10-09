export interface SplitProgress {
  phase: 'parsing' | 'splitting' | 'done';
  percent: number;
}

export interface MP3Frame {
  offset: number;
  size: number;
  duration: number; // in seconds
}

export function parseID3v2Header(buffer: Uint8Array): { size: number } | null {
  if (buffer.length >= 10 &&
      buffer[0] === 0x49 && // 'I'
      buffer[1] === 0x44 && // 'D'
      buffer[2] === 0x33) { // '3'
    // ID3v2 header found
    const flags = buffer[5];
    const footerPresent = (flags & 0x10) !== 0;
    
    // Synchsafe integer size (4 bytes, 7 bits each)
    const s0 = buffer[6];
    const s1 = buffer[7];
    const s2 = buffer[8];
    const s3 = buffer[9];
    
    if ((s0 & 0x80) === 0 && (s1 & 0x80) === 0 && (s2 & 0x80) === 0 && (s3 & 0x80) === 0) {
      const size = (s0 << 21) | (s1 << 14) | (s2 << 7) | s3;
      // Total tag size is header (10) + size + footer (10 if present)
      const totalSize = 10 + size + (footerPresent ? 10 : 0);
      return { size: totalSize };
    }
  }
  return null;
}

export function parseMP3Frames(
  buffer: Uint8Array,
  onProgress?: (progress: number) => void
): { frames: MP3Frame[]; id3Header: Uint8Array | null } {
  const frames: MP3Frame[] = [];
  let offset = 0;
  
  // Check for ID3v2 tag
  const id3 = parseID3v2Header(buffer);
  let id3Header: Uint8Array | null = null;
  if (id3 && id3.size <= buffer.length) {
    id3Header = buffer.slice(0, id3.size);
    offset = id3.size;
  }
  
  const bitratesV1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1];
  const bitratesV2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1];
  
  const sampleRatesV1 = [44100, 48000, 32000, -1];
  const sampleRatesV2 = [22050, 24000, 16000, -1];
  const sampleRatesV25 = [11025, 12000, 8000, -1];

  const totalLength = buffer.length;
  
  while (offset < totalLength - 4) {
    // Report progress periodically
    if (offset % 500000 === 0 && onProgress) {
      onProgress(Math.min(99, Math.round((offset / totalLength) * 100)));
    }

    // Syncword check: first byte is 0xFF, next 3 bits are 111 (0xE0)
    const b0 = buffer[offset];
    const b1 = buffer[offset + 1];
    
    if (b0 === 0xFF && (b1 & 0xE0) === 0xE0) {
      const versionIdx = (b1 & 0x18) >> 3;
      const layerIdx = (b1 & 0x06) >> 1;
      
      // We focus on Layer III (index 1) for MP3 files
      if (layerIdx === 1 && versionIdx !== 1) { // 1 = reserved
        const b2 = buffer[offset + 2];
        const bitrateIdx = (b2 & 0xF0) >> 4;
        const samplerateIdx = (b2 & 0x0C) >> 2;
        const padding = (b2 & 0x02) >> 1;
        
        let version: 'V1' | 'V2' | 'V2.5';
        let sampleRates: number[];
        let bitrates: number[];
        let samplesPerFrame: number;
        
        if (versionIdx === 3) {
          version = 'V1';
          sampleRates = sampleRatesV1;
          bitrates = bitratesV1L3;
          samplesPerFrame = 1152;
        } else {
          version = versionIdx === 2 ? 'V2' : 'V2.5';
          sampleRates = version === 'V2' ? sampleRatesV2 : sampleRatesV25;
          bitrates = bitratesV2L3;
          samplesPerFrame = 576;
        }
        
        const sampleRate = sampleRates[samplerateIdx];
        const bitrate = bitrates[bitrateIdx];
        
        if (sampleRate > 0 && bitrate > 0) {
          // Frame size calculation
          const frameSize = Math.floor((samplesPerFrame / 8 * (bitrate * 1000)) / sampleRate) + padding;
          
          if (frameSize > 0 && offset + frameSize <= totalLength) {
            const duration = samplesPerFrame / sampleRate;
            frames.push({
              offset,
              size: frameSize,
              duration,
            });
            offset += frameSize;
            continue;
          }
        }
      }
    }
    offset++;
  }
  
  if (onProgress) onProgress(100);
  return { frames, id3Header };
}

export interface SplitResult {
  filename: string;
  blob: Blob;
  duration: number;
}

export function splitMP3(
  buffer: Uint8Array,
  partDurationSeconds: number,
  originalFilename: string,
  onProgress?: (progress: SplitProgress) => void
): SplitResult[] {
  // Phase 1: Parse
  if (onProgress) onProgress({ phase: 'parsing', percent: 0 });
  const { frames, id3Header } = parseMP3Frames(buffer, (p) => {
    if (onProgress) onProgress({ phase: 'parsing', percent: p });
  });
  
  if (frames.length === 0) {
    throw new Error('Tidak dapat menemukan frame MP3 yang valid. Pastikan file berformat MP3.');
  }
  
  if (onProgress) onProgress({ phase: 'splitting', percent: 0 });
  
  const results: SplitResult[] = [];
  const baseName = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
  
  let partIndex = 1;
  let currentPartFrames: MP3Frame[] = [];
  let currentPartDuration = 0;
  
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    currentPartFrames.push(frame);
    currentPartDuration += frame.duration;
    
    // Check if the current chunk exceeds target duration OR this is the last frame
    if (currentPartDuration >= partDurationSeconds || i === frames.length - 1) {
      // Create part file
      let totalSize = currentPartFrames.reduce((sum, f) => sum + f.size, 0);
      if (id3Header) {
        totalSize += id3Header.length;
      }
      
      const partBuffer = new Uint8Array(totalSize);
      let targetOffset = 0;
      
      // Keep ID3 header if present
      if (id3Header) {
        partBuffer.set(id3Header, 0);
        targetOffset += id3Header.length;
      }
      
      for (const f of currentPartFrames) {
        const frameData = buffer.subarray(f.offset, f.offset + f.size);
        partBuffer.set(frameData, targetOffset);
        targetOffset += f.size;
      }
      
      results.push({
        filename: `${baseName}_part${partIndex}.mp3`,
        blob: new Blob([partBuffer], { type: 'audio/mpeg' }),
        duration: currentPartDuration,
      });
      
      // Reset for next part
      partIndex++;
      currentPartFrames = [];
      currentPartDuration = 0;
      
      if (onProgress) {
        onProgress({
          phase: 'splitting',
          percent: Math.round((i / frames.length) * 100),
        });
      }
    }
  }
  
  if (onProgress) onProgress({ phase: 'done', percent: 100 });
  return results;
}
