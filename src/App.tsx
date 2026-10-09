import { useState } from 'react';
import { Shield, Sliders, Info, Lock, ArrowLeft, Scissors, Music } from 'lucide-react';
import AudioSplitter from './components/AudioSplitter';
import AudioCompressor from './components/AudioCompressor';

export default function App() {
  const [activeTool, setActiveTool] = useState<'splitter' | 'compressor' | null>(null);

  return (
    <div className="app-theme min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header / Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTool(null)}>
            <div className="bg-teal-500 text-slate-950 p-2 rounded-lg font-black text-xl tracking-wider">
              AT
            </div>
            <div>
              <h1 className="font-extrabold text-lg text-white leading-none">AnyTools</h1>
              <span className="text-[10px] text-teal-400 font-semibold tracking-wider uppercase">Offline Client-Side Tools</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-400">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-full text-xs text-teal-400">
              <Lock className="w-3.5 h-3.5" />
              100% Serverless & Safe
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-6xl mx-auto px-4 py-10 w-full flex flex-col gap-10">
        {activeTool === null ? (
          <>
            {/* Hero Section */}
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/10 border border-teal-500/30 rounded-full text-xs text-teal-300 font-semibold">
                <Shield className="w-3.5 h-3.5" />
                Keamanan Data Anda Adalah Prioritas Utama Kami
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Proses File Anda Secara Instan & <span className="text-teal-400">100% Privat</span>
              </h2>
              <p className="text-slate-400 text-sm sm:text-base">
                Takut file sensitif Anda di-upload ke server online? AnyTools menggunakan kekuatan komputer Anda sendiri (melalui browser) untuk memproses data. Tidak ada data yang dikirim ke internet.
              </p>
            </div>

            {/* Active Tools Dashboard Section */}
            <section className="space-y-6 max-w-4xl mx-auto w-full">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Pilih Alat yang Tersedia</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 1: Audio Splitter */}
                <div 
                  onClick={() => setActiveTool('splitter')}
                  className="bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/60 hover:border-teal-500/50 p-6 rounded-2xl cursor-pointer transition duration-200 group flex flex-col justify-between h-48"
                >
                  <div className="space-y-3">
                    <div className="bg-teal-500/15 text-teal-400 w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition duration-200">
                      <Scissors className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-white group-hover:text-teal-400 transition">Audio Splitter (Lossless)</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Pecah file MP3 & WAV berdurasi panjang menjadi beberapa bagian dalam hitungan detik secara instan.
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-teal-400 font-semibold flex items-center gap-1 mt-4">
                    Buka Alat →
                  </div>
                </div>

                {/* Card 2: Audio Compressor */}
                <div 
                  onClick={() => setActiveTool('compressor')}
                  className="bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/60 hover:border-teal-500/50 p-6 rounded-2xl cursor-pointer transition duration-200 group flex flex-col justify-between h-48"
                >
                  <div className="space-y-3">
                    <div className="bg-teal-500/15 text-teal-400 w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition duration-200">
                      <Music className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-white group-hover:text-teal-400 transition">Audio Compressor & Converter</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Kompres ukuran dan konversi format file audio (MP3, WAV, AAC, M4A, OGG, WMA) offline.
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-teal-400 font-semibold flex items-center gap-1 mt-4">
                    Buka Alat →
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto w-full">
            {/* Back Navigation Bar */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <button 
                onClick={() => setActiveTool(null)}
                className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-lg transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Dashboard
              </button>
              
              <div className="text-right">
                <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded">
                  {activeTool === 'splitter' ? 'Audio Splitter' : 'Audio Compressor'}
                </span>
              </div>
            </div>

            {/* Render Selected Tool */}
            {activeTool === 'splitter' && (
              <div className="space-y-4">
                <div className="text-center max-w-2xl mx-auto space-y-1">
                  <h3 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                    <Scissors className="w-6 h-6 text-teal-400" />
                    Audio Splitter (Lossless)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pecah file MP3 & WAV berdurasi panjang menjadi beberapa bagian dalam hitungan detik.
                  </p>
                </div>
                <AudioSplitter />
              </div>
            )}

            {activeTool === 'compressor' && (
              <div className="space-y-4">
                <div className="text-center max-w-2xl mx-auto space-y-1">
                  <h3 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
                    <Music className="w-6 h-6 text-teal-400" />
                    Audio Compressor & Converter
                  </h3>
                  <p className="text-xs text-slate-400">
                    Kompres dan konversi format file audio serta atur sample rate dan bitrate secara offline.
                  </p>
                </div>
                <AudioCompressor />
              </div>
            )}
          </div>
        )}

        {/* Informational grid about the client-side mechanism */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto pt-6 border-t border-slate-800 w-full">
          <div className="bg-slate-850 p-5 rounded-xl border border-slate-800 space-y-2">
            <div className="text-teal-400 font-bold flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Tanpa Server
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tidak ada backend, database, atau penyimpanan cloud. Aplikasi ini berjalan sepenuhnya di browser Anda. Anda bahkan bisa mematikan koneksi internet setelah membuka halaman ini.
            </p>
          </div>

          <div className="bg-slate-850 p-5 rounded-xl border border-slate-800 space-y-2">
            <div className="text-teal-400 font-bold flex items-center gap-2">
              <Sliders className="w-4 h-4" />
              Kecepatan Maksimal (Lossless)
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Alih-alih melakukan decode ulang audio yang memakan waktu dan RAM besar, kami membelah frame file audio Anda secara langsung (binary slicing). Hasilnya instan tanpa mengurangi kualitas suara sedikit pun.
            </p>
          </div>

          <div className="bg-slate-850 p-5 rounded-xl border border-slate-800 space-y-2">
            <div className="text-teal-400 font-bold flex items-center gap-2">
              <Info className="w-4 h-4" />
              Mendukung File Besar
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sangat cocok untuk rekaman rapat, podcast, kuliah, atau audio book berdurasi berjam-jam (misalnya 120 menit) tanpa batas ukuran file dan bebas crash.
            </p>
          </div>
        </section>

        {/* Other Tools / Coming Soon Section */}
        {activeTool === null && (
          <section className="max-w-4xl mx-auto space-y-4 w-full">
            <h3 className="text-base font-bold text-slate-400 uppercase tracking-wider">Alat Lainnya (Akan Datang)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { title: 'Video Compressor', desc: 'Kompres video MP4 secara lokal' },
                { title: 'PDF Tools', desc: 'Gabung, pisah, atau proteksi file PDF' },
                { title: 'Image Converter', desc: 'Ubah format gambar PNG, JPG, WebP offline' },
              ].map((tool, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-xl opacity-60 hover:opacity-80 transition duration-150 relative overflow-hidden group">
                  <span className="absolute top-2 right-2 text-[9px] font-semibold text-slate-500 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded">
                    Segera Hadir
                  </span>
                  <h4 className="font-bold text-sm text-slate-200 mt-2">{tool.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">{tool.desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 mt-12 bg-slate-950/40 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 AnyTools. Berjalan 100% lokal di browser Anda.</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-400 cursor-pointer">Kebijakan Privasi</span>
            <span>•</span>
            <span className="hover:text-slate-400 cursor-pointer">Tentang</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
