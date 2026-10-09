import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileAudio, Settings, Play, Pause, Download, RefreshCw, ShieldAlert, Sparkles, Sliders } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export default function AudioCompressor() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegLoadingMsg, setFfmpegLoadingMsg] = useState('');
  const [progress, setProgress] = useState<number>(0);
  
  // Compressor settings
  const [targetFormat, setTargetFormat] = useState<string>('mp3');
  const [sampleRate, setSampleRate] = useState<string>('44100');
  const [bitrate, setBitrate] = useState<string>('128k');
  
  // Results
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressedName, setCompressedName] = useState<string>('');
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  
  // Preview
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const loadFFmpeg = async () => {
    if (ffmpegLoaded) return;
    setLoading(true);
    setFfmpegLoadingMsg('Memuat modul FFmpeg lokal (sekitar 30MB)...');
    
    try {
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;

      ffmpeg.on('log', ({ message }) => {
        // Simple progress parser from ffmpeg logs
        // Look for time=00:00:00.00 in ffmpeg logs
        const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (timeMatch && file) {
          // Estimate duration and calculate progress percentage
          // For simplicity, we can also extract total duration if we decoded it, but let's just log
        }
      });

      ffmpeg.on('progress', ({ progress: p }) => {
        setProgress(Math.round(p * 100));
      });

      const baseURL = window.location.origin;
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      setFfmpegLoaded(true);
      setFfmpegLoadingMsg('');
    } catch (err: any) {
      console.error(err);
      alert('Gagal memuat modul FFmpeg. Pastikan browser Anda mendukung WebAssembly dan Anda memiliki koneksi internet untuk muatan pertama.');
      setFfmpegLoadingMsg('Gagal memuat modul FFmpeg.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      // Reset previous results
      setCompressedBlob(null);
      setCompressedSize(null);
      setProgress(0);
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setCompressedBlob(null);
      setCompressedSize(null);
      setProgress(0);
    }
  };

  const startCompression = async () => {
    if (!file) return;

    if (!ffmpegLoaded) {
      await loadFFmpeg();
    }

    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg) return;

    setLoading(true);
    setProgress(0);
    setFfmpegLoadingMsg('');

    try {
      const inputName = 'input_' + file.name;
      const outputName = `output_${file.name.substring(0, file.name.lastIndexOf('.')) || file.name}.${targetFormat}`;

      // Write input file to FFmpeg WASM filesystem
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      // Build FFmpeg command arguments
      // e.g. ffmpeg -i input.mp3 -b:a 128k -ar 44100 output.mp3
      const args = ['-i', inputName];

      // Codecs mapping
      if (targetFormat === 'mp3') {
        args.push('-c:a', 'libmp3lame');
      } else if (targetFormat === 'm4a') {
        args.push('-c:a', 'aac');
      } else if (targetFormat === 'wav') {
        args.push('-c:a', 'pcm_s16le');
      } else if (targetFormat === 'ogg') {
        args.push('-c:a', 'libvorbis');
      } else if (targetFormat === 'wma') {
        args.push('-c:a', 'wmav2');
      }

      // Sample Rate
      if (sampleRate !== 'original') {
        args.push('-ar', sampleRate);
      }

      // Bitrate (WAV does not use bitrate compression in this standard command)
      if (targetFormat !== 'wav' && bitrate !== 'original') {
        args.push('-b:a', bitrate);
      }

      args.push(outputName);

      // Execute FFmpeg
      await ffmpeg.exec(args);

      // Read output file
      const data = await ffmpeg.readFile(outputName);
      const mimeTypes: { [key: string]: string } = {
        mp3: 'audio/mp3',
        m4a: 'audio/m4a',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        wma: 'audio/x-ms-wma',
      };
      const blob = new Blob([data as any], { type: mimeTypes[targetFormat] || 'audio/octet-stream' });

      setCompressedBlob(blob);
      setCompressedName(outputName.replace(/^output_/, 'compressed_'));
      setCompressedSize(blob.size);

      // Cleanup files in WASM filesystem to free memory
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

    } catch (err: any) {
      console.error(err);
      alert('Terjadi kesalahan saat memproses kompresi audio: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPreview = () => {
    if (!compressedBlob) return;

    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const url = URL.createObjectURL(compressedBlob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
      setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };
    }
  };

  const downloadResult = () => {
    if (!compressedBlob || !compressedName) return;
    const url = URL.createObjectURL(compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = compressedName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-6 max-w-4xl mx-auto space-y-6">
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="border-2 border-dashed border-slate-700 hover:border-teal-500/50 bg-slate-900/40 transition duration-150 rounded-xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer relative"
        >
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <div className="bg-teal-500/10 text-teal-400 p-4 rounded-full">
            <Upload className="w-8 h-8" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-bold text-white">Klik atau seret file audio Anda ke sini</p>
            <p className="text-xs text-slate-400">Mendukung format MP3, WAV, M4A, AAC, FLAC, OGG, dll.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* File Info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="bg-teal-500/20 text-teal-400 p-2.5 rounded-lg">
                <FileAudio className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white truncate max-w-xs sm:max-w-md">{file.name}</p>
                <p className="text-xs text-slate-400">Ukuran Asli: {formatBytes(file.size)}</p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            >
              Ganti File
            </button>
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-900/30 p-5 border border-slate-700/50 rounded-xl">
            {/* Format Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                Format Target
              </label>
              <select
                value={targetFormat}
                onChange={(e) => setTargetFormat(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="mp3">MP3 (MPEG Layer 3)</option>
                <option value="m4a">M4A (AAC Audio)</option>
                <option value="wav">WAV (PCM Audio)</option>
                <option value="ogg">OGG (Vorbis Audio)</option>
                <option value="wma">WMA (Windows Media)</option>
              </select>
            </div>

            {/* Bitrate Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-teal-400" />
                Bitrate (Ukuran/Kualitas)
              </label>
              <select
                value={bitrate}
                onChange={(e) => setBitrate(e.target.value)}
                disabled={targetFormat === 'wav'}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500 disabled:opacity-50"
              >
                <option value="original">Original (Sama dengan input)</option>
                <option value="320k">320 kbps (Kualitas Sangat Tinggi - File Besar)</option>
                <option value="256k">256 kbps (Kualitas Tinggi)</option>
                <option value="192k">192 kbps (Medium-Tinggi)</option>
                <option value="128k">128 kbps (Standar Kompresi - Direkomendasikan)</option>
                <option value="96k">96 kbps (Medium-Rendah - File Lebih Hemat)</option>
                <option value="64k">64 kbps (Rendah - Sangat Hemat)</option>
                <option value="32k">32 kbps (Sangat Rendah - Khusus Voice Note/Rapat)</option>
              </select>
              {targetFormat === 'wav' && (
                <p className="text-[10px] text-teal-400 font-medium">WAV menggunakan format lossless PCM (Bitrate tidak berlaku).</p>
              )}
            </div>

            {/* Sample Rate */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-teal-400" />
                Sample Rate (Frekuensi)
              </label>
              <select
                value={sampleRate}
                onChange={(e) => setSampleRate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="original">Original (Sama dengan input)</option>
                <option value="48000">48000 Hz (Kualitas Studio)</option>
                <option value="44100">44100 Hz (Standar CD)</option>
                <option value="32000">32000 Hz (Medium)</option>
                <option value="22050">22050 Hz (Rendah - FM/Voice)</option>
                <option value="8000">8000 Hz (Sangat Rendah - Telepon)</option>
              </select>
            </div>
          </div>

          {/* Warning / Privacy Note */}
          <div className="flex gap-2 p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg text-xs text-teal-300">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              Proses kompresi ini dilakukan <strong>100% lokal</strong> di dalam browser Anda menggunakan teknologi WebAssembly (FFmpeg.wasm). Tidak ada bit dari audio Anda yang dikirim ke server mana pun. Sangat aman untuk data sensitif.
            </p>
          </div>

          {/* Action Trigger */}
          <div className="flex flex-col gap-4">
            {!loading && !compressedBlob && (
              <button
                onClick={startCompression}
                className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 flex items-center justify-center gap-2"
              >
                Mulailah Kompres & Konversi
              </button>
            )}

            {loading && (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 text-center">
                <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
                <div className="space-y-1">
                  <p className="font-bold text-sm text-white">Sedang Memproses Audio...</p>
                  {ffmpegLoadingMsg ? (
                    <p className="text-xs text-slate-400 animate-pulse">{ffmpegLoadingMsg}</p>
                  ) : (
                    <p className="text-xs text-slate-400">Kemajuan encoding: {progress}%</p>
                  )}
                </div>
                {!ffmpegLoadingMsg && (
                  <div className="w-full bg-slate-800 rounded-full h-2 max-w-md mx-auto overflow-hidden">
                    <div
                      className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Results Display */}
            {compressedBlob && !loading && (
              <div className="bg-slate-900/90 border border-slate-700/80 p-5 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-teal-400 uppercase tracking-wider">Hasil Kompresi</p>
                    <p className="font-bold text-white text-sm truncate max-w-xs sm:max-w-md">{compressedName}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">{formatBytes(file.size)}</span>
                      <span className="text-slate-500">→</span>
                      <span className="text-teal-400 font-bold">{formatBytes(compressedSize || 0)}</span>
                      {compressedSize && (
                        <span className="bg-teal-500/10 text-teal-300 px-2 py-0.5 rounded-full font-semibold">
                          {Math.round(((file.size - compressedSize) / file.size) * 100)}% Lebih Kecil
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handlePlayPreview}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 rounded-lg transition"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-4 h-4 text-teal-400" />
                          Pause Preview
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 text-teal-400" />
                          Play Preview
                        </>
                      )}
                    </button>
                    <button
                      onClick={downloadResult}
                      className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-lg transition"
                    >
                      <Download className="w-4 h-4" />
                      Unduh File
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
