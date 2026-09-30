import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface ShareOptions {
  title?: string;
  text?: string;
  fileName?: string;
  dialogTitle?: string;
}

/**
 * Shares an image (Base64 / Data URL) directly using Capacitor's native Share plugin.
 * On Android, writes the base64 image to the Cache directory so Android OS can grant
 * file read permissions to WhatsApp, Gmail, Gallery, Drive, etc.
 */
export async function shareBase64Image(
  dataUrlOrBase64: string,
  options: ShareOptions = {}
): Promise<boolean> {
  const fileName = options.fileName || `lista_compras_${Date.now()}.jpg`;
  const title = options.title || 'Lista de Compras de Mercadería';
  const text = options.text || 'Comparto la lista de compras generada con códigos de barra y productos.';
  const dialogTitle = options.dialogTitle || 'Compartir Lista JPG';

  // Extract pure base64 string
  const base64Data = dataUrlOrBase64.includes(',')
    ? dataUrlOrBase64.split(',')[1]
    : dataUrlOrBase64;

  // 1. Primary path: Write to Capacitor Cache directory to get native file URI
  try {
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
    });

    if (savedFile?.uri) {
      try {
        await Share.share({
          title,
          text,
          files: [savedFile.uri],
          dialogTitle,
        });
        return true;
      } catch (shareErr: any) {
        const msg = String(shareErr?.message || '').toLowerCase();
        if (msg.includes('cancel') || msg.includes('abort') || shareErr?.name === 'AbortError') {
          return true; // User cancelled share sheet
        }
        console.warn('Share.share with file URI failed:', shareErr);
      }
    }
  } catch (fsErr) {
    console.warn('Filesystem.writeFile failed, trying web share or fallback:', fsErr);
  }

  // 2. Fallback: Browser Web Share API with File object
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const fullDataUrl = dataUrlOrBase64.startsWith('data:')
        ? dataUrlOrBase64
        : `data:image/jpeg;base64,${dataUrlOrBase64}`;
      const res = await fetch(fullDataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: 'image/jpeg' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          text,
          files: [file],
        });
        return true;
      }
    } catch (webShareErr: any) {
      const msg = String(webShareErr?.message || '').toLowerCase();
      if (webShareErr?.name === 'AbortError' || msg.includes('cancel') || msg.includes('abort')) {
        return true; // User cancelled the native share sheet
      }
      console.warn('Web Share API error:', webShareErr);
    }
  }

  // 3. Fallback: Share via URL or Capacitor Share
  try {
    await Share.share({
      title,
      text,
      url: dataUrlOrBase64.startsWith('data:') ? dataUrlOrBase64 : `data:image/jpeg;base64,${dataUrlOrBase64}`,
      dialogTitle,
    });
    return true;
  } catch (shareErr: any) {
    const msg = String(shareErr?.message || '').toLowerCase();
    if (msg.includes('cancel') || msg.includes('abort') || shareErr?.name === 'AbortError') {
      return true;
    }
    console.warn('Share fallback error:', shareErr);
    // In desktop browser where native share sheet does not exist:
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const link = document.createElement('a');
        link.href = dataUrlOrBase64.startsWith('data:') ? dataUrlOrBase64 : `data:image/jpeg;base64,${dataUrlOrBase64}`;
        link.download = fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        link.remove();
        return true;
      } catch (e) {
        console.warn('Fallback download link failed:', e);
      }
    }
    return false;
  }
}
