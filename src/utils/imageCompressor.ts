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

/**
 * Strongly compress an existing Base64 / data URL image to a tiny lightweight thumbnail (e.g. 50x50, JPEG 0.35)
 * for safe syncing across mobile clipboards without exceeding character limits.
 */
export function compressDataUrl(
  dataUrl: string,
  maxDimension: number = 50,
  quality: number = 0.35
): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl || '');
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => {
      resolve(''); // If invalid or corrupted, return empty string so it doesn't take space
    };

    img.onload = () => {
      try {
        let targetWidth = img.width;
        let targetHeight = img.height;

        if (targetWidth > targetHeight) {
          if (targetWidth > maxDimension) {
            targetHeight = Math.max(1, Math.round((targetHeight * maxDimension) / targetWidth));
            targetWidth = maxDimension;
          }
        } else {
          if (targetHeight > maxDimension) {
            targetWidth = Math.max(1, Math.round((targetWidth * maxDimension) / targetHeight));
            targetHeight = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'low';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch {
        resolve('');
      }
    };

    img.src = dataUrl;
  });
}
