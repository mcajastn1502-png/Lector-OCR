import React, { useEffect, useRef, useState } from 'react';
import { Flashlight, Undo2, X } from 'lucide-react';
import { useCamera } from '../utils/useCamera';
import { readCodes } from '../utils/barcode';

const GUIDE = { x: 0.08, y: 0.2, w: 0.84, h: 0.6 };
const SCAN_EVERY_MS = 150;
const CONFIRM_FRAMES = 2; // lecturas seguidas iguales antes de aceptar (evita lecturas parciales)

let audioCtx;
function feedback(ok) {
  navigator.vibrate?.(ok ? 80 : [40, 60, 40]);
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = ok ? 1200 : 300;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch {
    /* sin audio */
  }
}

/**
 * Escáner en vivo de códigos de barras y QR.
 *  - Continuo: cada código nuevo se agrega solo al registro (onAdd). Si en el cuadro hay
 *    varios códigos, no agrega nada solo: los muestra para que el usuario elija.
 *  - Normal: al detectar, devuelve los códigos (onResult) para revisarlos antes de agregar.
 */
export default function BarcodeScanner({ continuous, onContinuousChange, onResult, onAdd, onUndo, onClose }) {
  const { videoRef, error, ready, canTorch, torchOn, toggleTorch } = useCamera();
  const [choices, setChoices] = useState([]); // códigos a elegir cuando hay varios a la vez
  const [last, setLast] = useState(null); // { ok, msg }
  const [added, setAdded] = useState([]); // ids agregados en esta sesión de escaneo
  const [readError, setReadError] = useState('');

  const handled = useRef(new Set()); // valores ya procesados: no se repiten mientras siga abierto
  const streak = useRef({ key: '', n: 0 });
  const paused = useRef(false);
  const props = useRef({});
  props.current = { continuous, onResult, onAdd };

  const addCode = (code) => {
    handled.current.add(code.value);
    const res = props.current.onAdd(code);
    feedback(res.ok);
    setLast({ ok: res.ok, msg: res.ok ? `Agregado: ${code.value}` : `Ya registrado: ${code.value}` });
    if (res.ok) setAdded((a) => [...a, res.id]);
  };

  const handleFrame = (codes) => {
    const key = codes.map((c) => c.value).sort().join('\n');
    streak.current = key && key === streak.current.key ? { key, n: streak.current.n + 1 } : { key, n: key ? 1 : 0 };
    if (streak.current.n < CONFIRM_FRAMES) return;

    if (!props.current.continuous) {
      paused.current = true;
      feedback(true);
      props.current.onResult(codes);
      return;
    }
    const fresh = codes.filter((c) => !handled.current.has(c.value));
    if (fresh.length === 0) return;
    if (codes.length > 1) {
      paused.current = true;
      feedback(true);
      setChoices(fresh);
      return;
    }
    addCode(fresh[0]);
  };

  // Bucle de lectura: un fotograma a la vez, solo la zona del marco
  useEffect(() => {
    if (!ready) return undefined;
    let stop = false;
    let timer;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = async () => {
      const video = videoRef.current;
      if (!paused.current && video?.videoWidth) {
        const sx = Math.round(video.videoWidth * GUIDE.x);
        const sy = Math.round(video.videoHeight * GUIDE.y);
        const sw = Math.round(video.videoWidth * GUIDE.w);
        const sh = Math.round(video.videoHeight * GUIDE.h);
        canvas.width = sw;
        canvas.height = sh;
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
        try {
          const codes = await readCodes(ctx.getImageData(0, 0, sw, sh));
          if (!stop && !paused.current) handleFrame(codes);
        } catch (e) {
          console.error(e);
          if (!stop) setReadError('No se pudo cargar el lector de códigos. Revisa la conexión y vuelve a abrir.');
        }
      }
      if (!stop) timer = setTimeout(tick, SCAN_EVERY_MS);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const resume = (skipped = []) => {
    skipped.forEach((c) => handled.current.add(c.value));
    setChoices([]);
    streak.current = { key: '', n: 0 };
    paused.current = false;
  };

  const pick = (code) => {
    addCode(code);
    const rest = choices.filter((c) => c.value !== code.value);
    if (rest.length) setChoices(rest);
    else resume();
  };

  const undo = () => {
    const id = added[added.length - 1];
    onUndo(id);
    setAdded((a) => a.slice(0, -1));
    setLast({ ok: true, msg: 'Último registro deshecho' });
  };

  const message = error || readError;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="font-semibold">Apunta al código de barras o QR</span>
        <button onClick={onClose} aria-label="Cerrar escáner" className="rounded-full bg-white/15 p-2">
          <X size={20} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2">
        {message ? (
          <p className="max-w-sm rounded-lg bg-red-900/80 p-4 text-center">{message}</p>
        ) : (
          <div className="relative inline-block">
            <video ref={videoRef} playsInline muted className="block max-h-[55vh] max-w-full bg-neutral-900" />
            {ready && (
              <div
                className="pointer-events-none absolute rounded-lg border-2 border-emerald-400"
                style={{
                  left: `${GUIDE.x * 100}%`,
                  top: `${GUIDE.y * 100}%`,
                  width: `${GUIDE.w * 100}%`,
                  height: `${GUIDE.h * 100}%`,
                }}
              />
            )}
          </div>
        )}
      </div>

      <div className="space-y-3 p-4 pb-6">
        {choices.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-lg bg-white/10 p-3">
            <p className="mb-2 text-sm font-semibold">Hay varios códigos. Toca los que quieras agregar:</p>
            {choices.map((c) => (
              <button
                key={c.value}
                onClick={() => pick(c)}
                className="mb-2 block w-full break-all rounded-lg bg-white px-3 py-2 text-left text-sm text-black"
              >
                <span className="mr-2 text-xs font-bold text-sky-700">{c.type}</span>
                {c.value}
              </button>
            ))}
            <button onClick={() => resume(choices)} className="w-full rounded-lg bg-white/20 py-2 text-sm font-semibold">
              Listo, seguir escaneando
            </button>
          </div>
        )}

        {last && (
          <p
            role="status"
            className={`break-all rounded-lg p-3 text-center text-sm font-bold ${last.ok ? 'bg-green-600' : 'bg-amber-600'}`}
          >
            {last.msg}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={continuous}
              onChange={(e) => onContinuousChange(e.target.checked)}
              className="h-5 w-5 accent-emerald-500"
            />
            Escaneo continuo
          </label>
          {canTorch && (
            <button
              onClick={toggleTorch}
              aria-label="Linterna"
              className={`rounded-full p-3 ${torchOn ? 'bg-yellow-400 text-black' : 'bg-white/15'}`}
            >
              <Flashlight size={20} />
            </button>
          )}
        </div>

        {continuous && (
          <div className="flex gap-2">
            <button
              onClick={undo}
              disabled={added.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white/15 py-3 font-semibold disabled:opacity-40"
            >
              <Undo2 size={18} /> Deshacer
            </button>
            <button onClick={onClose} className="flex-1 rounded-lg bg-emerald-500 py-3 font-bold">
              Terminar ({added.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
