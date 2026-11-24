import React, { useEffect, useRef, useState } from 'react';
import { Camera, Flashlight, X } from 'lucide-react';

// Región del marco guía (fracciones del encuadre). Se reutiliza como recorte inicial.
export const GUIDE_RECT = { x: 0.1, y: 0.3, w: 0.8, h: 0.4 };

/**
 * Cámara en vivo con marco guía. Al capturar entrega el fotograma completo (File JPEG)
 * junto con la región del marco, para abrir el editor de recorte ya encuadrado.
 */
export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Este navegador no permite usar la cámara en vivo (requiere HTTPS). Usa “Subir imagen”.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const track = stream.getVideoTracks()[0];
        setCanTorch(!!track.getCapabilities?.().torch);
        setReady(true);
      } catch (e) {
        setError(
          e.name === 'NotAllowedError'
            ? 'Permiso de cámara denegado. Habilítalo en el navegador o usa “Subir imagen”.'
            : e.message || 'No se pudo abrir la cámara.'
        );
      }
    };

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(!torchOn);
    } catch {
      setCanTorch(false);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `captura_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file, GUIDE_RECT);
      },
      'image/jpeg',
      0.95
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-3 text-white">
        <span className="font-semibold">Enfoca el texto dentro del marco</span>
        <button onClick={onClose} aria-label="Cerrar cámara" className="rounded-full bg-white/15 p-2">
          <X size={20} />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden px-2">
        {error ? (
          <p className="max-w-sm rounded-lg bg-red-900/80 p-4 text-center text-white">{error}</p>
        ) : (
          <div className="relative inline-block">
            <video
              ref={videoRef}
              playsInline
              muted
              className="block max-h-[70vh] max-w-full bg-neutral-900"
            />
            {ready && (
              <div
                className="pointer-events-none absolute rounded-lg border-2 border-emerald-400"
                style={{
                  left: `${GUIDE_RECT.x * 100}%`,
                  top: `${GUIDE_RECT.y * 100}%`,
                  width: `${GUIDE_RECT.w * 100}%`,
                  height: `${GUIDE_RECT.h * 100}%`,
                  boxShadow: '0 0 0 100vmax rgba(0,0,0,.45)',
                }}
              />
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 p-5 pb-8">
        {canTorch && (
          <button
            onClick={toggleTorch}
            aria-label="Linterna"
            className={`rounded-full p-3 ${torchOn ? 'bg-yellow-400 text-black' : 'bg-white/15 text-white'}`}
          >
            <Flashlight size={22} />
          </button>
        )}
        <button
          onClick={capture}
          disabled={!ready}
          aria-label="Capturar"
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/90 text-black disabled:opacity-40"
        >
          <Camera size={26} />
        </button>
      </div>
    </div>
  );
}
