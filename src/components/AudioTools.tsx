import { useState } from 'react';
import { Scissors, Music } from 'lucide-react';
import AudioSplitter from './AudioSplitter';
import AudioCompressor from './AudioCompressor';

type AudioSubTool = 'splitter' | 'compressor';

export default function AudioTools() {
  const [activeSubTool, setActiveSubTool] = useState<AudioSubTool>('splitter');

  return (
    <div className="space-y-6">
      {/* Sub-tool Selection Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-xl flex items-center justify-center gap-3">
        <button
          onClick={() => setActiveSubTool('splitter')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeSubTool === 'splitter'
              ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
              : 'bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span>Audio Splitter (Lossless)</span>
        </button>

        <button
          onClick={() => setActiveSubTool('compressor')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeSubTool === 'compressor'
              ? 'bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
              : 'bg-slate-850 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-800'
          }`}
        >
          <Music className="w-4 h-4" />
          <span>Audio Compressor & Converter</span>
        </button>
      </div>

      {/* Sub-tool Description Header */}
      <div className="text-center max-w-2xl mx-auto space-y-1">
        {activeSubTool === 'splitter' ? (
          <>
            <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
              <Scissors className="w-5 h-5 text-teal-400" />
              Audio Splitter (Lossless)
            </h3>
            <p className="text-xs text-slate-400">
              Pecah file MP3 & WAV berdurasi panjang menjadi beberapa bagian dalam hitungan detik secara instan.
            </p>
          </>
        ) : (
          <>
            <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
              <Music className="w-5 h-5 text-teal-400" />
              Audio Compressor & Converter
            </h3>
            <p className="text-xs text-slate-400">
              Kompres dan konversi format file audio (MP3, WAV, AAC, M4A, OGG, WMA) serta atur bitrate secara offline.
            </p>
          </>
        )}
      </div>

      {/* Render Active Tool */}
      {activeSubTool === 'splitter' && <AudioSplitter />}
      {activeSubTool === 'compressor' && <AudioCompressor />}
    </div>
  );
}
