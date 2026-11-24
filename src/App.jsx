import React, { useState, useRef, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import { Camera, Upload, Loader2, Sun, Moon, Copy, CheckCircle, Crop } from 'lucide-react';
import { preprocessImage } from './utils/imageUtils';
import CameraCapture from './components/CameraCapture';
import CropEditor from './components/CropEditor';
import RecordsPanel from './components/RecordsPanel';
import ResultTable from './components/ResultTable';
import HistoryList from './components/HistoryList';

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
  const [mode, setMode] = useState('label'); // 'label' = etiquetas/códigos, 'document' = texto impreso
  const [darkMode, setDarkMode] = useState(false);
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(false);
  
  const fileInputRef = useRef(null);

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

  // Agrega una captura al registro; rechaza duplicados exactos
  const addRecord = (valores) => {
    const key = valores.join('|').toUpperCase();
    if (records.some(r => r.valores.join('|').toUpperCase() === key)) {
      return { ok: false, msg: 'Estos datos ya están en el registro (duplicado). No se agregaron.' };
    }
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      valores,
      bodega: session.bodega.trim(),
      responsable: session.responsable.trim(),
      fecha: new Date().toLocaleString('es-EC'),
    };
    setRecords(prev => [...prev, record]);
    return { ok: true, msg: `Agregado al registro (N.º ${records.length + 1}). Toma otra foto para seguir.` };
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

  // Toda imagen (cámara en vivo o archivo) pasa primero por el editor de recorte
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) setCropState({ file, initial: undefined });
    e.target.value = ''; // permite volver a elegir la misma foto
  };

  const handleCameraCapture = (file, guideRect) => {
    setShowCamera(false);
    setCropState({ file, initial: guideRect });
  };

  const handleCropConfirm = (croppedFile, rect) => {
    setOriginal({ file: cropState.file, rect });
    setImage(URL.createObjectURL(croppedFile));
    setText('');
    setCopied(false);
    setSourceFile(croppedFile);
    setCropState(null);
  };

  const runOCR = async () => {
    if (!processedImage) return;
    setLoading(true);
    setProgress(0);

    let worker;
    try {
      // En modo etiqueta siempre inglés: lee mejor códigos y números que el modelo en español
      worker = await Tesseract.createWorker(mode === 'label' ? 'eng' : lang, 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        }
      });
      // 11 = texto disperso (etiquetas con pocas líneas sueltas); 3 = página completa
      await worker.setParameters({
        tessedit_pageseg_mode: mode === 'label' ? '11' : '3',
        preserve_interword_spaces: '1'
      });
      const result = await worker.recognize(processedImage);

      let extractedText = result.data.text;
      if (mode === 'label') {
        // Descarta líneas de ruido: sin al menos 2 letras/números seguidos
        extractedText = extractedText
          .split('\n')
          .map(l => l.trim())
          .filter(l => /[A-Za-z0-9]{2,}/.test(l))
          .join('\n');
      }
      setText(extractedText);
      
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
      if (worker) await worker.terminate();
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
            <Camera size={20} /> Abrir cámara
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

          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="px-4 py-3 rounded-lg border border-gray-300 dark:bg-gray-800 dark:border-gray-600 w-full md:w-auto"
          >
            <option value="label">Etiqueta / códigos</option>
            <option value="document">Documento impreso</option>
          </select>
        </div>

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
              {loading ? `Procesando... ${progress}%` : 'Extraer Texto'}
            </button>
          </div>
        )}

        {/* Resultados y Edición */}
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

      {showCamera && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
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