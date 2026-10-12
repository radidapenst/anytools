import { useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, Download, RefreshCw, CheckCircle2, Sliders, Clock, Sparkles } from 'lucide-react';
import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg, getVideoMetadata, formatBytes, formatTime } from '../utils/ffmpegHelper';

export default function VideoToGif() {
  const [file, setFile] = useState<File | null>(null);
  const [videoMeta, setVideoMeta] = useState<{ duration: number; width: number; height: number } | null>(null);

  // Settings
  const [startTime, setStartTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(5);
  const [width, setWidth] = useState<string>('480');
  const [fps, setFps] = useState<string>('12');

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState('');

  // Results
  const [gifBlob, setGifBlob] = useState<Blob | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [gifName, setGifName] = useState<string>('');

  const [originalUrl, setOriginalUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (gifUrl) URL.revokeObjectURL(gifUrl);
    };
  }, [originalUrl, gifUrl]);

  const handleFileChange = async (selected: File) => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (gifUrl) URL.revokeObjectURL(gifUrl);

    setFile(selected);
    setGifBlob(null);
    setGifUrl(null);
    setProgress(0);

    const url = URL.createObjectURL(selected);
    setOriginalUrl(url);

    try {
      const meta = await getVideoMetadata(selected);
      setVideoMeta(meta);
      setStartTime(0);
      setDuration(Math.min(6, Math.max(1, meta.duration)));
    } catch {
      setVideoMeta(null);
      setStartTime(0);
      setDuration(5);
    }
  };

  const convertToGif = async () => {
    if (!file) return;

    setLoading(true);
    setProgress(0);
    setStatusMsg('Menyiapkan engine FFmpeg...');

    try {
      const ffmpeg = await getFFmpeg();
      setStatusMsg('Memuat video...');

      const progressCallback = ({ progress: p }: { progress: number }) => {
        setProgress(Math.max(0, Math.min(100, Math.round(p * 100))));
      };
      ffmpeg.on('progress', progressCallback);

      const ext = file.name.substring(file.name.lastIndexOf('.')) || '.mp4';
      const inputName = `input_${Date.now()}${ext}`;
      const outputName = `output_${Date.now()}.gif`;

      await ffmpeg.writeFile(inputName, await fetchFile(file));

      setStatusMsg('Merender animasi GIF (High Quality Palette)...');

      // Use palettegen & paletteuse filter for crisp, banding-free GIFs!
      const filterComplex = `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer`;

      const args = [
        '-ss', startTime.toString(),
        '-t', duration.toString(),
        '-i', inputName,
        '-filter_complex', filterComplex,
        outputName
      ];

      await ffmpeg.exec(args);
      ffmpeg.off('progress', progressCallback);

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data as any], { type: 'image/gif' });
      const url = URL.createObjectURL(blob);

      setGifBlob(blob);
      setGifUrl(url);

      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setGifName(`${baseName}.gif`);

      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (err: any) {
      console.error(err);
      alert('Terjadi kesalahan saat membuat GIF: ' + (err?.message || 'Error tidak diketahui'));
      setStatusMsg('Gagal membuat animasi GIF.');
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
            <p className="font-bold text-white">Klik atau seret video untuk diubah jadi GIF</p>
            <p className="text-xs text-slate-400">Buat animasi GIF berkualitas tinggi tanpa watermark</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="bg-teal-500/20 text-teal-400 p-2.5 rounded-lg">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white truncate max-w-xs sm:max-w-md">{file.name}</p>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span>Ukuran: <strong className="text-slate-200">{formatBytes(file.size)}</strong></span>
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
                setGifBlob(null);
              }}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            >
              Ganti File
            </button>
          </div>

          {/* Original Preview */}
          {originalUrl && !gifBlob && (
            <div className="rounded-xl overflow-hidden bg-black/80 border border-slate-800 flex justify-center max-h-64">
              <video src={originalUrl} controls className="max-h-64 w-auto max-w-full rounded-lg" />
            </div>
          )}

          {/* Settings Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-900/40 p-5 border border-slate-700/60 rounded-xl">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                Mulai Detik Ke-
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={startTime}
                onChange={(e) => setStartTime(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                Durasi Cuplikan (Detik)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                step="0.5"
                value={duration}
                onChange={(e) => setDuration(Math.max(0.5, Math.min(30, parseFloat(e.target.value) || 1)))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-teal-400" />
                Lebar GIF (Resolution)
              </label>
              <select
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="320">320 px (Kecil & Sangat Ringan)</option>
                <option value="480">480 px (Standar / Rekomendasi)</option>
                <option value="640">640 px (Jelas & Tajam)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                Frame Rate (FPS)
              </label>
              <select
                value={fps}
                onChange={(e) => setFps(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="10">10 FPS (File Paling Kecil)</option>
                <option value="12">12 FPS (Cukup Halus)</option>
                <option value="15">15 FPS (Standar GIF Nyaman)</option>
                <option value="20">20 FPS (Gerakan Mulus)</option>
              </select>
            </div>
          </div>

          {/* Trigger */}
          {!loading && !gifBlob && (
            <button
              onClick={convertToGif}
              className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Konversi ke Animasi GIF
            </button>
          )}

          {/* Loading */}
          {loading && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 text-center">
              <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="font-bold text-sm text-white">Sedang Memproses Animasi GIF...</p>
                <p className="text-xs text-slate-400">{statusMsg}</p>
                <p className="text-xs text-teal-400 font-semibold">{progress}%</p>
              </div>
            </div>
          )}

          {/* Result */}
          {gifBlob && gifUrl && !loading && (
            <div className="bg-slate-900/90 border border-teal-500/40 p-5 rounded-xl space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-teal-400 text-sm font-bold">
                <CheckCircle2 className="w-5 h-5" />
                <span>Animasi GIF Berhasil Dibuat!</span>
              </div>

              {/* GIF Player Preview */}
              <div className="rounded-xl overflow-hidden bg-black/60 border border-slate-800 flex justify-center p-2">
                <img src={gifUrl} alt="GIF Result" className="max-h-80 w-auto rounded-lg shadow-md" />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-800">
                <div>
                  <p className="font-bold text-white text-sm truncate max-w-xs sm:max-w-md">{gifName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Ukuran file GIF: {formatBytes(gifBlob.size)}</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setGifBlob(null);
                      setGifUrl(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 rounded-lg transition"
                  >
                    Buat GIF Lain
                  </button>
                  <button
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = gifUrl;
                      a.download = gifName;
                      a.click();
                    }}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-lg transition shadow-lg shadow-teal-500/20"
                  >
                    <Download className="w-4 h-4" />
                    Unduh Animasi GIF
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
