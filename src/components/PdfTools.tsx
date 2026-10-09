import { useState, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  Layers, 
  Scissors, 
  Minimize2, 
  Image as ImageIcon, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  FilePlus,
  Zap
} from 'lucide-react';
import { 
  mergePdfs, 
  splitPdfAllPages, 
  splitPdfByRange, 
  compressPdf, 
  convertPdfToImages, 
  convertImagesToPdf, 
  zipBlobs 
} from '../utils/pdfTools';

type SubTool = 'join' | 'split' | 'compress' | 'pdf-to-img' | 'img-to-pdf';

export default function PdfTools() {
  const [activeSubTool, setActiveSubTool] = useState<SubTool>('join');
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // File states for each sub-tool
  // 1. Joiner
  const [joinFiles, setJoinFiles] = useState<File[]>([]);
  
  // 2. Splitter
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [splitMode, setSplitMode] = useState<'all' | 'range'>('all');
  const [splitRange, setSplitRange] = useState('');

  // 3. Compress
  const [compressFile, setCompressFile] = useState<File | null>(null);
  const [compressLevel, setCompressLevel] = useState<'high' | 'medium' | 'low'>('medium');
  const [compressResult, setCompressResult] = useState<{
    originalSize: number;
    newSize: number;
    blob: Blob;
  } | null>(null);

  // 4. PDF to Image
  const [pdfToImgFile, setPdfToImgFile] = useState<File | null>(null);
  const [imgFormat, setImgFormat] = useState<'jpeg' | 'png'>('jpeg');
  const [imgScale, setImgScale] = useState<number>(1.5);
  const [convertedImages, setConvertedImages] = useState<{ name: string; blob: Blob; dataUrl: string }[]>([]);

  // 5. Image to PDF
  const [imgToPdfFiles, setImgToPdfFiles] = useState<File[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetState = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setCompressResult(null);
    setConvertedImages([]);
  };

  const moveItem = <T,>(list: T[], index: number, direction: 'up' | 'down'): T[] => {
    const newList = [...list];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return list;
    const [moved] = newList.splice(index, 1);
    newList.splice(targetIndex, 0, moved);
    return newList;
  };

  // -------------------------------------------------------------
  // Handlers for Sub Tools
  // -------------------------------------------------------------

  // 1. PDF Joiner Handler
  const handleJoinPdfs = async () => {
    if (joinFiles.length < 2) {
      setErrorMsg('Pilih minimal 2 file PDF untuk digabungkan.');
      return;
    }
    resetState();
    setLoading(true);
    try {
      const bytes = await mergePdfs(joinFiles, setProgressMsg);
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      triggerDownload(blob, 'PDF_Gabungan_AnyTools.pdf');
      setSuccessMsg('Berhasil menggabungkan PDF! File otomatis diunduh.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menggabungkan PDF.');
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  // 2. PDF Splitter Handler
  const handleSplitPdf = async () => {
    if (!splitFile) {
      setErrorMsg('Silakan pilih file PDF terlebih dahulu.');
      return;
    }
    resetState();
    setLoading(true);
    try {
      if (splitMode === 'all') {
        const results = await splitPdfAllPages(splitFile, setProgressMsg);
        if (results.length === 1) {
          triggerDownload(results[0].blob, results[0].name);
        } else {
          setProgressMsg('Membuat file ZIP hasil pecahan...');
          const zipBlob = await zipBlobs(results);
          triggerDownload(zipBlob, `${splitFile.name.replace(/\.pdf$/i, '')}_halaman.zip`);
        }
        setSuccessMsg(`Berhasil memecah PDF menjadi ${results.length} halaman!`);
      } else {
        if (!splitRange.trim()) {
          throw new Error('Masukkan rentang halaman yang ingin dipisah (contoh: 1-3, 5).');
        }
        const bytes = await splitPdfByRange(splitFile, splitRange, setProgressMsg);
        const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
        triggerDownload(blob, `${splitFile.name.replace(/\.pdf$/i, '')}_terpisah.pdf`);
        setSuccessMsg('Berhasil mengekstrak rentang halaman PDF!');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memisahkan PDF.');
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  // 3. PDF Compress Handler
  const handleCompressPdf = async () => {
    if (!compressFile) {
      setErrorMsg('Silakan pilih file PDF yang akan dikompres.');
      return;
    }
    resetState();
    setLoading(true);

    const config = {
      high: { quality: 0.75, scale: 1.0 },
      medium: { quality: 0.55, scale: 0.85 },
      low: { quality: 0.35, scale: 0.7 },
    }[compressLevel];

    try {
      const bytes = await compressPdf(compressFile, config, setProgressMsg);
      const newBlob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      setCompressResult({
        originalSize: compressFile.size,
        newSize: newBlob.size,
        blob: newBlob,
      });
      setSuccessMsg('Kompresi PDF selesai!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengompres PDF.');
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  // 4. PDF to Image Handler
  const handlePdfToImage = async () => {
    if (!pdfToImgFile) {
      setErrorMsg('Silakan pilih file PDF.');
      return;
    }
    resetState();
    setLoading(true);
    try {
      const imgs = await convertPdfToImages(
        pdfToImgFile, 
        { format: imgFormat, scale: imgScale }, 
        setProgressMsg
      );
      setConvertedImages(imgs);
      setSuccessMsg(`Berhasil mengonversi ${imgs.length} halaman PDF menjadi gambar ${imgFormat.toUpperCase()}!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengonversi PDF ke gambar.');
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  // Download all images as ZIP
  const handleDownloadAllImagesZip = async () => {
    if (convertedImages.length === 0) return;
    setLoading(true);
    setProgressMsg('Membuat file ZIP gambar...');
    try {
      const zipBlob = await zipBlobs(convertedImages);
      triggerDownload(zipBlob, `${pdfToImgFile?.name.replace(/\.pdf$/i, '')}_gambar.zip`);
    } catch (err: any) {
      setErrorMsg('Gagal mengunduh file ZIP.');
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  // 5. Image to PDF Handler
  const handleImageToPdf = async () => {
    if (imgToPdfFiles.length === 0) {
      setErrorMsg('Pilih minimal 1 gambar (JPG/PNG) untuk dikonversi.');
      return;
    }
    resetState();
    setLoading(true);
    try {
      const bytes = await convertImagesToPdf(imgToPdfFiles, setProgressMsg);
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      triggerDownload(blob, 'Gambar_Ke_PDF_AnyTools.pdf');
      setSuccessMsg('Berhasil mengonversi gambar menjadi PDF!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuat PDF dari gambar.');
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Sub-tool Selection Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 border-b border-slate-800 pb-4">
        {[
          { id: 'join', label: 'Gabung PDF', icon: Layers },
          { id: 'split', label: 'Pisah PDF', icon: Scissors },
          { id: 'compress', label: 'Kompres PDF', icon: Minimize2 },
          { id: 'pdf-to-img', label: 'PDF ke Gambar', icon: ImageIcon },
          { id: 'img-to-pdf', label: 'Gambar ke PDF', icon: FilePlus },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTool === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTool(tab.id as SubTool);
                resetState();
              }}
              className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl text-xs font-bold transition ${
                isActive
                  ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
                  : 'bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Global Alert Messages */}
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3 text-rose-300 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Terjadi Kesalahan:</span>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4 flex items-center gap-3 text-teal-300 text-xs">
          <CheckCircle className="w-5 h-5 shrink-0 text-teal-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Loading Progress State */}
      {loading && (
        <div className="bg-slate-850 border border-slate-800 rounded-xl p-6 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-white">{progressMsg || 'Sedang memproses file...'}</p>
          <p className="text-xs text-slate-400">Proses dilakukan 100% lokal di browser Anda.</p>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. PDF JOINER UI */}
      {/* ------------------------------------------------------------- */}
      {activeSubTool === 'join' && !loading && (
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <h4 className="font-bold text-lg text-white">Gabungkan Beberapa File PDF</h4>
            <p className="text-xs text-slate-400">Pilih beberapa file PDF dan urutkan sesuai keinginan sebelum digabung.</p>
          </div>

          <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-teal-500/50 bg-slate-850/50 rounded-xl p-6 transition text-center space-y-3">
            <Upload className="w-8 h-8 text-teal-400" />
            <div>
              <p className="text-sm font-semibold text-slate-200">Pilih file-file PDF</p>
              <p className="text-xs text-slate-400 mt-0.5">Bisa memilih lebih dari 1 file sekaligus</p>
            </div>
            <input
              type="file"
              accept="application/pdf"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  const filesArray = Array.from(e.target.files);
                  setJoinFiles((prev) => [...prev, ...filesArray]);
                  resetState();
                }
              }}
              className="hidden"
              ref={fileInputRef}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-teal-400 text-xs font-bold rounded-lg border border-slate-700 transition"
            >
              + Tambah File PDF
            </button>
          </div>

          {joinFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                <span>Daftar File ({joinFiles.length})</span>
                <button
                  onClick={() => setJoinFiles([])}
                  className="text-rose-400 hover:text-rose-300"
                >
                  Hapus Semua
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {joinFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-850 border border-slate-800 p-3 rounded-xl text-xs text-slate-300"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="font-bold text-teal-400 shrink-0">{idx + 1}.</span>
                      <FileText className="w-4 h-4 shrink-0 text-slate-400" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">({formatBytes(file.size)})</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setJoinFiles(moveItem(joinFiles, idx, 'up'))}
                        disabled={idx === 0}
                        className="p-1 hover:bg-slate-800 rounded disabled:opacity-30 text-slate-400 hover:text-white"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setJoinFiles(moveItem(joinFiles, idx, 'down'))}
                        disabled={idx === joinFiles.length - 1}
                        className="p-1 hover:bg-slate-800 rounded disabled:opacity-30 text-slate-400 hover:text-white"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setJoinFiles(joinFiles.filter((_, i) => i !== idx))}
                        className="p-1 hover:bg-rose-500/20 text-rose-400 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleJoinPdfs}
                className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
              >
                <Layers className="w-4 h-4" />
                Gabungkan {joinFiles.length} File PDF
              </button>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. PDF SPLITTER UI */}
      {/* ------------------------------------------------------------- */}
      {activeSubTool === 'split' && !loading && (
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <h4 className="font-bold text-lg text-white">Pisahkan Halaman PDF</h4>
            <p className="text-xs text-slate-400">Pecah seluruh halaman PDF menjadi file terpisah atau ambil rentang halaman kustom.</p>
          </div>

          {!splitFile ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-teal-500/50 bg-slate-850/50 rounded-xl p-6 transition text-center space-y-3">
              <Scissors className="w-8 h-8 text-teal-400" />
              <div>
                <p className="text-sm font-semibold text-slate-200">Pilih File PDF</p>
                <p className="text-xs text-slate-400 mt-0.5">File yang akan dipecah atau dipisah</p>
              </div>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSplitFile(e.target.files[0]);
                    resetState();
                  }
                }}
                className="hidden"
                id="split-file-input"
              />
              <label
                htmlFor="split-file-input"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-teal-400 text-xs font-bold rounded-lg border border-slate-700 transition cursor-pointer"
              >
                Upload File PDF
              </label>
            </div>
          ) : (
            <div className="space-y-4 bg-slate-850 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-5 h-5 text-teal-400 shrink-0" />
                  <span className="text-xs font-bold text-white truncate">{splitFile.name}</span>
                  <span className="text-[10px] text-slate-500">({formatBytes(splitFile.size)})</span>
                </div>
                <button
                  onClick={() => setSplitFile(null)}
                  className="text-xs text-rose-400 hover:underline shrink-0"
                >
                  Ganti File
                </button>
              </div>

              {/* Mode Selection */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <label className="text-xs font-bold text-slate-400">Metode Pemisahan:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSplitMode('all')}
                    className={`p-3 rounded-xl text-left border text-xs font-bold transition space-y-1 ${
                      splitMode === 'all'
                        ? 'bg-teal-500/10 border-teal-500/50 text-teal-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>Semua Halaman (ZIP)</div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      Setiap halaman akan dipisah menjadi 1 file PDF tersendiri.
                    </div>
                  </button>

                  <button
                    onClick={() => setSplitMode('range')}
                    className={`p-3 rounded-xl text-left border text-xs font-bold transition space-y-1 ${
                      splitMode === 'range'
                        ? 'bg-teal-500/10 border-teal-500/50 text-teal-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>Rentang Kustom</div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      Ekstrak hanya halaman tertentu (contoh: 1-3, 5, 8).
                    </div>
                  </button>
                </div>

                {splitMode === 'range' && (
                  <div className="space-y-1 pt-1">
                    <label className="text-xs text-slate-300">Masukkan Nomor Halaman / Rentang:</label>
                    <input
                      type="text"
                      placeholder="Contoh: 1-3, 5, 7-10"
                      value={splitRange}
                      onChange={(e) => setSplitRange(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-teal-500 text-white text-xs px-3 py-2 rounded-lg outline-none"
                    />
                  </div>
                )}

                <button
                  onClick={handleSplitPdf}
                  className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
                >
                  <Scissors className="w-4 h-4" />
                  Proses Pemisahan PDF
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. PDF COMPRESS UI */}
      {/* ------------------------------------------------------------- */}
      {activeSubTool === 'compress' && !loading && (
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <h4 className="font-bold text-lg text-white">Kompres Ukuran File PDF</h4>
            <p className="text-xs text-slate-400">Kecilkan ukuran file PDF tanpa perlu upload ke server mana pun.</p>
          </div>

          {!compressFile ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-teal-500/50 bg-slate-850/50 rounded-xl p-6 transition text-center space-y-3">
              <Minimize2 className="w-8 h-8 text-teal-400" />
              <div>
                <p className="text-sm font-semibold text-slate-200">Pilih File PDF</p>
                <p className="text-xs text-slate-400 mt-0.5">File PDF yang ukurannya ingin dikompres</p>
              </div>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setCompressFile(e.target.files[0]);
                    resetState();
                  }
                }}
                className="hidden"
                id="compress-file-input"
              />
              <label
                htmlFor="compress-file-input"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-teal-400 text-xs font-bold rounded-lg border border-slate-700 transition cursor-pointer"
              >
                Upload File PDF
              </label>
            </div>
          ) : (
            <div className="space-y-4 bg-slate-850 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-5 h-5 text-teal-400 shrink-0" />
                  <span className="text-xs font-bold text-white truncate">{compressFile.name}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">({formatBytes(compressFile.size)})</span>
                </div>
                <button
                  onClick={() => {
                    setCompressFile(null);
                    setCompressResult(null);
                  }}
                  className="text-xs text-rose-400 hover:underline shrink-0"
                >
                  Ganti File
                </button>
              </div>

              {/* Compression Quality Selector */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-xs font-bold text-slate-400">Pilih Tingkat Kompresi:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'high', label: 'Rendah (Hasil Jernih)', desc: 'Ukuran sedang' },
                    { id: 'medium', label: 'Sedang (Rekomendasi)', desc: 'Ukuran ideal' },
                    { id: 'low', label: 'Tinggi (Ukuran Kecil)', desc: 'Ukuran paling hemat' },
                  ].map((level) => (
                    <button
                      key={level.id}
                      onClick={() => setCompressLevel(level.id as any)}
                      className={`p-2.5 rounded-xl text-left border text-xs transition ${
                        compressLevel === level.id
                          ? 'bg-teal-500/10 border-teal-500/50 text-teal-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div>{level.label}</div>
                      <div className="text-[10px] text-slate-500 font-normal">{level.desc}</div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCompressPdf}
                  className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 mt-3"
                >
                  <Zap className="w-4 h-4" />
                  Mulai Kompresi PDF
                </button>
              </div>

              {/* Compression Result Banner */}
              {compressResult && (
                <div className="bg-slate-900 border border-teal-500/30 p-4 rounded-xl text-center space-y-3">
                  <div className="text-xs text-teal-400 font-bold">Hasil Kompresi:</div>
                  <div className="flex justify-center items-center gap-4 text-sm font-black">
                    <span className="text-slate-400 line-through">{formatBytes(compressResult.originalSize)}</span>
                    <span className="text-white">→</span>
                    <span className="text-teal-400">{formatBytes(compressResult.newSize)}</span>
                    <span className="bg-teal-500/20 text-teal-300 text-xs px-2 py-0.5 rounded-full font-bold">
                      -{( (1 - compressResult.newSize / compressResult.originalSize) * 100 ).toFixed(0)}%
                    </span>
                  </div>

                  <button
                    onClick={() => triggerDownload(compressResult.blob, `${compressFile.name.replace(/\.pdf$/i, '')}_compressed.pdf`)}
                    className="px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-lg transition inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Unduh PDF Terkompresi
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. PDF TO IMAGE UI */}
      {/* ------------------------------------------------------------- */}
      {activeSubTool === 'pdf-to-img' && !loading && (
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <h4 className="font-bold text-lg text-white">Konversi PDF ke Gambar (JPG/PNG)</h4>
            <p className="text-xs text-slate-400">Ekstrak setiap halaman dari PDF menjadi gambar berkualitas tinggi.</p>
          </div>

          {!pdfToImgFile ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-teal-500/50 bg-slate-850/50 rounded-xl p-6 transition text-center space-y-3">
              <ImageIcon className="w-8 h-8 text-teal-400" />
              <div>
                <p className="text-sm font-semibold text-slate-200">Pilih File PDF</p>
                <p className="text-xs text-slate-400 mt-0.5">Setiap halaman akan diubah menjadi gambar</p>
              </div>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setPdfToImgFile(e.target.files[0]);
                    resetState();
                  }
                }}
                className="hidden"
                id="pdf-to-img-input"
              />
              <label
                htmlFor="pdf-to-img-input"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-teal-400 text-xs font-bold rounded-lg border border-slate-700 transition cursor-pointer"
              >
                Upload File PDF
              </label>
            </div>
          ) : (
            <div className="space-y-4 bg-slate-850 border border-slate-800 p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-5 h-5 text-teal-400 shrink-0" />
                  <span className="text-xs font-bold text-white truncate">{pdfToImgFile.name}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">({formatBytes(pdfToImgFile.size)})</span>
                </div>
                <button
                  onClick={() => {
                    setPdfToImgFile(null);
                    setConvertedImages([]);
                  }}
                  className="text-xs text-rose-400 hover:underline shrink-0"
                >
                  Ganti File
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="text-xs font-bold text-slate-400">Format Gambar:</label>
                  <select
                    value={imgFormat}
                    onChange={(e) => setImgFormat(e.target.value as any)}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 text-white text-xs px-3 py-2 rounded-lg outline-none"
                  >
                    <option value="jpeg">JPG / JPEG (Ukuran lebih kecil)</option>
                    <option value="png">PNG (Transparansi / Jernih)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400">Resolusi Output:</label>
                  <select
                    value={imgScale}
                    onChange={(e) => setImgScale(parseFloat(e.target.value))}
                    className="w-full mt-1 bg-slate-900 border border-slate-700 text-white text-xs px-3 py-2 rounded-lg outline-none"
                  >
                    <option value={1.0}>1x Standard DPI</option>
                    <option value={1.5}>1.5x High Quality (Rekomendasi)</option>
                    <option value={2.0}>2x Ultra HD Resolution</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handlePdfToImage}
                className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
              >
                <ImageIcon className="w-4 h-4" />
                Konversi PDF ke Gambar
              </button>

              {/* Converted Images Gallery */}
              {convertedImages.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300">
                      Hasil Konversi ({convertedImages.length} Halaman)
                    </span>
                    <button
                      onClick={handleDownloadAllImagesZip}
                      className="px-3 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Unduh Semua (ZIP)
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
                    {convertedImages.map((img, idx) => (
                      <div key={idx} className="bg-slate-900 border border-slate-800 p-2 rounded-xl space-y-2 group">
                        <img
                          src={img.dataUrl}
                          alt={img.name}
                          className="w-full h-32 object-contain bg-slate-950 rounded-lg border border-slate-800"
                        />
                        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                          <span className="truncate max-w-[100px]">{img.name}</span>
                          <button
                            onClick={() => triggerDownload(img.blob, img.name)}
                            className="text-teal-400 hover:text-white"
                          >
                            <Download className="w-3.5 h-3.5" />
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
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. IMAGE TO PDF UI */}
      {/* ------------------------------------------------------------- */}
      {activeSubTool === 'img-to-pdf' && !loading && (
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <h4 className="font-bold text-lg text-white">Konversi Gambar ke PDF</h4>
            <p className="text-xs text-slate-400">Gabungkan beberapa foto/gambar (JPG, PNG, WebP) menjadi 1 dokumen PDF.</p>
          </div>

          <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-teal-500/50 bg-slate-850/50 rounded-xl p-6 transition text-center space-y-3">
            <FilePlus className="w-8 h-8 text-teal-400" />
            <div>
              <p className="text-sm font-semibold text-slate-200">Pilih Gambar</p>
              <p className="text-xs text-slate-400 mt-0.5">Dukungan format JPG, PNG, WebP</p>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  const filesArray = Array.from(e.target.files);
                  setImgToPdfFiles((prev) => [...prev, ...filesArray]);
                  resetState();
                }
              }}
              className="hidden"
              id="img-to-pdf-input"
            />
            <label
              htmlFor="img-to-pdf-input"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-teal-400 text-xs font-bold rounded-lg border border-slate-700 transition cursor-pointer"
            >
              + Tambah Gambar
            </label>
          </div>

          {imgToPdfFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                <span>Daftar Gambar ({imgToPdfFiles.length})</span>
                <button
                  onClick={() => setImgToPdfFiles([])}
                  className="text-rose-400 hover:text-rose-300"
                >
                  Hapus Semua
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {imgToPdfFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-850 border border-slate-800 p-3 rounded-xl text-xs text-slate-300"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="font-bold text-teal-400 shrink-0">{idx + 1}.</span>
                      <ImageIcon className="w-4 h-4 shrink-0 text-slate-400" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">({formatBytes(file.size)})</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setImgToPdfFiles(moveItem(imgToPdfFiles, idx, 'up'))}
                        disabled={idx === 0}
                        className="p-1 hover:bg-slate-800 rounded disabled:opacity-30 text-slate-400 hover:text-white"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setImgToPdfFiles(moveItem(imgToPdfFiles, idx, 'down'))}
                        disabled={idx === imgToPdfFiles.length - 1}
                        className="p-1 hover:bg-slate-800 rounded disabled:opacity-30 text-slate-400 hover:text-white"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setImgToPdfFiles(imgToPdfFiles.filter((_, i) => i !== idx))}
                        className="p-1 hover:bg-rose-500/20 text-rose-400 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleImageToPdf}
                className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
              >
                <FilePlus className="w-4 h-4" />
                Konversi {imgToPdfFiles.length} Gambar Ke PDF
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
