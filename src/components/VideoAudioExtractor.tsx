import { useState, useRef, useEffect } from 'react';
import { Upload, Music, Download, RefreshCw, CheckCircle2, Play, Pause, Disc } from 'lucide-react';
import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg, getVideoMetadata, formatBytes, formatTime } from '../utils/ffmpegHelper';

export default function VideoAudioExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [videoMeta, setVideoMeta] = useState<{ duration: number; width: number; height: number } | null>(null);

  // Settings
  const [format, setFormat] = useState<'mp3' | 'm4a' | 'wav'>('mp3');
  const [bitrate, setBitrate] = useState<string>('192k');

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState('');

  // Results
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (audioRef.current) audioRef.current.pause();
    };
  }, [audioUrl]);

  const handleFileChange = async (selected: File) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (audioRef.current) audioRef.current.pause();

    setFile(selected);
    setAudioBlob(null);
    setAudioUrl(null);
    setProgress(0);
    setIsPlaying(false);

    try {
      const meta = await getVideoMetadata(selected);
      setVideoMeta(meta);
    } catch {
      setVideoMeta(null);
    }
  };

  const extractAudio = async () => {
    if (!file) return;

    setLoading(true);
    setProgress(0);
    setStatusMsg('Menyiapkan FFmpeg...');

    try {
      const ffmpeg = await getFFmpeg();
      setStatusMsg('Mengekstrak track suara dari video...');

      const progressCallback = ({ progress: p }: { progress: number }) => {
        setProgress(Math.max(0, Math.min(100, Math.round(p * 100))));
      };
      ffmpeg.on('progress', progressCallback);

      const ext = file.name.substring(file.name.lastIndexOf('.')) || '.mp4';
      const inputName = `input_${Date.now()}${ext}`;
      const outputName = `audio_${Date.now()}.${format}`;

      await ffmpeg.writeFile(inputName, await fetchFile(file));

      const args = ['-i', inputName, '-vn'];

      if (format === 'mp3') {
        args.push('-c:a', 'libmp3lame', '-b:a', bitrate);
      } else if (format === 'm4a') {
        args.push('-c:a', 'aac', '-b:a', bitrate);
      } else if (format === 'wav') {
        args.push('-c:a', 'pcm_s16le');
      }

      args.push(outputName);

      await ffmpeg.exec(args);
      ffmpeg.off('progress', progressCallback);

      const data = await ffmpeg.readFile(outputName);
      const mimeTypes: Record<string, string> = {
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        wav: 'audio/wav',
      };

      const blob = new Blob([data as any], { type: mimeTypes[format] || 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      setAudioBlob(blob);
      setAudioUrl(url);

      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setAudioName(`${baseName}.${format}`);

      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (err: any) {
      console.error(err);
      alert('Terjadi kesalahan saat mengekstrak audio: ' + (err?.message || 'Error tidak diketahui'));
      setStatusMsg('Gagal mengekstrak audio.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAudioPlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-6 max-w-4xl mx-auto space-y-6">
      {!file ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = e.dataTransfer.files?.[0];
            if (dropped && dropped.type.startsWith('video/')) handleFileChange(dropped);
          }}
          className="border-2 border-dashed border-slate-700 hover:border-teal-500/50 bg-slate-900/40 transition duration-150 rounded-xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer relative"
        >
          <input
            type="file"
            accept="video/*"
            onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <div className="bg-teal-500/10 text-teal-400 p-4 rounded-full">
            <Upload className="w-8 h-8" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-bold text-white">Klik atau seret video untuk mengekstrak suaranya</p>
            <p className="text-xs text-slate-400">Ekstrak lagu, audio ceramah, atau efek suara ke format MP3 / M4A / WAV</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="bg-teal-500/20 text-teal-400 p-2.5 rounded-lg">
                <Disc className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white truncate max-w-xs sm:max-w-md">{file.name}</p>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span>Ukuran Video: <strong className="text-slate-200">{formatBytes(file.size)}</strong></span>
                  {videoMeta && (
                    <>
                      <span>•</span>
                      <span>Durasi: <strong className="text-slate-200">{formatTime(videoMeta.duration)}</strong></span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setAudioBlob(null);
              }}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            >
              Ganti File
            </button>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/40 p-5 border border-slate-700/60 rounded-xl">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-teal-400" />
                Format Audio Target
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="mp3">MP3 (Format Paling Populer & Universal)</option>
                <option value="m4a">M4A (AAC Audio - Jernih & Efisien)</option>
                <option value="wav">WAV (PCM - Kualitas Asli Lossless)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-teal-400" />
                Kualitas Audio (Bitrate)
              </label>
              <select
                value={bitrate}
                onChange={(e) => setBitrate(e.target.value)}
                disabled={format === 'wav'}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500 disabled:opacity-50"
              >
                <option value="320k">320 kbps (Sangat Jernih - Kualitas Studio)</option>
                <option value="256k">256 kbps (Tinggi)</option>
                <option value="192k">192 kbps (Standar Musik Bagus)</option>
                <option value="128k">128 kbps (Hemat Ukuran - Standar Web)</option>
              </select>
            </div>
          </div>

          {/* Action */}
          {!loading && !audioBlob && (
            <button
              onClick={extractAudio}
              className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 flex items-center justify-center gap-2"
            >
              <Music className="w-4 h-4" />
              Ekstrak Audio Sekarang
            </button>
          )}

          {/* Loading */}
          {loading && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 text-center">
              <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="font-bold text-sm text-white">Mengekstrak Track Audio...</p>
                <p className="text-xs text-slate-400">{statusMsg}</p>
                <p className="text-xs text-teal-400 font-semibold">{progress}%</p>
              </div>
            </div>
          )}

          {/* Audio Result */}
          {audioBlob && audioUrl && !loading && (
            <div className="bg-slate-900/90 border border-teal-500/40 p-5 rounded-xl space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-teal-400 text-sm font-bold">
                <CheckCircle2 className="w-5 h-5" />
                <span>Audio Berhasil Diekstrak!</span>
              </div>

              {/* Audio Player */}
              <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />

                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleAudioPlay}
                    className="p-3 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl transition shadow-md"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>
                  <div>
                    <p className="font-bold text-white text-sm truncate max-w-xs sm:max-w-md">{audioName}</p>
                    <p className="text-xs text-slate-400">Ukuran file audio: {formatBytes(audioBlob.size)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setAudioBlob(null);
                      setAudioUrl(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 rounded-lg transition"
                  >
                    Ekstrak Lagi
                  </button>
                  <button
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = audioUrl;
                      a.download = audioName;
                      a.click();
                    }}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-lg transition shadow-lg shadow-teal-500/20"
                  >
                    <Download className="w-4 h-4" />
                    Unduh File Audio
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
