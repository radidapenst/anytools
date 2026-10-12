import { useState, useEffect } from 'react';
import { Upload, Film, Settings, Download, RefreshCw, ShieldAlert, Sparkles, Sliders, VolumeX, Volume2, CheckCircle2 } from 'lucide-react';
import { fetchFile } from '@ffmpeg/util';
import { getFFmpeg, getVideoMetadata, formatBytes, formatTime } from '../utils/ffmpegHelper';

export default function VideoCompressor() {
  const [file, setFile] = useState<File | null>(null);
  const [videoMeta, setVideoMeta] = useState<{ duration: number; width: number; height: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState('');

  // Settings
  const [targetFormat, setTargetFormat] = useState<'mp4' | 'webm' | 'mkv' | 'avi'>('mp4');
  const [resolution, setResolution] = useState<string>('original');
  const [qualityPreset, setQualityPreset] = useState<string>('balanced');
  const [audioOption, setAudioOption] = useState<'keep' | 'compress' | 'mute'>('compress');
  const [speedPreset, setSpeedPreset] = useState<string>('ultrafast');
  const [fps, setFps] = useState<string>('original');

  // Results
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressedUrl, setCompressedUrl] = useState<string | null>(null);
  const [compressedName, setCompressedName] = useState<string>('');
  const [compressedSize, setCompressedSize] = useState<number | null>(null);

  // Original preview
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (compressedUrl) URL.revokeObjectURL(compressedUrl);
    };
  }, [originalUrl, compressedUrl]);

  const handleFileChange = async (selected: File) => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (compressedUrl) URL.revokeObjectURL(compressedUrl);

    setFile(selected);
    setCompressedBlob(null);
    setCompressedUrl(null);
    setCompressedSize(null);
    setProgress(0);
    setStatusMsg('');

    const url = URL.createObjectURL(selected);
    setOriginalUrl(url);

    try {
      const meta = await getVideoMetadata(selected);
      setVideoMeta(meta);
    } catch {
      setVideoMeta(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type.startsWith('video/')) {
      handleFileChange(dropped);
    }
  };

  const startCompression = async () => {
    if (!file) return;

    setLoading(true);
    setProgress(0);
    setStatusMsg('Menyiapkan engine FFmpeg lokal...');

    try {
      const ffmpeg = await getFFmpeg((msg) => {
        if (msg.includes('time=')) {
          // Additional progress parsing if needed
        }
      });

      setStatusMsg('Membaca file video ke memori lokal...');

      const progressCallback = ({ progress: p }: { progress: number }) => {
        const val = Math.max(0, Math.min(100, Math.round(p * 100)));
        setProgress(val);
      };

      ffmpeg.on('progress', progressCallback);

      const ext = file.name.substring(file.name.lastIndexOf('.')) || '.mp4';
      const inputName = `input_${Date.now()}${ext}`;
      const outputName = `output_${Date.now()}.${targetFormat}`;

      await ffmpeg.writeFile(inputName, await fetchFile(file));

      setStatusMsg('Mengompresi video dengan akselerasi WebAssembly...');

      const args = ['-i', inputName];

      // Video filters (Scale / FPS)
      const vfFilters: string[] = [];
      if (resolution !== 'original') {
        if (resolution === '1080p') vfFilters.push('scale=-2:1080');
        else if (resolution === '720p') vfFilters.push('scale=-2:720');
        else if (resolution === '480p') vfFilters.push('scale=-2:480');
        else if (resolution === '360p') vfFilters.push('scale=-2:360');
      }

      if (fps !== 'original') {
        vfFilters.push(`fps=${fps}`);
      }

      if (vfFilters.length > 0) {
        args.push('-vf', vfFilters.join(','));
      }

      // Video Codec & Quality
      if (targetFormat === 'webm') {
        args.push('-c:v', 'libvpx');
        const crfMap: Record<string, string> = {
          high: '20',
          balanced: '30',
          small: '38',
          extreme: '45',
        };
        args.push('-crf', crfMap[qualityPreset] || '30', '-b:v', '0');
      } else {
        // MP4 / MKV / AVI
        args.push('-c:v', 'libx264');
        const crfMap: Record<string, string> = {
          high: '22',
          balanced: '28',
          small: '34',
          extreme: '39',
        };
        args.push('-crf', crfMap[qualityPreset] || '28');
        args.push('-preset', speedPreset);
      }

      // Audio options
      if (audioOption === 'mute') {
        args.push('-an');
      } else if (audioOption === 'compress') {
        args.push('-c:a', 'aac', '-b:a', '96k');
      } else {
        // Keep
        args.push('-c:a', 'copy');
      }

      // Faststart for MP4 streaming
      if (targetFormat === 'mp4') {
        args.push('-movflags', '+faststart');
      }

      args.push(outputName);

      await ffmpeg.exec(args);

      ffmpeg.off('progress', progressCallback);

      setStatusMsg('Menyelesaikan hasil file...');
      const outputData = await ffmpeg.readFile(outputName);
      
      const mimeMap: Record<string, string> = {
        mp4: 'video/mp4',
        webm: 'video/webm',
        mkv: 'video/x-matroska',
        avi: 'video/x-msvideo',
      };

      const blob = new Blob([outputData as any], { type: mimeMap[targetFormat] || 'video/mp4' });
      const url = URL.createObjectURL(blob);

      setCompressedBlob(blob);
      setCompressedUrl(url);
      setCompressedSize(blob.size);
      
      const originalBaseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setCompressedName(`compressed_${originalBaseName}.${targetFormat}`);

      // Cleanup files in virtual FS
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (err: any) {
      console.error(err);
      alert('Terjadi kesalahan saat memproses video: ' + (err?.message || 'Error tidak diketahui'));
      setStatusMsg('Gagal memproses video.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!compressedBlob || !compressedUrl) return;
    const a = document.createElement('a');
    a.href = compressedUrl;
    a.download = compressedName;
    a.click();
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/80 rounded-2xl p-6 max-w-4xl mx-auto space-y-6">
      {!file ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
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
            <p className="font-bold text-white">Klik atau seret file video Anda ke sini</p>
            <p className="text-xs text-slate-400">Mendukung MP4, WebM, MOV, MKV, AVI, dll.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* File Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="bg-teal-500/20 text-teal-400 p-2.5 rounded-lg">
                <Film className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white truncate max-w-xs sm:max-w-md">{file.name}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span>Ukuran: <strong className="text-slate-200">{formatBytes(file.size)}</strong></span>
                  {videoMeta && (
                    <>
                      <span>•</span>
                      <span>Dimensi: <strong className="text-slate-200">{videoMeta.width}x{videoMeta.height}</strong></span>
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
                setCompressedBlob(null);
              }}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            >
              Ganti File
            </button>
          </div>

          {/* Original Preview Player */}
          {originalUrl && !compressedBlob && (
            <div className="rounded-xl overflow-hidden bg-black/60 border border-slate-800 flex justify-center max-h-72">
              <video src={originalUrl} controls className="max-h-72 w-auto max-w-full rounded-lg" />
            </div>
          )}

          {/* Compression Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-900/30 p-5 border border-slate-700/50 rounded-xl">
            {/* Format Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                Format Target
              </label>
              <select
                value={targetFormat}
                onChange={(e) => setTargetFormat(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="mp4">MP4 (H.264 - Universal / Rekomendasi)</option>
                <option value="webm">WebM (VP8 - Web Optimized)</option>
                <option value="mkv">MKV (Matroska)</option>
                <option value="avi">AVI (Audio Video Interleave)</option>
              </select>
            </div>

            {/* Resolution Scaling */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-teal-400" />
                Resolusi Video
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="original">Resolusi Asli {videoMeta ? `(${videoMeta.width}x${videoMeta.height})` : ''}</option>
                <option value="1080p">1080p (Full HD - Maks 1920px)</option>
                <option value="720p">720p (HD - Sangat Rekomendasi)</option>
                <option value="480p">480p (SD - Hemat Ukuran)</option>
                <option value="360p">360p (Ukuran Sangat Kecil)</option>
              </select>
            </div>

            {/* Quality Level */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-teal-400" />
                Tingkat Kompresi
              </label>
              <select
                value={qualityPreset}
                onChange={(e) => setQualityPreset(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="balanced">Seimbang (CRF 28 - Rekomendasi)</option>
                <option value="high">Kualitas Tinggi (CRF 22 - File Agak Besar)</option>
                <option value="small">Kompresi Kuat (CRF 34 - Hemat Ukuran)</option>
                <option value="extreme">Kompresi Ekstrem (CRF 39 - Ukuran Minimal)</option>
              </select>
            </div>

            {/* Audio Options */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                {audioOption === 'mute' ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-teal-400" />}
                Opsi Audio
              </label>
              <select
                value={audioOption}
                onChange={(e) => setAudioOption(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="compress">Kompres Audio (AAC 96k - Hemat)</option>
                <option value="keep">Pertahankan Audio Asli</option>
                <option value="mute">Hapus Audio / Bisu (Mute)</option>
              </select>
            </div>

            {/* FPS Control */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-teal-400" />
                Frame Rate (FPS)
              </label>
              <select
                value={fps}
                onChange={(e) => setFps(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="original">Original FPS</option>
                <option value="30">30 FPS (Standar)</option>
                <option value="24">24 FPS (Sinematik / Ringan)</option>
                <option value="15">15 FPS (Sangat Ringan)</option>
              </select>
            </div>

            {/* Speed / Preset */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-teal-400" />
                Kecepatan Encoding
              </label>
              <select
                value={speedPreset}
                onChange={(e) => setSpeedPreset(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="ultrafast">Ultrafast (Tercepat di Browser)</option>
                <option value="veryfast">Veryfast (Cepat & Seimbang)</option>
                <option value="faster">Faster (Kompresi Lebih Padat)</option>
              </select>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="flex gap-2 p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg text-xs text-teal-300">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              Kompresi dan konversi video berlangsung <strong>100% di browser Anda</strong> melalui FFmpeg WebAssembly. Video tidak pernah diunggah ke internet dan privasi Anda terjamin penuh.
            </p>
          </div>

          {/* Actions & Progress */}
          {!loading && !compressedBlob && (
            <button
              onClick={startCompression}
              className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl transition shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 flex items-center justify-center gap-2"
            >
              Mulai Kompres & Konversi Video
            </button>
          )}

          {loading && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 text-center">
              <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="font-bold text-sm text-white">Sedang Memproses Video...</p>
                <p className="text-xs text-slate-400">{statusMsg}</p>
                <p className="text-xs text-teal-400 font-semibold">Kemajuan: {progress}%</p>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2.5 max-w-md mx-auto overflow-hidden">
                <div
                  className="bg-teal-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Results Output */}
          {compressedBlob && compressedUrl && !loading && (
            <div className="bg-slate-900/90 border border-teal-500/40 p-5 rounded-xl space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-teal-400 text-sm font-bold">
                <CheckCircle2 className="w-5 h-5" />
                <span>Video Berhasil Dikompres & Dikonversi!</span>
              </div>

              {/* Compressed Preview */}
              <div className="rounded-xl overflow-hidden bg-black/80 border border-slate-800 flex justify-center max-h-80">
                <video src={compressedUrl} controls className="max-h-80 w-auto max-w-full rounded-lg" />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-800">
                <div className="space-y-1">
                  <p className="font-bold text-white text-sm truncate max-w-xs sm:max-w-md">{compressedName}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 line-through">{formatBytes(file.size)}</span>
                    <span className="text-slate-500">→</span>
                    <span className="text-teal-400 font-bold text-sm">{formatBytes(compressedSize || 0)}</span>
                    {compressedSize && (
                      <span className="bg-teal-500/20 text-teal-300 px-2.5 py-0.5 rounded-full font-bold">
                        {Math.round(((file.size - compressedSize) / file.size) * 100)}% Lebih Hemat
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setCompressedBlob(null);
                      setCompressedUrl(null);
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 rounded-lg transition"
                  >
                    Atur Ulang
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-lg transition shadow-lg shadow-teal-500/20"
                  >
                    <Download className="w-4 h-4" />
                    Unduh Video Hasil
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
