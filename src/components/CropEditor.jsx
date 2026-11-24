import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Maximize, X } from 'lucide-react';

const MIN = 0.05; // tamaño mínimo del recorte (fracción de la imagen)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const HANDLES = [
  { id: 'nw', style: { left: 0, top: 0 }, cursor: 'nwse-resize' },
  { id: 'n', style: { left: '50%', top: 0 }, cursor: 'ns-resize' },
  { id: 'ne', style: { left: '100%', top: 0 }, cursor: 'nesw-resize' },
  { id: 'e', style: { left: '100%', top: '50%' }, cursor: 'ew-resize' },
  { id: 'se', style: { left: '100%', top: '100%' }, cursor: 'nwse-resize' },
  { id: 's', style: { left: '50%', top: '100%' }, cursor: 'ns-resize' },
  { id: 'sw', style: { left: 0, top: '100%' }, cursor: 'nesw-resize' },
  { id: 'w', style: { left: 0, top: '50%' }, cursor: 'ew-resize' },
];

/**
 * Editor de recorte: arrastra el rectángulo o sus esquinas/bordes sobre el texto deseado.
 * onConfirm(fileRecortado, rect) · onCancel()
 */
export default function CropEditor({ file, initial, onConfirm, onCancel }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const [rect, setRect] = useState(initial || { x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const imgRef = useRef(null);
  const drag = useRef(null);

  const start = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const b = imgRef.current.getBoundingClientRect();
    drag.current = { type, sx: e.clientX, sy: e.clientY, r: rect, bw: b.width, bh: b.height };
  };

  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / d.bw;
    const dy = (e.clientY - d.sy) / d.bh;
    let { x, y, w, h } = d.r;

    if (d.type === 'move') {
      x = clamp(d.r.x + dx, 0, 1 - w);
      y = clamp(d.r.y + dy, 0, 1 - h);
    } else {
      if (d.type.includes('w')) {
        const nx = clamp(d.r.x + dx, 0, d.r.x + d.r.w - MIN);
        w = d.r.x + d.r.w - nx;
        x = nx;
      }
      if (d.type.includes('e')) w = clamp(d.r.w + dx, MIN, 1 - d.r.x);
      if (d.type.includes('n')) {
        const ny = clamp(d.r.y + dy, 0, d.r.y + d.r.h - MIN);
        h = d.r.y + d.r.h - ny;
        y = ny;
      }
      if (d.type.includes('s')) h = clamp(d.r.h + dy, MIN, 1 - d.r.y);
    }
    setRect({ x, y, w, h });
  };

  const end = () => {
    drag.current = null;
  };

  const confirm = (full = false) => {
    const img = imgRef.current;
    const r = full ? { x: 0, y: 0, w: 1, h: 1 } : rect;
    const sw = Math.round(img.naturalWidth * r.w);
    const sh = Math.round(img.naturalHeight * r.h);
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    canvas
      .getContext('2d')
      .drawImage(img, Math.round(img.naturalWidth * r.x), Math.round(img.naturalHeight * r.y), sw, sh, 0, 0, sw, sh);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onConfirm(new File([blob], `recorte_${Date.now()}.jpg`, { type: 'image/jpeg' }), r);
      },
      'image/jpeg',
      0.95
    );
  };

  const pct = (v) => `${v * 100}%`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="p-3 text-white">
        <p className="font-semibold">Ajusta el recorte sobre el texto</p>
        <p className="text-xs text-white/70">Arrastra el recuadro o sus esquinas y bordes</p>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden px-3">
        <div className="relative inline-block touch-none select-none">
          <img
            ref={imgRef}
            src={url}
            alt="Imagen a recortar"
            draggable={false}
            className="block max-h-[68vh] max-w-full"
          />
          <div
            onPointerDown={(e) => start(e, 'move')}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            className="absolute cursor-move border-2 border-emerald-400"
            style={{
              left: pct(rect.x),
              top: pct(rect.y),
              width: pct(rect.w),
              height: pct(rect.h),
              boxShadow: '0 0 0 100vmax rgba(0,0,0,.55)',
              touchAction: 'none',
            }}
          >
            {HANDLES.map((h) => (
              <div
                key={h.id}
                onPointerDown={(e) => start(e, h.id)}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                style={{ ...h.style, cursor: h.cursor, touchAction: 'none' }}
              >
                <span className="block h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 p-4 pb-8">
        <button onClick={onCancel} className="flex items-center gap-2 rounded-lg bg-white/15 px-4 py-3 font-semibold text-white">
          <X size={18} /> Cancelar
        </button>
        <button onClick={() => confirm(true)} className="flex items-center gap-2 rounded-lg bg-white/15 px-4 py-3 font-semibold text-white">
          <Maximize size={18} /> Imagen completa
        </button>
        <button onClick={() => confirm(false)} className="flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 font-bold text-white">
          <Check size={18} /> Usar recorte
        </button>
      </div>
    </div>
  );
}
