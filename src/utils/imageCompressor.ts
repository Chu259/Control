/**
 * Image compressor utility for converting any uploaded image format from device
 * into an optimized, lightweight icon data URL stored directly in local APK DB.
 */
export async function compressImageToIcon(
  file: File,
  maxDimension: number = 180,
  quality: number = 0.84
): Promise<{ dataUrl: string; width: number; height: number; originalSize: number; compressedSize: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('No se pudo leer el archivo de imagen del dispositivo.'));
    };

    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        reject(new Error('Contenido de imagen vacío.'));
        return;
      }

      const img = new Image();
      img.onerror = () => {
        reject(new Error('Formato de imagen no soportado o archivo dañado.'));
      };

      img.onload = () => {
        // Calculate new dimensions keeping aspect ratio
        let targetWidth = img.width;
        let targetHeight = img.height;

        if (targetWidth > targetHeight) {
          if (targetWidth > maxDimension) {
            targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
            targetWidth = maxDimension;
          }
        } else {
          if (targetHeight > maxDimension) {
            targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
            targetHeight = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo inicializar el procesador gráfico del dispositivo.'));
          return;
        }

        // Draw image smoothly
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Convert to lightweight JPEG data URL
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const compressedSize = Math.round((dataUrl.length * 3) / 4);

        resolve({
          dataUrl,
          width: targetWidth,
          height: targetHeight,
          originalSize: file.size,
          compressedSize,
        });
      };

      img.src = src;
    };

    reader.readAsDataURL(file);
  });
}
