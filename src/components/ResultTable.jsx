import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Download, ListPlus } from 'lucide-react';
import { exportToExcel } from '../utils/exportUtils';

const ResultTable = ({ initialText, onAddRecord }) => {
  const [rows, setRows] = useState([]);
  const [notice, setNotice] = useState(null); // { ok, msg } tras agregar al registro

  // Parseo inicial: separa por líneas. Intentamos separar por tabulaciones o espacios dobles
  useEffect(() => {
    if (initialText) {
      const parsedRows = initialText.split('\n')
        .filter(line => line.trim() !== '')
        .map((line, index) => {
          // Intenta dividir por tabulaciones o múltiples espacios
          const parts = line.split(/\t+|\s{2,}/);
          return {
            id: `row-${index}-${Date.now()}`,
            col1: parts[0] || '',
            col2: parts[1] || '' // Si hay más partes, podrías expandir esto
          };
        });
      setRows(parsedRows);
      setNotice(null);
    }
  }, [initialText]);

  // Agrega la captura (todas las celdas no vacías de la tabla) como un registro
  const handleAddRecord = () => {
    const valores = rows.flatMap(({ col1, col2 }) => [col1, col2]).map(v => v.trim()).filter(Boolean);
    if (valores.length === 0) {
      setNotice({ ok: false, msg: 'No hay datos para agregar.' });
      return;
    }
    setNotice(onAddRecord(valores));
  };

  const handleEdit = (id, field, value) => {
    setRows(rows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const addRow = () => {
    setRows([...rows, { id: `new-${Date.now()}`, col1: '', col2: '' }]);
  };

  const deleteRow = (id) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const handleExport = () => {
    // Limpiar IDs antes de exportar
    const dataToExport = rows.map(({ col1, col2 }) => ({ Dato1: col1, Dato2: col2 }));
    exportToExcel(dataToExport);
  };

  if (rows.length === 0) return null;

  return (
    <div className="mt-6 w-full max-w-2xl bg-white dark:bg-gray-800 p-4 rounded-lg shadow overflow-x-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">Tabla Editable</h3>
        <button onClick={handleExport} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition">
          <Download size={16} /> Exportar Excel
        </button>
      </div>
      
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 uppercase text-xs">
          <tr>
            <th className="px-2 py-2">Dato 1</th>
            <th className="px-2 py-2">Dato 2</th>
            <th className="px-2 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b dark:border-gray-700">
              <td className="px-2 py-1">
                <input 
                  value={row.col1} 
                  onChange={(e) => handleEdit(row.id, 'col1', e.target.value)}
                  className="w-full bg-transparent border-b border-transparent focus:border-primary focus:outline-none p-1"
                />
              </td>
              <td className="px-2 py-1">
                <input 
                  value={row.col2} 
                  onChange={(e) => handleEdit(row.id, 'col2', e.target.value)}
                  className="w-full bg-transparent border-b border-transparent focus:border-primary focus:outline-none p-1"
                />
              </td>
              <td className="px-2 py-1 text-center">
                <button onClick={() => deleteRow(row.id)} className="text-red-500 hover:text-red-700 p-1">
                  <Trash2 size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <button onClick={addRow} className="mt-3 flex items-center gap-1 text-primary text-sm font-semibold hover:underline">
        <Plus size={16} /> Agregar Fila
      </button>

      {onAddRecord && (
        <div className="mt-4">
          <button
            onClick={handleAddRecord}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition"
          >
            <ListPlus size={18} /> Agregar al registro
          </button>
          {notice && (
            <p
              role="status"
              className={`mt-2 text-sm rounded-lg p-2 ${
                notice.ok
                  ? 'bg-green-50 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                  : 'bg-red-50 text-red-800 dark:bg-red-900/40 dark:text-red-200'
              }`}
            >
              {notice.msg}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ResultTable;