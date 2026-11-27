import React, { useState } from 'react';
import { ListPlus } from 'lucide-react';

/** Revisión de códigos leídos antes de agregarlos. Cada código marcado es un registro. */
export default function CodeResults({ codes, onAdd }) {
  const [rows, setRows] = useState(() => codes.map((c) => ({ ...c, checked: true })));
  const [notice, setNotice] = useState(null);

  const update = (i, patch) => setRows((r) => r.map((row, k) => (k === i ? { ...row, ...patch } : row)));

  const handleAdd = (next) => {
    const selected = rows.filter((r) => r.checked && r.value.trim());
    if (selected.length === 0) {
      setNotice({ ok: false, msg: 'Marca al menos un código.' });
      return;
    }
    setNotice(onAdd(selected.map(({ value, type }) => ({ value: value.trim(), type })), next));
  };

  return (
    <div className="w-full max-w-2xl bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 className="font-bold text-lg mb-3">Códigos leídos ({rows.length})</h3>
      {rows.map((r, i) => (
        <div key={i} className="flex items-start gap-3 mb-3">
          <input
            type="checkbox"
            checked={r.checked}
            onChange={(e) => update(i, { checked: e.target.checked })}
            aria-label={`Incluir código ${i + 1}`}
            className="h-5 w-5 mt-2 accent-blue-600"
          />
          <div className="flex-1">
            <span className="text-xs font-bold text-primary">{r.type}</span>
            <textarea
              value={r.value}
              onChange={(e) => update(i, { value: e.target.value })}
              rows={r.value.length > 36 ? 3 : 1}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 resize-none break-all"
            />
          </div>
        </div>
      ))}
      <button
        onClick={() => handleAdd(true)}
        className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition"
      >
        <ListPlus size={18} /> Agregar y siguiente
      </button>
      <button
        onClick={() => handleAdd(false)}
        className="mt-2 w-full text-sm py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
      >
        Solo agregar al registro
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
  );
}
