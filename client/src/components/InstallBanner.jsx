import { useEffect, useState } from 'react';

const DISMISSED_KEY = 'pwa_banner_dismissed';

export default function InstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [showIOS, setShowIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Already installed as PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    // Android / Chrome: intercept install prompt
    function handleBeforeInstall(e) {
      e.preventDefault();
      setPrompt(e);
      setVisible(true);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // iOS Safari: no prompt event, show manual instructions
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isIOS && isSafari) {
      setShowIOS(true);
      setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      dismiss();
    } else {
      setPrompt(null);
      setVisible(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="install-banner">
      <span className="install-banner-icon">📱</span>
      <div className="install-banner-text">
        {showIOS && !prompt ? (
          <>
            Instala la app: pulsa <strong>Compartir</strong> y luego{' '}
            <strong>Añadir a la pantalla de inicio</strong>
          </>
        ) : (
          <>¡Instala Stanley Log en tu móvil para usarla sin conexión!</>
        )}
      </div>
      {prompt && (
        <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={install}>
          Instalar
        </button>
      )}
      <button
        className="btn btn-ghost btn-icon"
        onClick={dismiss}
        title="Cerrar"
        style={{ flexShrink: 0, fontSize: 16, color: 'var(--gray-400)' }}
      >
        ✕
      </button>

      <style>{`
        .install-banner {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: white;
          border-top: 1.5px solid var(--teal-100);
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          z-index: 200;
          box-shadow: 0 -4px 20px rgba(0,0,0,.08);
          animation: slideUp .25s ease;
        }
        .install-banner-icon { font-size: 20px; flex-shrink: 0; }
        .install-banner-text { flex: 1; font-size: 13px; color: var(--gray-700); line-height: 1.4; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: none; } }
        @media(min-width: 701px) { .install-banner { left: 224px; } }
      `}</style>
    </div>
  );
}
