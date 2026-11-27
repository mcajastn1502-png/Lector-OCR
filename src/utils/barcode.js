import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
// El WASM se empaqueta con la app (sin CDN), así queda disponible sin conexión
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

const FORMATS = [
  'QRCode', 'DataMatrix', 'Aztec', 'PDF417',
  'Code128', 'Code39', 'Code93', 'Codabar', 'ITF',
  'EAN13', 'EAN8', 'UPCA', 'UPCE',
];

const LABELS = {
  QRCode: 'QR', DataMatrix: 'Data Matrix', Aztec: 'Aztec', PDF417: 'PDF417',
  Code128: 'Code 128', Code39: 'Code 39', Code93: 'Code 93', Codabar: 'Codabar', ITF: 'ITF',
  EAN13: 'EAN-13', EAN8: 'EAN-8', UPCA: 'UPC-A', UPCE: 'UPC-E',
};

let ready;

/** Carga el lector en segundo plano (se llama al elegir el modo de códigos). */
export function preloadBarcode() {
  if (!ready) {
    ready = Promise.resolve(
      prepareZXingModule({
        overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
        fireImmediately: true,
      })
    ).catch((e) => {
      ready = undefined; // permite reintentar
      throw e;
    });
  }
  return ready;
}

/**
 * Lee todos los códigos de una imagen (ImageData, File o Blob).
 * Devuelve [{ value, type }] sin repetidos.
 */
export async function readCodes(input) {
  await preloadBarcode();
  const results = await readBarcodes(input, { formats: FORMATS, tryHarder: true, maxNumberOfSymbols: 8 });
  const found = new Map();
  for (const r of results) {
    const value = r.text?.trim();
    if (!r.isValid || !value) continue;
    found.set(value, { value, type: LABELS[r.format] || r.format });
  }
  return [...found.values()];
}
