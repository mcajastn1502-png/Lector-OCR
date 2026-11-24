import * as XLSX from 'xlsx';

export const exportToExcel = (data, filename = 'resultados_ocr.xlsx') => {
  // Crear hoja de cálculo
  const ws = XLSX.utils.json_to_sheet(data);

  // Ajustar ancho de columnas (opcional)
  const wscols = [
    {wch: 30}, // Ancho para col1
    {wch: 30}  // Ancho para col2
  ];
  ws['!cols'] = wscols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos_Extraidos");
  XLSX.writeFile(wb, filename);
};

// ---- Registro acumulado (varias capturas en un solo archivo) ----

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Convierte los registros en filas planas. Cada captura trae `valores` (líneas leídas);
 * se expanden en columnas DATO 1..N según la captura más larga.
 */
export function recordsToRows(records) {
  const maxValues = Math.max(1, ...records.map((r) => r.valores.length));
  return records.map((r, i) => {
    const row = {
      'N.º': i + 1,
      'FECHA Y HORA': r.fecha,
      'BODEGA / UBICACIÓN': r.bodega,
      'RESPONSABLE': r.responsable,
    };
    for (let k = 0; k < maxValues; k++) row[`DATO ${k + 1}`] = r.valores[k] ?? '';
    return row;
  });
}

export function exportRecordsXLSX(records) {
  const rows = recordsToRows(records);
  const ws = XLSX.utils.json_to_sheet(rows);
  const dataCols = Object.keys(rows[0]).length - 4;
  ws['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 24 }, { wch: 26 }, ...Array(dataCols).fill({ wch: 24 })];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  XLSX.writeFile(wb, `Registros_OCR_${today()}.xlsx`);
}

export function exportRecordsCSV(records) {
  const rows = recordsToRows(records);
  const keys = Object.keys(rows[0]);
  const body = [keys, ...rows.map((r) => keys.map((k) => r[k]))]
    .map((a) => a.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  // BOM para que Excel respete tildes y eñes
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Registros_OCR_${today()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
