import React from 'react';
import { History, Trash2 } from 'lucide-react';

const HistoryList = ({ history, onSelect, onClear }) => {
  if (history.length === 0) return null;

  return (
    <div className="mt-8 w-full max-w-2xl">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <History size={18} /> Historial Reciente
        </h3>
        <button onClick={onClear} className="text-xs text-red-500 hover:underline flex items-center gap-1">
          <Trash2 size={12} /> Limpiar
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {history.map((item, index) => (
          <button 
            key={index} 
            onClick={() => onSelect(item.text)}
            className="text-left bg-white dark:bg-gray-800 p-3 rounded shadow-sm border border-gray-200 dark:border-gray-700 hover:border-primary transition truncate"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400 text-xs mb-1">{item.date}</p>
            <p className="text-sm truncate">{item.text.substring(0, 50)}...</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default HistoryList;