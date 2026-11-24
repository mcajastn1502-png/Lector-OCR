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
      if (mode === 'label') {
        out = adaptiveThreshold(stretchContrast(boxBlur(gray, w, h, 1)), w, h);
      }

      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        data[i] = data[i + 1] = data[i + 2] = out[p];
        data[i + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
  });
};

// Estira el histograma usando percentiles 1 % y 99 % (ignora brillos/sombras extremos)
function stretchContrast(gray) {
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
function boxBlur(src, w, h, r) {
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
function adaptiveThreshold(gray, w, h) {
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
