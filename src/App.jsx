import React, { useState, useRef, useEffect } from 'react';
import { preloadEngine, recognizeText } from './utils/ocrEngine';
import { Camera, Upload, Loader2, Sun, Moon, Copy, CheckCircle, Crop } from 'lucide-react';
import { preprocessImage, cropFileByRect } from './utils/imageUtils';
import CameraCapture from './components/CameraCapture';
import CropEditor from './components/CropEditor';
import RecordsPanel from './components/RecordsPanel';
import ResultTable from './components/ResultTable';
import HistoryList from './components/HistoryList';
import BarcodeScanner from './components/BarcodeScanner';
import CodeResults from './components/CodeResults';
import { preloadBarcode, readCodes } from './utils/barcode';

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [image, setImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lang, setLang] = useState('spa');
  const [sourceFile, setSourceFile] = useState(null);
  const [records, setRecords] = useState(() => loadJSON('ocr_records', []));
  const [session, setSession] = useState(() => loadJSON('ocr_session', { bodega: '', responsable: '' }));
  const [showCamera, setShowCamera] = useState(false);
  const [cropState, setCropState] = useState(null); // { file, initial } mientras se edita el recorte
  const [original, setOriginal] = useState(null);   // { file, rect } para poder reencuadrar
  const [mode, setMode] = useState(() => loadJSON('ocr_mode', 'label')); // 'label' | 'document' | 'barcode'
  const [continuous, setContinuous] = useState(() => loadJSON('ocr_continuous', true));
  const [codeResult, setCodeResult] = useState(null); // { key, codes } pendientes de revisar
  const [codeMessage, setCodeMessage] = useState('');
  const isBarcode = mode === 'barcode';
  const [darkMode, setDarkMode] = useState(false);
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(false);
  
  // Interruptor: abrir el editor de recorte tras capturar con la cámara (por defecto, no)
  const [reviewCrop, setReviewCrop] = useState(() => loadJSON('ocr_review_crop', false));
  const [source, setSource] = useState('camera'); // 'camera' | 'file': de dónde viene la última imagen
  const [toast, setToast] = useState('');
  const [emptyResult, setEmptyResult] = useState(false);
  const pendingRun = useRef(false); // true = lanzar el OCR en cuanto la imagen esté procesada
  const resultRef = useRef(null);

  const fileInputRef = useRef(null);

  useEffect(() => { localStorage.setItem('ocr_review_crop', JSON.stringify(reviewCrop)); }, [reviewCrop]);
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  // Idioma real del OCR: en modo etiqueta siempre inglés (mejor para códigos y números)
  const ocrLang = mode === 'label' ? 'eng' : lang;

  // Precarga el motor en segundo plano para que la primera lectura sea inmediata
  useEffect(() => {
    if (isBarcode) return undefined;
    const id = setTimeout(() => preloadEngine(ocrLang), 300);
    return () => clearTimeout(id);
  }, [ocrLang, isBarcode]);

  // El lector de códigos también se descarga al inicio, para que funcione sin conexión
  useEffect(() => {
    const id = setTimeout(() => preloadBarcode().catch(() => {}), 1500);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => { localStorage.setItem('ocr_mode', JSON.stringify(mode)); }, [mode]);
  useEffect(() => { localStorage.setItem('ocr_continuous', JSON.stringify(continuous)); }, [continuous]);

  // Copia al día de los registros: el escaneo continuo agrega varios muy seguidos
  const recordsRef = useRef(records);
  recordsRef.current = records;

  // Cargar historial y tema al iniciar
  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem('ocr_history') || '[]');
    setHistory(savedHistory);
    
    if (localStorage.getItem('theme') === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Persistencia del registro acumulado y de la bodega/responsable
  useEffect(() => { localStorage.setItem('ocr_records', JSON.stringify(records)); }, [records]);
  useEffect(() => { localStorage.setItem('ocr_session', JSON.stringify(session)); }, [session]);

  // Limpia la captura actual y deja todo listo para la siguiente etiqueta
  const goNext = (msg) => {
    setToast(msg);
    setText('');
    setImage(null);
    setProcessedImage(null);
    setSourceFile(null);
    setOriginal(null);
    setEmptyResult(false);
    setCodeResult(null);
    setCodeMessage('');
    window.scrollTo({ top: 0 });
    if (source === 'camera') setShowCamera(true);
    else fileInputRef.current?.click();
  };

  // Inserta un registro si no está repetido. Usa la ref para ver siempre la lista al día.
  const insertRecord = (valores, tipo) => {
    const isOcr = (t) => !t || t === 'Texto OCR';
    const b = valores.join('|');
    const duplicated = recordsRef.current.some((r) => {
      const a = r.valores.join('|');
      // En códigos las mayúsculas importan; con texto OCR se compara sin distinguirlas
      return isOcr(tipo) || isOcr(r.tipo) ? a.toUpperCase() === b.toUpperCase() : a === b;
    });
    if (duplicated) return { ok: false };
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      valores,
      tipo,
      bodega: session.bodega.trim(),
      responsable: session.responsable.trim(),
      fecha: new Date().toLocaleString('es-EC'),
    };
    recordsRef.current = [...recordsRef.current, record];
    setRecords(recordsRef.current);
    return { ok: true, id: record.id, n: recordsRef.current.length };
  };

  // Agrega los códigos revisados (un registro por código)
  const addCodes = (codes, next = false) => {
    const results = codes.map((c) => insertRecord([c.value], c.type));
    const ok = results.filter((r) => r.ok).length;
    const dup = results.length - ok;
    if (ok === 0) return { ok: false, msg: 'Ya están en el registro (duplicado). No se agregaron.' };
    const msg = `Agregados: ${ok}${dup ? ` · duplicados omitidos: ${dup}` : ''}`;
    if (next) goNext(msg);
    return { ok: true, msg };
  };

  const showCodes = (codes) => {
    setCodeMessage('');
    setCodeResult({ key: Date.now(), codes });
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  };

  // Cambiar de modo descarta la captura en pantalla (los registros se conservan)
  const changeMode = (value) => {
    setMode(value);
    setText('');
    setImage(null);
    setProcessedImage(null);
    setSourceFile(null);
    setOriginal(null);
    setEmptyResult(false);
    setCodeResult(null);
    setCodeMessage('');
  };

  // Agrega una captura al registro; rechaza duplicados exactos.
  // next = true: tras agregar, vuelve a abrir la cámara (o el selector de archivos).
  const addRecord = (valores, next = false) => {
    const res = insertRecord(valores, 'Texto OCR');
    if (!res.ok) {
      return { ok: false, msg: 'Estos datos ya están en el registro (duplicado). No se agregaron.' };
    }
    if (next) {
      goNext(`Agregado al registro (N.º ${res.n})`);
      return { ok: true, msg: 'Agregado' };
    }
    return { ok: true, msg: `Agregado al registro (N.º ${res.n}). Toma otra foto para seguir.` };
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Reprocesa la imagen cuando cambia el archivo o el tipo de contenido
  useEffect(() => {
    if (!sourceFile) return;
    let cancelled = false;
    preprocessImage(sourceFile, mode)
      .then((p) => { if (!cancelled) setProcessedImage(p); })
      .catch(() => alert('Error al procesar la imagen. Intenta con otra foto.'));
    return () => { cancelled = true; };
  }, [sourceFile, mode]);

  // Las imágenes subidas desde archivo siempre pasan por el editor de recorte (no hay marco guía)
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSource('file');
      if (isBarcode) {
        // Los códigos se leen directamente de la foto, sin recorte ni preprocesado
        setCodeResult(null);
        setCodeMessage('Buscando códigos…');
        readCodes(file)
          .then((codes) => {
            if (codes.length) showCodes(codes);
            else setCodeMessage('No se encontró ningún código en la imagen. Acércate más o evita reflejos.');
          })
          .catch(() => setCodeMessage('No se pudo leer la imagen. Intenta con otra foto.'));
      } else {
        setCropState({ file, initial: undefined });
      }
    }
    e.target.value = ''; // permite volver a elegir la misma foto
  };

  // Acepta un recorte (manual o automático) y lanza el OCR en cuanto la imagen esté lista
  const applyCrop = (originalFile, croppedFile, rect) => {
    setOriginal({ file: originalFile, rect });
    setImage(URL.createObjectURL(croppedFile));
    setText('');
    setCopied(false);
    setEmptyResult(false);
    setProcessedImage(null);
    pendingRun.current = true;
    setSourceFile(croppedFile);
    setCropState(null);
  };

  // Cámara: por defecto recorta al marco guía y lee directo; con el interruptor, abre el editor
  const handleCameraCapture = (file, guideRect) => {
    setShowCamera(false);
    setSource('camera');
    if (reviewCrop) {
      setCropState({ file, initial: guideRect });
      return;
    }
    cropFileByRect(file, guideRect)
      .then((cropped) => applyCrop(file, cropped, guideRect))
      .catch(() => setCropState({ file, initial: guideRect }));
  };

  const handleCropConfirm = (croppedFile, rect) => applyCrop(cropState.file, croppedFile, rect);

  // OCR automático: se lanza solo cuando la imagen recién capturada ya está procesada
  useEffect(() => {
    if (processedImage && pendingRun.current) {
      pendingRun.current = false;
      runOCR();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedImage]);

  const runOCR = async () => {
    if (!processedImage) return;
    setLoading(true);
    setProgress(0);

    try {
      // Motor reutilizable (ya precargado). En modo etiqueta siempre inglés: lee mejor
      // códigos y números. psm 11 = texto disperso (etiquetas); 3 = página completa.
      let extractedText = await recognizeText(processedImage, {
        lang: ocrLang,
        psm: mode === 'label' ? '11' : '3',
        onProgress: setProgress,
      });
      if (mode === 'label') {
        // Descarta líneas de ruido: sin al menos 2 letras/números seguidos
        extractedText = extractedText
          .split('\n')
          .map(l => l.trim())
          .filter(l => /[A-Za-z0-9]{2,}/.test(l))
          .join('\n');
      }
      setText(extractedText);
      setEmptyResult(!extractedText.trim());
      if (extractedText.trim()) {
        // Lleva la vista al resultado para revisarlo y agregarlo
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
      }

      // Guardar en historial
      if (extractedText.trim()) {
        const newHistoryItem = {
          date: new Date().toLocaleString(),
          text: extractedText
        };
        const updatedHistory = [newHistoryItem, ...history].slice(0, 10); // Guardar últimos 10
        setHistory(updatedHistory);
        localStorage.setItem('ocr_history', JSON.stringify(updatedHistory));
      }

    } catch (error) {
      console.error(error);
      alert('Error de OCR. Verifica tu conexión (la primera vez descarga el idioma) o la calidad de la imagen.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('ocr_history');
  };

  return (
    <div className="min-h-screen p-4 pb-20">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Camera className="text-primary" /> Lector OCR
        </h1>
        <button onClick={toggleDarkMode} className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 transition">
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <main className="max-w-4xl mx-auto flex flex-col items-center gap-6">
        
        {/* Controles de Imagen */}
        <div className="w-full flex flex-col md:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => setShowCamera(true)}
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition w-full md:w-auto justify-center"
          >
            <Camera size={20} /> {isBarcode ? 'Abrir escáner' : 'Abrir cámara'}
          </button>
          <button
            onClick={() => fileInputRef.current.click()}
            className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 px-6 py-3 rounded-lg shadow hover:bg-gray-300 dark:hover:bg-gray-600 transition w-full md:w-auto justify-center"
          >
            <Upload size={20} /> Subir imagen
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          
          {!isBarcode && (
          <select
            value={mode === 'label' ? 'eng' : lang}
            onChange={(e) => setLang(e.target.value)}
            disabled={mode === 'label'}
            title={mode === 'label' ? 'En modo etiqueta se usa inglés (mejor para códigos y números)' : ''}
            className="px-4 py-3 rounded-lg border border-gray-300 dark:bg-gray-800 dark:border-gray-600 w-full md:w-auto disabled:opacity-60"
          >
            <option value="spa">Español</option>
            <option value="eng">Inglés</option>
          </select>
          )}

          <select
            value={mode}
            onChange={(e) => changeMode(e.target.value)}
            aria-label="Tipo de lectura"
            className="px-4 py-3 rounded-lg border border-gray-300 dark:bg-gray-800 dark:border-gray-600 w-full md:w-auto"
          >
            <option value="label">Etiqueta / códigos</option>
            <option value="document">Documento impreso</option>
            <option value="barcode">Código de barras / QR</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none -mt-3">
          <input
            type="checkbox"
            checked={isBarcode ? continuous : reviewCrop}
            onChange={(e) => (isBarcode ? setContinuous : setReviewCrop)(e.target.checked)}
            className="h-5 w-5 accent-blue-600"
          />
          {isBarcode ? 'Escaneo continuo (agrega cada código solo)' : 'Revisar recorte antes de leer'}
        </label>

        {isBarcode && codeMessage && (
          <p role="status" className="w-full max-w-2xl text-sm rounded-lg p-3 bg-sky-50 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100">
            {codeMessage}
          </p>
        )}

        {/* Vista Previa */}
        {processedImage && (
          <div className="w-full max-w-2xl bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-sm font-semibold mb-2 text-gray-500 dark:text-gray-400">Imagen Optimizada</h3>
            <div className="relative">
              <img src={processedImage} alt="Preview" className="max-h-64 mx-auto rounded object-contain border dark:border-gray-700" />
            </div>
            
            {original && (
              <button
                onClick={() => setCropState({ file: original.file, initial: original.rect })}
                className="mt-3 w-full flex justify-center items-center gap-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <Crop size={16} /> Reencuadrar
              </button>
            )}

            <button
              onClick={runOCR}
              disabled={loading}
              className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2 transition"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Camera size={20} />}
              {loading ? `Procesando... ${progress}%` : text ? 'Leer de nuevo' : 'Extraer Texto'}
            </button>

            {emptyResult && !loading && (
              <p role="status" className="mt-3 text-sm rounded-lg p-2 bg-red-50 text-red-800 dark:bg-red-900/40 dark:text-red-200">
                No se detectó texto. Pulsa “Reencuadrar” para ajustar el recorte o vuelve a capturar.
              </p>
            )}
          </div>
        )}

        {/* Resultados y Edición */}
        <div ref={resultRef} className="w-full flex flex-col items-center gap-6 scroll-mt-2">
        {text && (
          <div className="w-full max-w-2xl bg-white dark:bg-gray-800 p-4 rounded-lg shadow animate-fade-in">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold">Texto Reconocido</h3>
              <button onClick={copyToClipboard} className="text-gray-500 hover:text-primary flex items-center gap-1 text-sm">
                {copied ? <CheckCircle size={16} className="text-green-500"/> : <Copy size={16} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <textarea 
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-32 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-primary outline-none resize-none"
            />
          </div>
        )}

        {/* Tabla Editable y Exportación */}
        {text && <ResultTable initialText={text} onAddRecord={addRecord} />}

        {codeResult && <CodeResults key={codeResult.key} codes={codeResult.codes} onAdd={addCodes} />}
        </div>

        {/* Registro acumulado y exportación a Excel */}
        <RecordsPanel
          records={records}
          session={session}
          onSessionChange={setSession}
          onDelete={(id) => setRecords(prev => prev.filter(r => r.id !== id))}
          onClear={() => setRecords([])}
        />

        {/* Historial */}
        <HistoryList 
          history={history} 
          onSelect={(selectedText) => setText(selectedText)} 
          onClear={clearHistory}
        />

      </main>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-lg"
        >
          {toast}
        </div>
      )}

      {showCamera && !isBarcode && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
      )}
      {showCamera && isBarcode && (
        <BarcodeScanner
          continuous={continuous}
          onContinuousChange={setContinuous}
          onResult={(codes) => {
            setShowCamera(false);
            setSource('camera');
            showCodes(codes);
          }}
          onAdd={(code) => insertRecord([code.value], code.type)}
          onUndo={(id) => setRecords((prev) => prev.filter((r) => r.id !== id))}
          onClose={() => setShowCamera(false)}
        />
      )}
      {cropState && (
        <CropEditor
          file={cropState.file}
          initial={cropState.initial}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropState(null)}
        />
      )}
    </div>
  );
}

export default App;