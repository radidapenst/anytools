import { useState, useRef, useEffect } from 'react';
import { Upload, Scissors, Download, RefreshCw, Play, Pause, CheckCircle2, FastForward, Clock } from 'lucide-react';
import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg, getVideoMetadata, formatBytes, formatTime } from '../utils/ffmpegHelper';

export default function VideoTrimmer() {
  const [file, setFile] = useState<File | null>(null);
  const [videoMeta, setVideoMeta] = useState<{ duration: number; width: number; height: number } | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [preciseMode, setPreciseMode] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState('');

  // Results
  const [trimmedBlob, setTrimmedBlob] = useState<Blob | null>(null);
  const [trimmedUrl, setTrimmedUrl] = useState<string | null>(null);
  const [trimmedName, setTrimmedName] = useState<string>('');

  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (trimmedUrl) URL.revokeObjectURL(trimmedUrl);
    };
  }, [originalUrl, trimmedUrl]);

  const handleFileChange = async (selected: File) => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (trimmedUrl) URL.revokeObjectURL(trimmedUrl);

    setFile(selected);
    setTrimmedBlob(null);
    setTrimmedUrl(null);
    setProgress(0);
    setCurrentTime(0);

    const url = URL.createObjectURL(selected);
    setOriginalUrl(url);

    try {
      const meta = await getVideoMetadata(selected);
      setVideoMeta(meta);
      setStartTime(0);
      setEndTime(meta.duration);
    } catch {
      setVideoMeta(null);
      setStartTime(0);
      setEndTime(10);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      // Auto pause if previewing segment past endTime
      if (videoRef.current.currentTime >= endTime && isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const setStartFromCurrent = () => {
    if (videoRef.current) {
      const cur = Math.min(videoRef.current.currentTime, endTime - 0.5);
      setStartTime(Math.max(0, parseFloat(cur.toFixed(2))));
    }
  };

  const setEndFromCurrent = () => {
    if (videoRef.current) {
      const cur = Math.max(videoRef.current.currentTime, startTime + 0.5);
      const maxDur = videoMeta ? videoMeta.duration : cur;
      setEndTime(Math.min(maxDur, parseFloat(cur.toFixed(2))));
    }
  };

  const playSelectedSegment = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const startTrim = async () => {
    if (!file) return;

    if (endTime <= startTime) {
      alert('Waktu selesai harus lebih besar dari waktu mulai.');
      return;
    }

    setLoading(true);
    setProgress(0);
    setStatusMsg('Menyiapkan engine FFmpeg...');

    try {
      const ffmpeg = await getFFmpeg();
      setStatusMsg('Memuat video ke memori lokal...');

      const progressCallback = ({ progress: p }: { progress: number }) => {
        setProgress(Math.max(0, Math.min(100, Math.round(p * 100))));
      };
      ffmpeg.on('progress', progressCallback);

      const ext = file.name.substring(file.name.lastIndexOf('.')) || '.mp4';
      const inputName = `input_${Date.now()}${ext}`;
      const outputName = `trimmed_${Date.now()}${ext}`;

      await ffmpeg.writeFile(inputName, await fetchFile(file));

      setStatusMsg('Memotong durasi video...');

      const durationToCut = (endTime - startTime).toFixed(2);
      const args = ['-ss', startTime.toString(), '-i', inputName, '-t', durationToCut];

      if (preciseMode) {
        // Frame-accurate re-encode
        args.push('-c:v', 'libx264', '-crf', '22', '-preset', 'ultrafast', '-c:a', 'aac');
      } else {
        // Lossless stream copy (Super fast!)
        args.push('-c', 'copy');
      }

      args.push(outputName);

      await ffmpeg.exec(args);
      ffmpeg.off('progress', progressCallback);

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data as any], { type: file.type || 'video/mp4' });
      const url = URL.createObjectURL(blob);

      setTrimmedBlob(blob);
      setTrimmedUrl(url);

      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setTrimmedName(`trimmed_${baseName}${ext}`);

      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (err: any) {
      console.error(err);
      alert('Terjadi kesalahan saat memotong video: ' + (err?.message || 'Error tidak diketahui'));
      setStatusMsg('Gagal memotong video.');
    } finally {
      setLoading(false);
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
            <p className="font-bold text-white">Klik atau seret video yang ingin dipotong</p>
            <p className="text-xs text-slate-400">Potong klip video dengan cepat tanpa mengurangi kualitas</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="bg-teal-500/20 text-teal-400 p-2.5 rounded-lg">
                <Scissors className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white truncate max-w-xs sm:max-w-md">{file.name}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span>Ukuran: <strong className="text-slate-200">{formatBytes(file.size)}</strong></span>
                  {videoMeta && (
                    <>
                      <span>•</span>
                      <span>Total Durasi: <strong className="text-slate-200">{formatTime(videoMeta.duration)}</strong></span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setTrimmedBlob(null);
              }}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            >
              Ganti File
            </button>
          </div>

          {/* Interactive Player with Timestamp Seek */}
          {originalUrl && (
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden bg-black/80 border border-slate-800 flex flex-col items-center">
                <video
                  ref={videoRef}
                  src={originalUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="max-h-72 w-auto max-w-full rounded-t-lg"
                />
                
                {/* Custom Video Controls Bar */}
                <div className="w-full bg-slate-900/90 border-t border-slate-800 px-4 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlay}
                      className="p-2 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg transition"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={playSelectedSegment}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
                      title="Putar dari awal potongan"
                    >
                      <FastForward className="w-3.5 h-3.5 text-teal-400" />
                      <span>Putar Potongan</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-teal-400" />
                    <span>{formatTime(currentTime)}</span>
                    <span className="text-slate-600">/</span>
                    <span>{videoMeta ? formatTime(videoMeta.duration) : '--:--'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cut Settings & Timeline Control */}
          <div className="bg-slate-900/40 p-5 border border-slate-700/60 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400">Rentang Waktu Potongan</span>
              <span className="text-xs font-semibold text-slate-300">
                Durasi Hasil:{' '}
                <strong className="text-teal-400 font-bold">
                  {formatTime(Math.max(0, endTime - startTime))}
                </strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Start Time Box */}
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Waktu Mulai (Start)</label>
                  <button
                    onClick={setStartFromCurrent}
                    className="text-[11px] font-bold text-teal-400 hover:text-teal-300 px-2.5 py-1 bg-teal-500/10 border border-teal-500/30 rounded-md transition"
                  >
                    Gunakan Posisi Player Ini
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max={videoMeta?.duration || 1000}
                    step="0.1"
                    value={startTime}
                    onChange={(e) => setStartTime(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                  />
                  <span className="text-xs text-slate-400 font-mono min-w-[50px]">{formatTime(startTime)}</span>
                </div>
              </div>

              {/* End Time Box */}
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Waktu Selesai (End)</label>
                  <button
                    onClick={setEndFromCurrent}
                    className="text-[11px] font-bold text-teal-400 hover:text-teal-300 px-2.5 py-1 bg-teal-500/10 border border-teal-500/30 rounded-md transition"
                  >
                    Gunakan Posisi Player Ini
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max={videoMeta?.duration || 1000}
                    step="0.1"
                    value={endTime}
                    onChange={(e) => setEndTime(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-teal-500"
                  />
                  <span className="text-xs text-slate-400 font-mono min-w-[50px]">{formatTime(endTime)}</span>
                </div>
              </div>
            </div>

            {/* Mode selection */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={preciseMode}
                  onChange={(e) => setPreciseMode(e.target.checked)}
                  className="rounded border-slate-700 text-teal-500 focus:ring-teal-500/30 bg-slate-800"
                />
                <span>Mode Presisi Bingkai Penuh (Re-encode halus)</span>
              </label>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                {preciseMode ? 'Memastikan frame persis tepat' : 'Mode Cepat (Instan tanpa kehilangan kualitas)'}
              </span>
            </div>
          </div>

          {/* Trigger Button */}
          {!loading && !trimmedBlob && (
            <button
              onClick={startTrim}
              className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 flex items-center justify-center gap-2"
            >
              <Scissors className="w-4 h-4" />
              Potong Video Sekarang
            </button>
          )}

          {/* Processing State */}
          {loading && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 text-center">
              <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="font-bold text-sm text-white">Memotong Video...</p>
                <p className="text-xs text-slate-400">{statusMsg}</p>
                {preciseMode && <p className="text-xs text-teal-400 font-semibold">{progress}%</p>}
              </div>
            </div>
          )}

          {/* Trimmed Result Output */}
          {trimmedBlob && trimmedUrl && !loading && (
            <div className="bg-slate-900/90 border border-teal-500/40 p-5 rounded-xl space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-teal-400 text-sm font-bold">
                <CheckCircle2 className="w-5 h-5" />
                <span>Video Berhasil Dipotong!</span>
              </div>

              <div className="rounded-xl overflow-hidden bg-black/80 border border-slate-800 flex justify-center max-h-80">
                <video src={trimmedUrl} controls className="max-h-80 w-auto max-w-full rounded-lg" />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-800">
                <div>
                  <p className="font-bold text-white text-sm truncate max-w-xs sm:max-w-md">{trimmedName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Ukuran file baru: {formatBytes(trimmedBlob.size)}</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setTrimmedBlob(null);
                      setTrimmedUrl(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 rounded-lg transition"
                  >
                    Potong Lagi
                  </button>
                  <button
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = trimmedUrl;
                      a.download = trimmedName;
                      a.click();
                    }}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-lg transition shadow-lg shadow-teal-500/20"
                  >
                    <Download className="w-4 h-4" />
                    Unduh Potongan Video
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
