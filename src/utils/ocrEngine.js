import Tesseract from 'tesseract.js';

// Motor OCR reutilizable. Los recursos (worker, núcleo WASM e idiomas) se sirven desde
// /tesseract de la propia app: sin CDN y cacheados por el service worker.
const base = `${import.meta.env.BASE_URL}tesseract`;

const engines = new Map(); // idioma -> Promise<worker>
let listener = null;

function getEngine(lang) {
  if (!engines.has(lang)) {
    const p = Tesseract.createWorker(lang, 1, {
      workerPath: `${base}/worker.min.js`,
      corePath: `${base}/core`,
      langPath: `${base}/lang`,
      logger: (m) => listener?.(m),
    }).catch((e) => {
      engines.delete(lang); // permite reintentar si falló la carga
      throw e;
    });
    engines.set(lang, p);
  }
  return engines.get(lang);
}

/** Carga el motor en segundo plano para que la primera lectura sea inmediata. */
export function preloadEngine(lang) {
  return getEngine(lang).catch(() => {});
}

/**
 * Lee el texto de una imagen reutilizando el motor ya cargado.
 * psm: '11' texto disperso (etiquetas) · '3' página completa (documentos)
 */
export async function recognizeText(image, { lang, psm, onProgress }) {
  const worker = await getEngine(lang);
  listener = (m) => {
    if (m.status === 'recognizing text') onProgress?.(Math.round(m.progress * 100));
  };
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: '1',
  });
  const result = await worker.recognize(image);
  return result.data.text;
}
