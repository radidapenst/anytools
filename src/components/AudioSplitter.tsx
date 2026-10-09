import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileAudio, Settings, Play, Pause, Download, Archive, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import { splitMP3, trimMP3, SplitResult, SplitProgress } from '../utils/mp3Splitter';
import { splitWAV, trimWAV } from '../utils/wavSplitter';
import JSZip from 'jszip';

export default function AudioSplitter() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<SplitProgress | null>(null);
  const [splitMode, setSplitMode] = useState<'duration' | 'parts' | 'custom'>('duration');
  const [splitDuration, setSplitDuration] = useState<{ minutes: number; seconds: number }>({ minutes: 30, seconds: 0 });
  const [splitParts, setSplitParts] = useState<number>(4);
  const [customRange, setCustomRange] = useState<{
    startMinutes: number;
    startSeconds: number;
    endMinutes: number;
    endSeconds: number;
  }>({
    startMinutes: 0,
    startSeconds: 0,
    endMinutes: 1,
    endSeconds: 0,
  });
  const [results, setResults] = useState<SplitResult[]>([]);
  const [zipProgress, setZipProgress] = useState<boolean>(false);
  
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clean up audio preview when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return [
      hrs > 0 ? String(hrs).padStart(2, '0') : null,
      String(mins).padStart(2, '0'),
      String(secs).padStart(2, '0')
    ].filter(Boolean).join(':');
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processFile(selected);
    }
  };

  const processFile = (selected: File) => {
    const fileType = selected.name.split('.').pop()?.toLowerCase();
    if (fileType !== 'mp3' && fileType !== 'wav') {
      alert('Hanya mendukung format file MP3 dan WAV untuk saat ini.');
      return;
    }

    setFile(selected);
    setResults([]);
    setDuration(null);

    // Get duration using browser audio element
    const objectUrl = URL.createObjectURL(selected);
    const audio = new Audio(objectUrl);
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
      const totalSecs = Math.floor(audio.duration);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      setCustomRange({
        startMinutes: 0,
        startSeconds: 0,
        endMinutes: mins,
        endSeconds: secs,
      });
      URL.revokeObjectURL(objectUrl);
    });
    audio.addEventListener('error', () => {
      // Fallback if browser can't decode, the parser can still split but duration won't be shown
      URL.revokeObjectURL(objectUrl);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const startSplit = async () => {
    if (!file) return;

    setLoading(true);
    setResults([]);
    setProgress({ phase: 'parsing', percent: 0 });

    try {
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          const buffer = new Uint8Array(reader.result as ArrayBuffer);
          const fileType = file.name.split('.').pop()?.toLowerCase();
          
          let splitResults: SplitResult[] = [];
          
          if (splitMode === 'custom') {
            const startSec = customRange.startMinutes * 60 + customRange.startSeconds;
            const endSec = customRange.endMinutes * 60 + customRange.endSeconds;

            if (startSec >= endSec) {
              throw new Error('Waktu mulai harus lebih kecil dari waktu selesai.');
            }

            if (fileType === 'mp3') {
              splitResults = trimMP3(buffer, startSec, endSec, file.name, (prog) => {
                setProgress(prog);
              });
            } else if (fileType === 'wav') {
              splitResults = trimWAV(buffer, startSec, endSec, file.name, (prog) => {
                setProgress(prog);
              });
            }
          } else {
            let targetSeconds = 0;
            if (splitMode === 'duration') {
              targetSeconds = splitDuration.minutes * 60 + splitDuration.seconds;
            } else {
              if (!duration) {
                throw new Error('Gagal mendapatkan total durasi file audio untuk pemisahan jumlah bagian.');
              }
              targetSeconds = duration / splitParts;
            }

            if (targetSeconds <= 0) {
              throw new Error('Durasi pemisahan harus lebih dari 0 detik.');
            }

            if (fileType === 'mp3') {
              splitResults = splitMP3(buffer, targetSeconds, file.name, (prog) => {
                setProgress(prog);
              });
            } else if (fileType === 'wav') {
              splitResults = splitWAV(buffer, targetSeconds, file.name, (prog) => {
                setProgress(prog);
              });
            }
          }

          setResults(splitResults);
          setLoading(false);
          setProgress(null);
        } catch (err: any) {
          alert(`Error saat memproses audio: ${err.message}`);
          setLoading(false);
          setProgress(null);
        }
      };

      reader.onerror = () => {
        alert('Gagal membaca file.');
        setLoading(false);
        setProgress(null);
      };

      reader.readAsArrayBuffer(file);

    } catch (err: any) {
      alert(err.message);
      setLoading(false);
      setProgress(null);
    }
  };

  const handlePlayPreview = (blob: Blob, name: string) => {
    if (isPlaying === name) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
      setIsPlaying(name);
      audio.onended = () => {
        setIsPlaying(null);
        URL.revokeObjectURL(url);
      };
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllAsZip = async () => {
    if (results.length === 0) return;
    setZipProgress(true);

    try {
      const zip = new JSZip();
      results.forEach((res) => {
        zip.file(res.filename, res.blob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, `${file?.name.split('.')[0] || 'anytools'}_split_parts.zip`);
    } catch (err: any) {
      alert(`Gagal membuat ZIP file: ${err.message}`);
    } finally {
      setZipProgress(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setDuration(null);
    setResults([]);
    setProgress(null);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-slate-800 border border-slate-700 rounded-2xl shadow-xl overflow-hidden">
      {/* Privacy guarantee badge */}
      <div className="bg-teal-500/10 border-b border-teal-500/20 px-6 py-3 flex items-center gap-3">
        <ShieldAlert className="text-teal-400 w-5 h-5 shrink-0" />
        <span className="text-xs sm:text-sm text-teal-300 font-medium">
          Privasi Terjamin: File diproses 100% di komputer Anda tanpa di-upload ke server mana pun.
        </span>
      </div>

      <div className="p-6 sm:p-8">
        {!file ? (
          /* Dropzone */
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-600 hover:border-teal-500 hover:bg-slate-750/50 transition duration-200 rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer group"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <input
              id="file-upload"
              type="file"
              accept=".mp3,.wav"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="w-16 h-16 rounded-full bg-slate-750 flex items-center justify-center text-slate-400 group-hover:text-teal-400 group-hover:bg-teal-500/10 transition duration-200 mb-4">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-1">
              Drag & Drop file audio di sini
            </h3>
            <p className="text-sm text-slate-400 mb-4 max-w-xs">
              Mendukung file MP3 atau WAV (cocok untuk rekaman durasi panjang).
            </p>
            <button className="px-4 py-2 bg-slate-750 hover:bg-slate-700 text-teal-400 font-semibold border border-slate-600 group-hover:border-teal-500/50 rounded-lg text-sm transition">
              Pilih File
            </button>
          </div>
        ) : (
          /* Split Configuration Area */
          <div className="space-y-6">
            {/* File Info */}
            <div className="flex items-center justify-between p-4 bg-slate-750/50 rounded-xl border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-teal-500/10 rounded-lg text-teal-400">
                  <FileAudio className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 truncate max-w-sm sm:max-w-md">
                    {file.name}
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    <span>Ukuran: {formatBytes(file.size)}</span>
                    {duration !== null && (
                      <>
                        <span>•</span>
                        <span>Durasi: {formatTime(duration)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={resetAll}
                className="text-xs font-semibold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-rose-500/20 transition"
              >
                Ganti File
              </button>
            </div>

            {/* Split Settings */}
            {results.length === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-750 p-6 rounded-xl border border-slate-700">
                <div>
                  <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2 mb-4">
                    <Settings className="w-5 h-5 text-teal-400" />
                    Pengaturan Pemecahan
                  </h3>

                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-800 rounded-lg border border-slate-750 mb-4">
                    <button
                      onClick={() => setSplitMode('duration')}
                      className={`py-2 text-xs font-semibold rounded-md transition ${
                        splitMode === 'duration'
                          ? 'bg-teal-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Berdasarkan Durasi
                    </button>
                    <button
                      onClick={() => setSplitMode('parts')}
                      className={`py-2 text-xs font-semibold rounded-md transition ${
                        splitMode === 'parts'
                          ? 'bg-teal-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Bagi Rata
                    </button>
                    <button
                      onClick={() => setSplitMode('custom')}
                      className={`py-2 text-xs font-semibold rounded-md transition ${
                        splitMode === 'custom'
                          ? 'bg-teal-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Potong Custom
                    </button>
                  </div>

                  {splitMode === 'custom' ? (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">Waktu Mulai (Start):</label>
                        <div className="flex gap-2 items-center">
                          <div className="flex-1 flex gap-2 items-center bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              className="bg-transparent text-right w-full text-slate-200 outline-none"
                              value={customRange.startMinutes}
                              onChange={(e) =>
                                setCustomRange({ ...customRange, startMinutes: Math.max(0, parseInt(e.target.value) || 0) })
                              }
                            />
                            <span className="text-xs text-slate-400">menit</span>
                          </div>
                          <div className="flex-1 flex gap-2 items-center bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max="59"
                              className="bg-transparent text-right w-full text-slate-200 outline-none"
                              value={customRange.startSeconds}
                              onChange={(e) =>
                                setCustomRange({ ...customRange, startSeconds: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })
                              }
                            />
                            <span className="text-xs text-slate-400">detik</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-semibold text-slate-300">Waktu Selesai (End):</label>
                          {duration !== null && (
                            <button
                              type="button"
                              onClick={() => {
                                const totalSecs = Math.floor(duration);
                                setCustomRange((prev) => ({
                                  ...prev,
                                  endMinutes: Math.floor(totalSecs / 60),
                                  endSeconds: totalSecs % 60,
                                }));
                              }}
                              className="text-[10px] text-teal-400 hover:underline"
                            >
                              Akhir Audio ({formatTime(duration)})
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2 items-center">
                          <div className="flex-1 flex gap-2 items-center bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              className="bg-transparent text-right w-full text-slate-200 outline-none"
                              value={customRange.endMinutes}
                              onChange={(e) =>
                                setCustomRange({ ...customRange, endMinutes: Math.max(0, parseInt(e.target.value) || 0) })
                              }
                            />
                            <span className="text-xs text-slate-400">menit</span>
                          </div>
                          <div className="flex-1 flex gap-2 items-center bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max="59"
                              className="bg-transparent text-right w-full text-slate-200 outline-none"
                              value={customRange.endSeconds}
                              onChange={(e) =>
                                setCustomRange({ ...customRange, endSeconds: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })
                              }
                            />
                            <span className="text-xs text-slate-400">detik</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : splitMode === 'duration' ? (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-400">Durasi Tiap Bagian</label>
                      <div className="flex gap-3 items-center">
                        <div className="flex-1 flex gap-2 items-center bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            className="bg-transparent text-right w-full text-slate-200 outline-none"
                            value={splitDuration.minutes}
                            onChange={(e) =>
                              setSplitDuration({ ...splitDuration, minutes: Math.max(0, parseInt(e.target.value) || 0) })
                            }
                          />
                          <span className="text-xs text-slate-400">menit</span>
                        </div>
                        <div className="flex-1 flex gap-2 items-center bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            max="59"
                            className="bg-transparent text-right w-full text-slate-200 outline-none"
                            value={splitDuration.seconds}
                            onChange={(e) =>
                              setSplitDuration({ ...splitDuration, seconds: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })
                            }
                          />
                          <span className="text-xs text-slate-400">detik</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Contoh: 30 menit 0 detik akan memecah file audio Anda menjadi beberapa bagian berdurasi masing-masing 30 menit.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-400">Pecah Menjadi</label>
                      <div className="flex gap-2 items-center bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                        <input
                          type="number"
                          min="2"
                          max="100"
                          className="bg-transparent text-right w-full text-slate-200 outline-none"
                          value={splitParts}
                          onChange={(e) => setSplitParts(Math.max(2, parseInt(e.target.value) || 2))}
                        />
                        <span className="text-xs text-slate-400">bagian file</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Membagi rata total durasi file menjadi {splitParts} bagian file audio.
                        {duration !== null && (
                          <span className="text-teal-400 block mt-1">
                            Estimasi durasi per bagian: {formatTime(duration / splitParts)}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-between border-t border-slate-700 md:border-t-0 md:border-l md:pl-6 pt-6 md:pt-0">
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Perkiraan Hasil</h4>
                    {duration !== null ? (
                      <div className="space-y-2 text-sm text-slate-300">
                        <div className="flex justify-between">
                          <span>Total Durasi:</span>
                          <span className="font-semibold text-slate-200">{formatTime(duration)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Estimasi Jumlah File:</span>
                          <span className="font-semibold text-teal-400">
                            {splitMode === 'custom'
                              ? '1 file (Potongan Custom)'
                              : splitMode === 'duration'
                              ? Math.ceil(duration / (splitDuration.minutes * 60 + splitDuration.seconds)) + ' file'
                              : splitParts + ' file'}
                          </span>
                        </div>
                        {splitMode === 'custom' && (
                          <div className="flex justify-between text-xs text-teal-300 pt-1 border-t border-slate-700">
                            <span>Durasi Potongan:</span>
                            <span className="font-bold">
                              {formatTime(
                                Math.max(
                                  0,
                                  customRange.endMinutes * 60 + customRange.endSeconds - (customRange.startMinutes * 60 + customRange.startSeconds)
                                )
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Menghitung estimasi setelah parsing header selesai...
                      </p>
                    )}
                  </div>

                  <button
                    onClick={startSplit}
                    disabled={loading}
                    className="w-full mt-6 py-3 bg-teal-500 hover:bg-teal-400 active:bg-teal-600 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-bold rounded-xl transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/10"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Pecah File Audio Sekarang
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Split Progress */}
            {loading && progress && (
              <div className="bg-slate-750 p-6 rounded-xl border border-slate-700 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-slate-200">
                    {progress.phase === 'parsing' ? 'Menganalisis frame audio...' : 'Memotong dan menyusun file...'}
                  </span>
                  <span className="font-bold text-teal-400">{progress.percent}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-teal-400 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress.percent}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-400 text-center italic">
                  Proses ini dilakukan murni di memori browser Anda, sangat cepat dan 100% privat.
                </p>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-200">
                    Hasil Pemecahan ({results.length} Bagian)
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={downloadAllAsZip}
                      disabled={zipProgress}
                      className="px-4 py-2 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-700 text-slate-950 font-bold rounded-lg text-sm transition flex items-center gap-2"
                    >
                      {zipProgress ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Archive className="w-4 h-4" />
                      )}
                      Unduh Semua (.ZIP)
                    </button>
                    <button
                      onClick={() => setResults([])}
                      className="px-4 py-2 bg-slate-750 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-sm border border-slate-700 transition"
                    >
                      Ulangi
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-1">
                  {results.map((res, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-slate-750/70 border border-slate-700 hover:border-slate-655 rounded-xl transition duration-150"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-slate-800 text-teal-400 border border-slate-700 flex items-center justify-center font-bold text-sm">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-medium text-sm text-slate-200 truncate max-w-[200px] sm:max-w-sm md:max-w-md">
                            {res.filename}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Durasi: {formatTime(res.duration)} • Ukuran: {formatBytes(res.blob.size)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePlayPreview(res.blob, res.filename)}
                          className={`p-2.5 rounded-lg border transition ${
                            isPlaying === res.filename
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                              : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300'
                          }`}
                          title="Preview"
                        >
                          {isPlaying === res.filename ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current" />
                          )}
                        </button>
                        <button
                          onClick={() => downloadBlob(res.blob, res.filename)}
                          className="p-2.5 bg-slate-800 border border-slate-700 hover:border-slate-600 hover:bg-slate-700 text-teal-400 rounded-lg transition"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
