/**
 * Preprocesa la foto para OCR.
 *  - 'label'    : etiquetas/códigos sobre superficies con textura. Gris + estiramiento de
 *                 contraste + suavizado + umbral adaptativo (deja solo el texto oscuro).
 *  - 'document' : solo escala de grises (hojas impresas, buen contraste).
 */
export const preprocessImage = (file, mode = 'label') => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_WIDTH = 1600;
      const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // Escala de grises (luminancia)
      const gray = new Float32Array(w * h);
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }

      let out = gray;
      let ow = w;
      let oh = h;
      if (mode === 'label') {
        const bin = adaptiveThreshold(stretchContrast(boxBlur(gray, w, h, 1)), w, h);
        ({ pixels: out, w: ow, h: oh } = normalizeLabel(bin, w, h));
      }

      const outCanvas = document.createElement('canvas');
      outCanvas.width = ow;
      outCanvas.height = oh;
      const octx = outCanvas.getContext('2d');
      const outData = octx.createImageData(ow, oh);
      for (let i = 0, p = 0; i < outData.data.length; i += 4, p++) {
        outData.data[i] = outData.data[i + 1] = outData.data[i + 2] = out[p];
        outData.data[i + 3] = 255;
      }
      octx.putImageData(outData, 0, 0);
      resolve(outCanvas.toDataURL('image/png'));
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
  });
};

// Estira el histograma usando percentiles 1 % y 99 % (ignora brillos/sombras extremos)
export function stretchContrast(gray) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i] | 0]++;
  const lo = percentile(hist, gray.length, 0.01);
  const hi = percentile(hist, gray.length, 0.99);
  const range = Math.max(1, hi - lo);
  const out = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = Math.min(255, Math.max(0, ((gray[i] - lo) * 255) / range));
  }
  return out;
}

function percentile(hist, total, q) {
  let acc = 0;
  const target = total * q;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= target) return v;
  }
  return 255;
}

// Suavizado por promedio (radio r) para atenuar rayones finos
export function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w) { s += src[y * w + xx]; n++; }
      }
      tmp[y * w + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++; }
      }
      out[y * w + x] = s / n;
    }
  }
  return out;
}

// Umbral adaptativo (Bradley): un píxel es "tinta" si es notablemente más oscuro que su entorno
export function adaptiveThreshold(gray, w, h) {
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + row;
    }
  }
  const half = Math.max(8, Math.round(Math.min(w, h) / 16));
  const ratio = 0.85; // más oscuro que el 85 % de la media local => texto
  const out = new Float32Array(gray.length);
  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - half);
    const y2 = Math.min(h - 1, y + half);
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - half);
      const x2 = Math.min(w - 1, x + half);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * (w + 1) + (x2 + 1)] -
        integral[y1 * (w + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (w + 1) + x1] +
        integral[y1 * (w + 1) + x1];
      out[y * w + x] = gray[y * w + x] * count < sum * ratio ? 0 : 255;
    }
  }
  return out;
}


/**
 * Limpia y normaliza una imagen binaria (tinta = 0, fondo = 255) para el OCR:
 *  1. Elimina manchas diminutas y rayas largas y finas (bordes, rayones).
 *  2. Recorta ajustado al texto restante.
 *  3. Reescala para que las letras midan ~TARGET_H px de alto (el OCR rinde mejor así).
 *  4. Agrega un margen blanco alrededor.
 * Devuelve { pixels (gris 0-255), w, h }. Si no encuentra texto, devuelve la imagen igual.
 */
export const TARGET_H = 32;
const PAD = 30;

