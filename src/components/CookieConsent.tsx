import { useState, useEffect } from 'react';
import { Cookie, ShieldCheck, Settings, X, Check, XCircle } from 'lucide-react';

export interface CookiePreferences {
  essential: boolean; // Selalu true
  functional: boolean;
  analytics: boolean;
  timestamp: number;
}

const STORAGE_KEY = 'anytools_cookie_consent_v1';

interface CookieConsentProps {
  forceOpen?: boolean;
  onCloseModal?: () => void;
}

export default function CookieConsent({ forceOpen, onCloseModal }: CookieConsentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    functional: false,
    analytics: false,
    timestamp: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      setIsOpen(true);
    } else {
      try {
        const parsed = JSON.parse(saved);
        setPreferences(parsed);
      } catch {
        setIsOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      setShowDetails(true);
    }
  }, [forceOpen]);

  const saveConsent = (prefs: CookiePreferences) => {
    const updated = { ...prefs, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setPreferences(updated);
    setIsOpen(false);
    setShowDetails(false);
    if (onCloseModal) onCloseModal();
  };

  const handleAcceptAll = () => {
    saveConsent({
      essential: true,
      functional: true,
      analytics: true,
      timestamp: Date.now(),
    });
  };

  const handleRejectAll = () => {
    saveConsent({
      essential: true,
      functional: false,
      analytics: false,
      timestamp: Date.now(),
    });
  };

  const handleSaveCustom = () => {
    saveConsent(preferences);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6 flex justify-center pointer-events-none">
      <div 
        style={{ backgroundColor: '#ffffff', color: '#1e293b', borderColor: '#cbd5e1' }}
        className="border shadow-[0_12px_45px_rgba(0,0,0,0.22)] rounded-2xl max-w-3xl w-full p-5 sm:p-6 pointer-events-auto transition-all duration-300 space-y-4"
      >
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div 
              style={{ backgroundColor: '#e2e8f0', color: '#0f172a' }}
              className="p-2.5 rounded-xl flex-shrink-0"
            >
              <Cookie className="w-6 h-6 text-slate-800" />
            </div>
            <div>
              <h3 
                style={{ color: '#0f172a' }}
                className="font-extrabold text-base sm:text-lg flex items-center gap-2"
              >
                Pemberitahuan Cookie & Privasi
                <span 
                  style={{ backgroundColor: '#f1f5f9', color: '#334155', borderColor: '#cbd5e1' }}
                  className="text-[10px] font-bold border px-2 py-0.5 rounded-full uppercase tracking-wider"
                >
                  GDPR COMPLIANT
                </span>
              </h3>
              <p 
                style={{ color: '#475569' }}
                className="text-xs mt-0.5 font-medium"
              >
                Sesuai dengan regulasi perlindungan data Uni Eropa (GDPR & ePrivacy Directive).
              </p>
            </div>
          </div>

          {forceOpen && (
            <button
              onClick={() => {
                setIsOpen(false);
                if (onCloseModal) onCloseModal();
              }}
              style={{ color: '#64748b' }}
              className="p-1.5 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Clear, High-Contrast Description */}
        <p 
          style={{ color: '#334155' }}
          className="text-xs sm:text-sm leading-relaxed font-normal"
        >
          AnyTools adalah aplikasi <strong>offline client-side</strong>. Berkas dokumen, audio, dan video Anda diproses <strong>100% lokal di browser Anda</strong> tanpa pernah dikirim ke internet atau server kami. Kami menggunakan cookies dan penyimpanan lokal untuk menjaga kelancaran sistem WebAssembly dan mengingat preferensi alat Anda.
        </p>

        {/* Detailed Options (Expandable) */}
        {showDetails && (
          <div 
            style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}
            className="border rounded-xl p-4 space-y-3.5 text-xs animate-fadeIn"
          >
            {/* Essential */}
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
              <div className="space-y-1 pr-2">
                <div className="flex items-center gap-2">
                  <span style={{ color: '#0f172a' }} className="font-bold text-sm">Cookie Esensial (Wajib)</span>
                  <span 
                    style={{ backgroundColor: '#e2e8f0', color: '#475569' }}
                    className="text-[10px] px-2 py-0.5 rounded font-semibold"
                  >
                    Selalu Aktif
                  </span>
                </div>
                <p style={{ color: '#475569' }} className="leading-relaxed">
                  Diperlukan untuk fungsionalitas dasar aplikasi web, kestabilan WebAssembly (FFmpeg / PDF.js), dan menyimpan pilihan persetujuan privasi ini. Tidak mengumpulkan data identitas pribadi.
                </p>
              </div>
              <div className="flex items-center h-6 flex-shrink-0">
                <span style={{ color: '#047857' }} className="font-bold flex items-center gap-1 text-xs">
                  <Check className="w-4 h-4" /> Wajib
                </span>
              </div>
            </div>

            {/* Functional */}
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
              <div className="space-y-1 pr-2">
                <span style={{ color: '#0f172a' }} className="font-bold text-sm">Cookie Preferensi & Fungsionalitas</span>
                <p style={{ color: '#475569' }} className="leading-relaxed">
                  Menyimpan konfigurasi pengguna lokal (seperti tingkat kompresi video/audio terakhir, tab yang aktif) agar Anda tidak perlu mengaturnya ulang saat membuka kembali web ini.
                </p>
              </div>
              <div className="flex items-center h-6 flex-shrink-0">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.functional}
                    onChange={(e) => setPreferences({ ...preferences, functional: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
                </label>
              </div>
            </div>

            {/* Analytics */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 pr-2">
                <span style={{ color: '#0f172a' }} className="font-bold text-sm">Cookie Pengukuran Kinerja / Analitik Anonim</span>
                <p style={{ color: '#475569' }} className="leading-relaxed">
                  Membantu mengidentifikasi bug atau eror pemrosesan browser secara agregat tanpa melacak data pribadi atau identitas Anda di situs web lain.
                </p>
              </div>
              <div className="flex items-center h-6 flex-shrink-0">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Buttons / Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-slate-200">
          <div>
            {!showDetails ? (
              <button
                type="button"
                onClick={() => setShowDetails(true)}
                style={{ color: '#475569' }}
                className="text-xs hover:text-slate-900 font-semibold flex items-center gap-1.5 transition underline hover:no-underline"
              >
                <Settings className="w-3.5 h-3.5 text-slate-700" />
                <span>Atur Preferensi</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                style={{ color: '#475569' }}
                className="text-xs hover:text-slate-900 font-semibold transition underline"
              >
                Sembunyikan Rincian
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 w-full sm:w-auto">
            {/* Reject All Button (Tolak Semua) */}
            <button
              type="button"
              onClick={handleRejectAll}
              style={{ backgroundColor: '#ffffff', color: '#b91c1c', borderColor: '#fca5a5' }}
              className="flex-1 sm:flex-none px-4 py-2 hover:bg-red-50 font-bold text-xs border rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <XCircle className="w-4 h-4 text-red-600" />
              <span>Tolak Semua (Reject)</span>
            </button>

            {/* Custom save if open */}
            {showDetails && (
              <button
                type="button"
                onClick={handleSaveCustom}
                style={{ backgroundColor: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1' }}
                className="flex-1 sm:flex-none px-4 py-2 hover:bg-slate-200 font-bold text-xs border rounded-xl transition"
              >
                Simpan Pilihan Saya
              </button>
            )}

            {/* Accept All Button (Terima Semua) */}
            <button
              type="button"
              onClick={handleAcceptAll}
              style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
              className="flex-1 sm:flex-none px-5 py-2 hover:bg-slate-800 font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>Terima Semua (Accept)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
