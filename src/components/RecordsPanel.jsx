import React from 'react';
import { FileSpreadsheet, FileText, Trash2, X } from 'lucide-react';
import { exportRecordsXLSX, exportRecordsCSV } from '../utils/exportUtils';

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-primary outline-none';

/** Registro acumulado: bodega/responsable de la sesión, lista de capturas y exportación. */
const RecordsPanel = ({ records, session, onSessionChange, onDelete, onClear }) => {
  const handleClear = () => {
    if (window.confirm('¿Borrar todos los registros guardados?')) onClear();
  };

  return (
    <section className="w-full max-w-2xl bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-lg">Registro para Excel</h3>
        <span className="text-2xl font-extrabold text-primary" aria-label="Total de registros">
          {records.length}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <label className="text-sm font-semibold">
          Bodega / ubicación
          <input
            value={session.bodega}
            onChange={(e) => onSessionChange({ ...session, bodega: e.target.value })}
            placeholder="Ej. CDD GYE, Arupos"
            className={`${inputCls} mt-1 font-normal`}
          />
        </label>
        <label className="text-sm font-semibold">
          Responsable
          <input
            value={session.responsable}
            onChange={(e) => onSessionChange({ ...session, responsable: e.target.value })}
            placeholder="Nombre del responsable"
            className={`${inputCls} mt-1 font-normal`}
          />
        </label>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Estos datos se agregan a cada captura que guardes. Los registros se conservan en este
        dispositivo aunque cierres la página.
      </p>

      {records.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-3">
          Aún no hay registros. Extrae el texto de una imagen y pulsa “Agregar al registro”.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto max-h-72 overflow-y-auto border dark:border-gray-700 rounded">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 dark:bg-gray-700 text-xs uppercase sticky top-0">
                <tr>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Datos</th>
                  <th className="px-2 py-2">Bodega</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={r.id} className="border-t dark:border-gray-700 align-top">
                    <td className="px-2 py-2">{i + 1}</td>
                    <td className="px-2 py-2 break-words">{r.valores.join(' · ')}</td>
                    <td className="px-2 py-2">{r.bodega || '—'}</td>
                    <td className="px-1 py-1">
                      <button
                        onClick={() => onDelete(r.id)}
                        aria-label="Eliminar registro"
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={() => exportRecordsXLSX(records)}
              className="flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition"
            >
              <FileSpreadsheet size={18} /> Descargar Excel
            </button>
            <button
              onClick={() => exportRecordsCSV(records)}
              className="flex items-center justify-center gap-2 bg-gray-200 dark:bg-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              <FileText size={18} /> CSV
            </button>
          </div>
          <button
            onClick={handleClear}
            className="mt-2 w-full flex items-center justify-center gap-2 text-red-600 dark:text-red-300 text-sm py-2 hover:underline"
          >
            <Trash2 size={14} /> Borrar todos los registros
          </button>
        </>
      )}
    </section>
  );
};

export default RecordsPanel;
