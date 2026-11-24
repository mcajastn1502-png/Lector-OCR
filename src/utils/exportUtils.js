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