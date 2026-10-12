import { ShieldCheck, Lock, X, CheckCircle, Cookie } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCookieSettings: () => void;
}

export default function PrivacyModal({ isOpen, onClose, onOpenCookieSettings }: PrivacyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div 
        style={{ backgroundColor: '#ffffff', color: '#1e293b', borderColor: '#cbd5e1' }}
        className="border rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div 
          style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}
          className="p-5 border-b flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <div 
              style={{ backgroundColor: '#e2e8f0', color: '#0f172a' }}
              className="p-2 rounded-lg"
            >
              <ShieldCheck className="w-5 h-5 text-slate-800" />
            </div>
            <div>
              <h3 style={{ color: '#0f172a' }} className="font-extrabold text-base">Kebijakan Privasi & Perlindungan Data</h3>
              <p style={{ color: '#475569' }} className="text-[11px] font-bold uppercase tracking-wider">Kepatuhan GDPR / Privasi Uni Eropa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: '#64748b' }}
            className="p-1.5 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm leading-relaxed" style={{ color: '#334155' }}>
          <div 
            style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}
            className="border rounded-xl p-4 flex gap-3"
          >
            <Lock className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-700" />
            <div>
              <p className="font-bold text-sm mb-1 text-green-900">Prinsip Nol Server (Zero-Knowledge & Zero-Upload)</p>
              <p className="text-xs leading-relaxed text-green-800">
                AnyTools dirancang dengan prinsip <em>Privacy-by-Design</em> sesuai dengan Pasal 25 Regulasi Perlindungan Data Umum Uni Eropa (GDPR). Berkas dokumen PDF, audio, maupun video Anda tidak pernah meninggalkan komputer Anda.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <h4 style={{ color: '#0f172a' }} className="font-bold text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              1. Pemrosesan Data Berkas (PDF, Audio, Video)
            </h4>
            <p style={{ color: '#475569' }} className="text-xs">
              Semua konversi, pemotongan, dan kompresi dijalankan langsung di mesin peramban web Anda menggunakan teknologi WebAssembly (FFmpeg Wasm dan PDF.js). Tidak ada server perantara, tidak ada antrean cloud, dan kami tidak memiliki akses apa pun terhadap isi dokumen atau media Anda.
            </p>
          </div>

          <div className="space-y-1.5">
            <h4 style={{ color: '#0f172a' }} className="font-bold text-sm flex items-center gap-2">
              <Cookie className="w-4 h-4 text-amber-600" />
              2. Penggunaan Cookie & Penyimpanan Lokal
            </h4>
            <p style={{ color: '#475569' }} className="text-xs">
              Sesuai dengan <em>ePrivacy Directive</em> Uni Eropa, kami hanya menggunakan penyimpanan lokal (cookies / LocalStorage) untuk:
            </p>
            <ul style={{ color: '#475569' }} className="list-disc list-inside text-xs space-y-1 ml-2">
              <li><strong>Esensial</strong>: Menyimpan status persetujuan privasi dan inisialisasi modul WebAssembly.</li>
              <li><strong>Fungsional</strong>: Mengingat pengaturan preferensi terakhir Anda (seperti pilihan kompresi atau format target).</li>
            </ul>
            <p style={{ color: '#475569' }} className="text-xs mt-1">
              Kami <strong>tidak pernah</strong> menggunakan cookie pihak ketiga untuk pelacakan lintas situs atau periklanan tertarget.
            </p>
          </div>

          <div className="space-y-1.5">
            <h4 style={{ color: '#0f172a' }} className="font-bold text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              3. Hak-Hak Anda Berdasarkan GDPR
            </h4>
            <p style={{ color: '#475569' }} className="text-xs">
              Anda berhak meninjau, mengubah, atau mencabut persetujuan cookie kapan saja melalui tombol <em>Pengaturan Cookie</em> yang selalu tersedia di bagian bawah situs ini.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div 
          style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}
          className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3"
        >
          <button
            onClick={() => {
              onClose();
              onOpenCookieSettings();
            }}
            style={{ color: '#0284c7' }}
            className="text-xs hover:text-sky-800 font-bold underline sm:no-underline sm:hover:underline"
          >
            Buka Pengaturan Cookie
          </button>
          <button
            onClick={onClose}
            style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
            className="w-full sm:w-auto px-5 py-2 hover:bg-slate-800 font-bold text-xs rounded-xl transition"
          >
            Saya Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
