import React, { useState, useRef, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import { Camera, Upload, Loader2, Sun, Moon, Copy, CheckCircle } from 'lucide-react';
import { preprocessImage } from './utils/imageUtils';
import ResultTable from './components/ResultTable';
import HistoryList from './components/HistoryList';

function App() {
  const [image, setImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lang, setLang] = useState('spa');
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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(URL.createObjectURL(file));
      setText('');
      setCopied(false);
      try {
        const processed = await preprocessImage(file);
        setProcessedImage(processed);
      } catch (err) {
        alert("Error al procesar la imagen. Intenta con otra foto.");
      }
    }
  };

  const runOCR = async () => {
    if (!processedImage) return;
    setLoading(true);
    setProgress(0);
    
    try {
      const result = await Tesseract.recognize(
        processedImage,
        lang,
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
            }
          }
        }
      );
      
      const extractedText = result.data.text;
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
            onClick={() => fileInputRef.current.click()}
            className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition w-full md:w-auto justify-center"
          >
            <Upload size={20} /> Subir / Tomar Foto
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            capture="environment" // Fuerza cámara trasera en móviles
            className="hidden" 
          />
          
          <select 
            value={lang} 
            onChange={(e) => setLang(e.target.value)}
            className="px-4 py-3 rounded-lg border border-gray-300 dark:bg-gray-800 dark:border-gray-600 w-full md:w-auto"
          >
            <option value="spa">Español</option>
            <option value="eng">Inglés</option>
          </select>
        </div>

        {/* Vista Previa */}
        {processedImage && (
          <div className="w-full max-w-2xl bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-sm font-semibold mb-2 text-gray-500 dark:text-gray-400">Imagen Optimizada</h3>
            <div className="relative">
              <img src={processedImage} alt="Preview" className="max-h-64 mx-auto rounded object-contain border dark:border-gray-700" />
            </div>
            
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
        {text && <ResultTable initialText={text} />}

        {/* Historial */}
        <HistoryList 
          history={history} 
          onSelect={(selectedText) => setText(selectedText)} 
          onClear={clearHistory}
        />

      </main>
    </div>
  );
}

export default App;