export function normalizeLabel(bin, w, h, targetH = TARGET_H) {
  const { comps, labels } = findComponents(bin, w, h);
  const minArea = Math.max(8, w * h * 0.00015);
  const keep = comps.filter((c) => {
    const bw = c.maxX - c.minX + 1;
    const bh = c.maxY - c.minY + 1;
    const thin = Math.max(bw / bh, bh / bw) > 20; // raya larga y fina
    return c.area >= minArea && !thin;
  });
  if (keep.length === 0) return { pixels: bin, w, h };

  const heights = keep.map((c) => c.maxY - c.minY + 1).sort((a, b) => a - b);
  const medianH = heights[heights.length >> 1];

  // Banda de texto = zona vertical de las letras grandes. Un trazo pequeño solo se conserva
  // (guion, punto, tilde) si está dentro de la banda y pegado a otra letra; el resto es mancha.
  const big = keep.filter((c) => c.maxY - c.minY + 1 >= medianH * 0.5);
  const bandTop = Math.min(...big.map((c) => c.minY));
  const bandBottom = Math.max(...big.map((c) => c.maxY));
  const isSmall = (c) => c.maxY - c.minY + 1 < medianH * 0.5;
  const hGap = (a, b) => Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX) - 1);
  const vGap = (a, b) => Math.max(0, Math.max(a.minY, b.minY) - Math.min(a.maxY, b.maxY) - 1);
  const cleaned = keep.filter((c) => {
    if (!isSmall(c)) return true;
    const cy = (c.minY + c.maxY) / 2;
    if (cy < bandTop - medianH * 0.3 || cy > bandBottom + medianH * 0.1) return false;
    return big.some((b) => hGap(c, b) <= medianH * 0.45 && vGap(c, b) <= medianH * 0.6);
  });
  keep.length = 0;
  keep.push(...cleaned);

  let minX = w, minY = h, maxX = 0, maxY = 0;
  const keepIds = new Set();
  for (const c of keep) {
    keepIds.add(c.id);
    minX = Math.min(minX, c.minX);
    minY = Math.min(minY, c.minY);
    maxX = Math.max(maxX, c.maxX);
    maxY = Math.max(maxY, c.maxY);
  }
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;

  // Recorte con solo la tinta conservada (255 = fondo)
  const cropped = new Float32Array(cw * ch).fill(255);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (keepIds.has(labels[y * w + x])) cropped[(y - minY) * cw + (x - minX)] = 0;
    }
  }

  const scale = Math.min(3, Math.max(0.15, targetH / medianH));
  const sw = Math.max(1, Math.round(cw * scale));
  const sh = Math.max(1, Math.round(ch * scale));
  const W = sw + PAD * 2;
  const H = sh + PAD * 2;
  const pixels = new Float32Array(W * H).fill(255);
  for (let y = 0; y < sh; y++) {
    const y0 = Math.floor(y / scale);
    const y1 = Math.min(ch, Math.max(y0 + 1, Math.ceil((y + 1) / scale)));
    for (let x = 0; x < sw; x++) {
      const x0 = Math.floor(x / scale);
      const x1 = Math.min(cw, Math.max(x0 + 1, Math.ceil((x + 1) / scale)));
      let sum = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          sum += cropped[yy * cw + xx];
          n++;
        }
      }
      pixels[(y + PAD) * W + x + PAD] = sum / n;
    }
  }
  return { pixels, w: W, h: H };
}

// Componentes conexas (8 vecinos) de los píxeles de tinta (valor 0)
function findComponents(bin, w, h) {
  const labels = new Int32Array(w * h); // 0 = sin etiqueta; ids desde 1
  const stack = new Int32Array(w * h);
  const comps = [];
  let id = 0;
  for (let start = 0; start < bin.length; start++) {
    if (bin[start] !== 0 || labels[start]) continue;
    id++;
    const c = { id, minX: w, minY: h, maxX: 0, maxY: 0, area: 0 };
    let sp = 0;
    stack[sp++] = start;
    labels[start] = id;
    while (sp > 0) {
      const p = stack[--sp];
      const x = p % w;
      const y = (p - x) / w;
      c.area++;
      if (x < c.minX) c.minX = x;
      if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y;
      if (y > c.maxY) c.maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const q = yy * w + xx;
          if (bin[q] === 0 && !labels[q]) {
            labels[q] = id;
            stack[sp++] = q;
          }
        }
      }
    }
    comps.push(c);
  }
  return { comps, labels };
}

/** Recorta un archivo de imagen a una región (fracciones 0-1) y devuelve un File JPEG. */
export function cropFileByRect(file, rect, quality = 0.95) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const sx = Math.round(img.naturalWidth * rect.x);
      const sy = Math.round(img.naturalHeight * rect.y);
      const sw = Math.max(1, Math.round(img.naturalWidth * rect.w));
      const sh = Math.max(1, Math.round(img.naturalHeight * rect.h));
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(new File([blob], `recorte_${Date.now()}.jpg`, { type: 'image/jpeg' }))
            : reject(new Error('No se pudo recortar la imagen')),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo abrir la imagen'));
    };
    img.src = url;
  });
}
