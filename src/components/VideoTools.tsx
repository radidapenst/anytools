import { useState } from 'react';
import { Film, Scissors, Image as ImageIcon, Music } from 'lucide-react';
import VideoCompressor from './VideoCompressor';
import VideoTrimmer from './VideoTrimmer';
import VideoToGif from './VideoToGif';
import VideoAudioExtractor from './VideoAudioExtractor';

type VideoSubTool = 'compressor' | 'trimmer' | 'gif' | 'audio';

export default function VideoTools() {
  const [activeSubTool, setActiveSubTool] = useState<VideoSubTool>('compressor');

  return (
    <div className="space-y-6">
      {/* Sub-tool Selection Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 sm:p-3 shadow-xl grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <button
          onClick={() => setActiveSubTool('compressor')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeSubTool === 'compressor'
              ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
              : 'bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
          }`}
        >
          <Film className="w-4 h-4" />
          <span className="truncate">Kompres & Konversi</span>
        </button>

        <button
          onClick={() => setActiveSubTool('trimmer')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeSubTool === 'trimmer'
              ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
              : 'bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span className="truncate">Potong / Trim Video</span>
        </button>

        <button
          onClick={() => setActiveSubTool('gif')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeSubTool === 'gif'
              ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
              : 'bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span className="truncate">Video ke GIF</span>
        </button>

        <button
          onClick={() => setActiveSubTool('audio')}
          className={`flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeSubTool === 'audio'
              ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
              : 'bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
          }`}
        >
          <Music className="w-4 h-4" />
          <span className="truncate">Ekstrak Audio</span>
        </button>
      </div>

      {/* Sub-tool Description Header */}
      <div className="text-center max-w-2xl mx-auto space-y-1">
        {activeSubTool === 'compressor' && (
          <>
            <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
              <Film className="w-5 h-5 text-teal-400" />
              Kompres & Konversi Video MP4
            </h3>
            <p className="text-xs text-slate-400">
              Kecilkan ukuran file video MP4/WebM/MKV dengan mengatur resolusi, CRF, dan audio tanpa watermark secara offline.
            </p>
          </>
        )}

        {activeSubTool === 'trimmer' && (
          <>
            <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
              <Scissors className="w-5 h-5 text-teal-400" />
              Potong & Pangkas Durasi Video
            </h3>
            <p className="text-xs text-slate-400">
              Pilih waktu mulai dan selesai untuk memotong video dengan kecepatan tinggi langsung di peramban Anda.
            </p>
          </>
        )}

        {activeSubTool === 'gif' && (
          <>
            <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
              <ImageIcon className="w-5 h-5 text-teal-400" />
              Konversi Video ke Animasi GIF
            </h3>
            <p className="text-xs text-slate-400">
              Ubah klip video menjadi animasi GIF berkualitas tinggi dengan pengaturan frame rate dan resolusi.
            </p>
          </>
        )}

        {activeSubTool === 'audio' && (
          <>
            <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
              <Music className="w-5 h-5 text-teal-400" />
              Ekstrak Audio dari Video
            </h3>
            <p className="text-xs text-slate-400">
              Ambil audio atau musik latar dari file video dan simpan sebagai file MP3, M4A, atau WAV.
            </p>
          </>
        )}
      </div>

      {/* Render Active Sub-tool */}
      {activeSubTool === 'compressor' && <VideoCompressor />}
      {activeSubTool === 'trimmer' && <VideoTrimmer />}
      {activeSubTool === 'gif' && <VideoToGif />}
      {activeSubTool === 'audio' && <VideoAudioExtractor />}
    </div>
  );
}
