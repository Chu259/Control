import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { SyncService } from './syncService';
import { Sound } from './sound';
import { SyncPayload } from '../types';

// Decodes a base64 string to a proper UTF-8 string (preserving tildes, ñ, etc.)
export function decodeBase64ToUtf8(base64Str: string): string {
  try {
    const clean = base64Str.replace(/\s+/g, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (err) {
    console.warn('UTF-8 TextDecoder failed on base64, falling back to simple atob:', err);
    return atob(base64Str);
  }
}

export const NativeFileService = {
  /**
   * Empaqueta toda la base de datos (catálogo de 152 productos, stock, pasillos y movimientos)
   * en un archivo físico real con extensión ".json" guardado en la carpeta local de la app
   * usando @capacitor/filesystem, y dispara el menú nativo de compartir de Android (para WhatsApp).
   */
  async exportAndShareJsonFile(customPayload?: SyncPayload): Promise<{
    success: boolean;
    message: string;
    fileName?: string;
    fileUri?: string;
    productCount?: number;
    movementCount?: number;
  }> {
    try {
      // 1. Obtener payload completo sin recortar fotos ni registros
      const payload = customPayload || SyncService.createSyncPayload({ stripImages: false });
      const productCount = payload.products?.length || 0;
      const movementCount = payload.movements?.length || 0;
      const storeCode = (payload.storeCode || 'DEPOS').trim().toUpperCase();
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `inventario_${storeCode}_${dateStr}.json`;

      const jsonString = JSON.stringify(payload, null, 2);

      // 2. Si estamos en Android nativo (Capacitor)
      if (Capacitor.isNativePlatform()) {
        // Guardar archivo físico en Directory.Cache (accesible para FileProvider / WhatsApp)
        const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: jsonString,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        // Obtener URI nativa (content:// o file://)
        let nativeUri = writeResult.uri;
        if (!nativeUri) {
          const uriRes = await Filesystem.getUri({
            directory: Directory.Cache,
            path: fileName,
          });
          nativeUri = uriRes.uri;
        }

        // 3. Disparar nativamente el menú de compartir de Android
        await Share.share({
          title: `Copia de Inventario (${storeCode})`,
          text: `Base de datos completa de ${storeCode} (${dateStr}): ${productCount} artículos y ${movementCount} movimientos. Enviar como documento adjunto.`,
          url: nativeUri,
          files: [nativeUri],
          dialogTitle: 'Enviar archivo .json por WhatsApp',
        });

        Sound.playSuccessChime();

        return {
          success: true,
          message: `Archivo "${fileName}" creado con éxito y enviado al menú de compartir de Android.`,
          fileName,
          fileUri: nativeUri,
          productCount,
          movementCount,
        };
      }

      // 4. Si estamos en Entorno Web / Navegador de escritorio / PWA:
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const file = new File([blob], fileName, { type: 'application/json' });

      // Intento de Web Share API con archivo real (compatible con Chrome Android móvil)
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Copia de Inventario (${storeCode})`,
            text: `Base de datos completa de ${storeCode}: ${productCount} productos.`,
            files: [file],
          });
          Sound.playSuccessChime();
          return {
            success: true,
            message: `Menú de compartir ejecutado con el archivo "${fileName}".`,
            fileName,
            productCount,
            movementCount,
          };
        } catch (e: any) {
          if (e.name === 'AbortError') {
            return {
              success: true,
              message: 'Compartir cancelado por el usuario.',
              fileName,
              productCount,
              movementCount,
            };
          }
          console.warn('Web Share failed, proceeding with download fallback:', e);
        }
      }

      // Descarga directa tradicional en navegador
      const downloadUrl = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', downloadUrl);
      downloadAnchor.setAttribute('download', fileName);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
      Sound.playSuccessChime();

      return {
        success: true,
        message: `Archivo "${fileName}" descargado correctamente (${productCount} productos).`,
        fileName,
        productCount,
        movementCount,
      };
    } catch (err: any) {
      console.error('Error in exportAndShareJsonFile:', err);
      Sound.playWarningTone();
      return {
        success: false,
        message: `Error al generar o compartir el archivo: ${err?.message || 'Error desconocido'}`,
      };
    }
  },

  /**
   * Invoca el selector de archivos nativo del sistema operativo (usando @capawesome/capacitor-file-picker)
   * para que el operario busque y seleccione el archivo ".json" recibido por WhatsApp,
   * y lee su contenido completo directamente desde el almacenamiento del celular.
   */
  async pickAndReadJsonFile(): Promise<{
    success: boolean;
    cancelled?: boolean;
    content?: string;
    fileName?: string;
    errorMessage?: string;
  }> {
    // Si estamos en entorno Capacitor nativo
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await FilePicker.pickFiles({
          types: [
            'application/json',
            'text/json',
            'text/plain',
            'application/octet-stream',
            '*/*',
          ],
          limit: 1,
          readData: true,
        });

        if (!result || !result.files || result.files.length === 0) {
          return { success: false, cancelled: true };
        }

        const picked = result.files[0];
        const name = picked.name || 'archivo.json';

        // 1. Si devolvió data en Base64
        if (picked.data) {
          const decoded = decodeBase64ToUtf8(picked.data);
          return {
            success: true,
            content: decoded,
            fileName: name,
          };
        }

        // 2. Si devolvió blob (ej: en web platform con file picker)
        if (picked.blob) {
          const text = await picked.blob.text();
          return {
            success: true,
            content: text,
            fileName: name,
          };
        }

        // 3. Si devolvió ruta física local (path)
        if (picked.path) {
          try {
            const readRes = await Filesystem.readFile({
              path: picked.path,
              encoding: Encoding.UTF8,
            });
            const text = typeof readRes.data === 'string' ? readRes.data : '';
            return {
              success: true,
              content: text,
              fileName: name,
            };
          } catch (readErr) {
            console.warn('Error reading file via Filesystem.readFile, trying fetch:', readErr);
            const response = await fetch(Capacitor.convertFileSrc(picked.path));
            const text = await response.text();
            return {
              success: true,
              content: text,
              fileName: name,
            };
          }
        }

        return {
          success: false,
          errorMessage: 'No se pudo leer el flujo de datos del archivo seleccionado.',
        };
      } catch (pickerErr: any) {
        // Si el usuario canceló el selector nativo
        if (
          pickerErr?.message?.toLowerCase().includes('cancel') ||
          pickerErr?.code === 'PICK_FILES_CANCELED' ||
          pickerErr?.message?.includes('user cancelled')
        ) {
          return { success: false, cancelled: true };
        }

        console.warn('Native FilePicker error, will attempt fallback:', pickerErr);
        // Continuar hacia el fallback si hubo fallo inesperado
      }
    }

    // Fallback: Selector HTML nativo (funciona universalmente en navegadores y WebView de Android)
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json,text/plain,*/*';

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve({ success: false, cancelled: true });
          return;
        }

        try {
          const text = await file.text();
          resolve({
            success: true,
            content: text,
            fileName: file.name,
          });
        } catch (err: any) {
          resolve({
            success: false,
            errorMessage: `Error al leer el archivo: ${err?.message || 'Error de lectura'}`,
          });
        }
      };

      // Manejar cancelación si el usuario cierra el selector sin seleccionar
      window.addEventListener(
        'focus',
        () => {
          setTimeout(() => {
            if (!input.files || input.files.length === 0) {
              resolve({ success: false, cancelled: true });
            }
          }, 600);
        },
        { once: true }
      );

      input.click();
    });
  },
};
