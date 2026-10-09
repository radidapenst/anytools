import { SplitProgress, SplitResult } from './mp3Splitter';

export interface WAVInfo {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
  byteRate: number;
  blockAlign: number;
  dataOffset: number;
  dataSize: number;
  headerSize: number;
}

export function parseWAVHeader(buffer: Uint8Array): WAVInfo {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  
  // 1. Check RIFF header
  const riff = String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]);
  const wave = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]);
  
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('File bukan format WAV yang valid.');
  }
  
  let offset = 12;
  let numChannels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let byteRate = 0;
  let blockAlign = 0;
  let dataOffset = 0;
  let dataSize = 0;
  let fmtFound = false;
  let dataFound = false;

  while (offset < buffer.length - 8) {
    const chunkId = String.fromCharCode(
      buffer[offset],
      buffer[offset + 1],
      buffer[offset + 2],
      buffer[offset + 3]
    );
    const chunkSize = view.getUint32(offset + 4, true);
    
    if (chunkId === 'fmt ') {
      numChannels = view.getUint16(offset + 8 + 2, true);
      sampleRate = view.getUint32(offset + 8 + 4, true);
      byteRate = view.getUint32(offset + 8 + 8, true);
      blockAlign = view.getUint16(offset + 8 + 12, true);
      bitsPerSample = view.getUint16(offset + 8 + 14, true);
      fmtFound = true;
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      dataFound = true;
      break; // Usually 'data' chunk is what we need
    }
    
    offset += 8 + chunkSize;
  }
  
  if (!fmtFound || !dataFound) {
    throw new Error('Gagal membaca informasi header WAV (fmt atau data chunk tidak ditemukan).');
  }
  
  return {
    numChannels,
    sampleRate,
    bitsPerSample,
    byteRate,
    blockAlign,
    dataOffset,
    dataSize,
    headerSize: dataOffset,
  };
}

function writeWAVHeader(
  info: WAVInfo,
  newDataSize: number
): Uint8Array {
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);
  
  // RIFF identifier
  header[0] = 0x52; // 'R'
  header[1] = 0x49; // 'I'
  header[2] = 0x46; // 'F'
  header[3] = 0x46; // 'F'
  
  // File size - 8
  view.setUint32(4, 36 + newDataSize, true);
  
  // WAVE identifier
  header[8] = 0x57;  // 'W'
  header[9] = 0x41;  // 'A'
  header[10] = 0x56; // 'V'
  header[11] = 0x45; // 'E'
  
  // fmt chunk
  header[12] = 0x66; // 'f'
  header[13] = 0x6D; // 'm'
  header[14] = 0x74; // 't'
  header[15] = 0x20; // ' '
  view.setUint32(16, 16, true); // chunk size (16)
  view.setUint16(20, 1, true);  // PCM format (1)
  view.setUint16(22, info.numChannels, true);
  view.setUint32(24, info.sampleRate, true);
  view.setUint32(28, info.byteRate, true);
  view.setUint16(32, info.blockAlign, true);
  view.setUint16(34, info.bitsPerSample, true);
  
  // data chunk
  header[36] = 0x64; // 'd'
  header[37] = 0x61; // 'a'
  header[38] = 0x74; // 't'
  header[39] = 0x61; // 'a'
  view.setUint32(40, newDataSize, true);
  
  return header;
}

export function splitWAV(
  buffer: Uint8Array,
  partDurationSeconds: number,
  originalFilename: string,
  onProgress?: (progress: SplitProgress) => void
): SplitResult[] {
  if (onProgress) onProgress({ phase: 'parsing', percent: 20 });
  const info = parseWAVHeader(buffer);
  if (onProgress) onProgress({ phase: 'parsing', percent: 100 });
  
  if (onProgress) onProgress({ phase: 'splitting', percent: 0 });
  
  const results: SplitResult[] = [];
  const baseName = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
  
  // Calculate bytes per part, must align to blockAlign
  const bytesPerPartRaw = info.byteRate * partDurationSeconds;
  const bytesPerPart = Math.floor(bytesPerPartRaw / info.blockAlign) * info.blockAlign;
  
  if (bytesPerPart <= 0) {
    throw new Error('Durasi pemisahan terlalu pendek untuk format file ini.');
  }
  
  let currentOffset = info.dataOffset;
  const endOffset = info.dataOffset + info.dataSize;
  let partIndex = 1;
  
  while (currentOffset < endOffset) {
    const remainingBytes = endOffset - currentOffset;
    const currentPartSize = Math.min(bytesPerPart, remainingBytes);
    
    // Create header and body
    const headerBuffer = writeWAVHeader(info, currentPartSize);
    const partBuffer = new Uint8Array(headerBuffer.length + currentPartSize);
    
    partBuffer.set(headerBuffer, 0);
    partBuffer.set(buffer.subarray(currentOffset, currentOffset + currentPartSize), headerBuffer.length);
    
    const duration = currentPartSize / info.byteRate;
    
    results.push({
      filename: `${baseName}_part${partIndex}.wav`,
      blob: new Blob([partBuffer], { type: 'audio/wav' }),
      duration,
    });
    
    currentOffset += currentPartSize;
    partIndex++;
    
    if (onProgress) {
      const processed = currentOffset - info.dataOffset;
      onProgress({
        phase: 'splitting',
        percent: Math.round((processed / info.dataSize) * 100),
      });
    }
  }
  
  if (onProgress) onProgress({ phase: 'done', percent: 100 });
  return results;
}

export function trimWAV(
  buffer: Uint8Array,
  startSeconds: number,
  endSeconds: number,
  originalFilename: string,
  onProgress?: (progress: SplitProgress) => void
): SplitResult[] {
  if (onProgress) onProgress({ phase: 'parsing', percent: 20 });
  const info = parseWAVHeader(buffer);
  if (onProgress) onProgress({ phase: 'parsing', percent: 100 });

  if (onProgress) onProgress({ phase: 'splitting', percent: 0 });

  const totalAudioDuration = info.dataSize / info.byteRate;
  const validStart = Math.max(0, Math.min(startSeconds, totalAudioDuration));
  const validEnd = Math.max(validStart, Math.min(endSeconds, totalAudioDuration));

  const startByteOffset = info.dataOffset + Math.floor((validStart * info.byteRate) / info.blockAlign) * info.blockAlign;
  const endByteOffset = info.dataOffset + Math.floor((validEnd * info.byteRate) / info.blockAlign) * info.blockAlign;

  const dataSize = Math.max(0, endByteOffset - startByteOffset);
  if (dataSize <= 0) {
    throw new Error('Rentang durasi potongan tidak valid.');
  }

  const headerBuffer = writeWAVHeader(info, dataSize);
  const partBuffer = new Uint8Array(headerBuffer.length + dataSize);

  partBuffer.set(headerBuffer, 0);
  partBuffer.set(buffer.subarray(startByteOffset, endByteOffset), headerBuffer.length);

  const duration = dataSize / info.byteRate;
  const baseName = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;

  if (onProgress) onProgress({ phase: 'done', percent: 100 });

  return [
    {
      filename: `${baseName}_potong_custom.wav`,
      blob: new Blob([partBuffer], { type: 'audio/wav' }),
      duration,
    },
  ];
}

