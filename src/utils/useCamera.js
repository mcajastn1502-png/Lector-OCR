import { useEffect, useRef, useState } from 'react';

/** Cámara trasera en vivo: abre al montar, se apaga al desmontar y controla la linterna. */
export function useCamera() {
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
        if (cancelled) return;
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

  return { videoRef, error, ready, canTorch, torchOn, toggleTorch };
}
