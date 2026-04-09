import { useEffect, useRef, useState } from 'react';

function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const detectedRef = useRef(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Iniciando cámara...');

  useEffect(() => {
    let cancelled = false;

    async function startScanner() {
      try {
        // Dynamic import to avoid loading @zxing/library until the scanner is opened
        const { BrowserMultiFormatReader, NotFoundException } = await import('@zxing/library');

        if (cancelled) return;

        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        setStatus('Apunta al código de barras del libro');

        await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result, err) => {
            if (cancelled || detectedRef.current) return;

            if (result) {
              const text = result.getText();
              const clean = text.replace(/[^0-9X]/gi, '');
              if (clean.length === 10 || clean.length === 13) {
                detectedRef.current = true;
                setStatus('✓ ISBN detectado');
                onDetected(clean);
              }
            }
            // NotFoundException is normal — no barcode in current frame
            if (err && !(err instanceof NotFoundException)) {
              console.warn('BarcodeScanner decode error:', err.message);
            }
          }
        );
      } catch (err) {
        if (cancelled) return;
        if (err.name === 'NotAllowedError') {
          setError('Permiso de cámara denegado. Permite el acceso en los ajustes del navegador.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No se encontró ninguna cámara en este dispositivo.');
        } else if (err.name === 'NotReadableError') {
          setError('La cámara está siendo usada por otra aplicación.');
        } else {
          setError('Error al acceder a la cámara: ' + err.message);
        }
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      if (readerRef.current) {
        readerRef.current.reset();
        readerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📷 Escanear ISBN</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX /></button>
        </div>

        {error ? (
          <>
            <div className="alert alert-error" style={{ margin: '4px 0 16px' }}>{error}</div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
            </div>
          </>
        ) : (
          <>
            <div className="scanner-viewport">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', display: 'block', borderRadius: 8, background: '#000' }}
              />
              {/* Targeting overlay */}
              <div className="scanner-overlay">
                <div className="scanner-frame">
                  <div className="scanner-line" />
                  {/* Corner accents */}
                  <span className="corner tl" />
                  <span className="corner tr" />
                  <span className="corner bl" />
                  <span className="corner br" />
                </div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 10, textAlign: 'center' }}>
              {status}
            </p>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancelar</button>
            </div>
          </>
        )}

        <style>{`
          .scanner-viewport { position: relative; border-radius: 8px; overflow: hidden; background: #000; }
          .scanner-overlay {
            position: absolute; inset: 0;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,.4);
            pointer-events: none;
          }
          .scanner-frame {
            position: relative;
            width: 78%; height: 90px;
            border-radius: 6px;
            box-shadow: 0 0 0 9999px rgba(0,0,0,.45);
          }
          .scanner-line {
            position: absolute; left: 0; right: 0; height: 2px;
            background: rgba(20,184,166,.9);
            box-shadow: 0 0 10px rgba(20,184,166,.7);
            animation: scan-move 2s ease-in-out infinite;
          }
          @keyframes scan-move { 0%,100% { top: 2px; } 50% { top: calc(100% - 4px); } }
          .corner {
            position: absolute; width: 14px; height: 14px;
            border-color: rgba(20,184,166,.9); border-style: solid;
          }
          .corner.tl { top: -2px; left: -2px; border-width: 3px 0 0 3px; border-radius: 4px 0 0 0; }
          .corner.tr { top: -2px; right: -2px; border-width: 3px 3px 0 0; border-radius: 0 4px 0 0; }
          .corner.bl { bottom: -2px; left: -2px; border-width: 0 0 3px 3px; border-radius: 0 0 0 4px; }
          .corner.br { bottom: -2px; right: -2px; border-width: 0 3px 3px 0; border-radius: 0 0 4px 0; }
        `}</style>
      </div>
    </div>
  );
}
