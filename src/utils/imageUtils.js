export const preprocessImage = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Redimensionar si es muy grande para mejorar velocidad
      const MAX_WIDTH = 1200;
      let scale = 1;
      if (img.width > MAX_WIDTH) {
        scale = MAX_WIDTH / img.width;
      }
      
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Convertir a escala de grises
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg;     // R
        data[i + 1] = avg; // G
        data[i + 2] = avg; // B
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg'));
    };
    
    img.onerror = (err) => reject(err);
  });
};