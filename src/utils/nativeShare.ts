import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface ShareOptions {
  title?: string;
  text?: string;
  fileName?: string;
  dialogTitle?: string;
}

/**
 * Writes base64 data to a physical temporary file in Capacitor's Cache directory
 * and returns its native file URI (e.g. file:///data/user/0/.../cache/lista_compras.pdf).
 */
export async function saveTemporaryFile(
  dataUrlOrBase64: string,
  fileName: string
): Promise<string> {
  const base64Data = dataUrlOrBase64.includes(',')
    ? dataUrlOrBase64.split(',')[1]
    : dataUrlOrBase64;

  const savedFile = await Filesystem.writeFile({
    path: fileName,
    data: base64Data,
    directory: Directory.Cache,
    recursive: true,
  });

  if (savedFile?.uri) {
    return savedFile.uri;
  }

  const uriRes = await Filesystem.getUri({
    path: fileName,
    directory: Directory.Cache,
  });
  return uriRes.uri;
}

/**
 * Shares any base64 file (JPG, PDF, etc.) directly using Capacitor's native Share plugin.
 * 
 * CRITICAL FIX FOR WHATSAPP/ANDROID:
 * When sharing a file, NEVER pass the 'text' field to Share.share.
 * If 'text' is provided alongside a file on Android, WhatsApp prioritizes
 * the plain text and drops the attached file stream (EXTRA_STREAM), leaving the file
 * trapped in storage. Omitting 'text' forces WhatsApp to attach the real physical
 * image or PDF document directly in the chat.
 */
export async function shareBase64File(
  dataUrlOrBase64: string,
  mimeType: string,
  options: ShareOptions = {}
): Promise<boolean> {
  const isPdf = mimeType === 'application/pdf';
  const defaultExt = isPdf ? 'pdf' : 'jpg';
  const todayStr = new Date().toISOString().slice(0, 10);
  const fileName = options.fileName || (isPdf ? `lista_compras_${todayStr}.pdf` : `lista_compras.jpg`);
  const title = options.title || (isPdf ? 'Lista de Compras PDF' : 'Lista de Compras');
  const dialogTitle = options.dialogTitle || (isPdf ? 'Compartir Lista PDF' : 'Compartir Lista JPG');

  // 1. Primary path: Write to Capacitor Cache directory to create a real physical temporary file
  try {
    const fileUri = await saveTemporaryFile(dataUrlOrBase64, fileName);

    if (fileUri) {
      // Primary native attempt with 'files' array (NO 'text' parameter so WhatsApp attaches the file)
      try {
        await Share.share({
          title,
          files: [fileUri],
          dialogTitle,
        });
        return true;
      } catch (shareErr: any) {
        const msg = String(shareErr?.message || '').toLowerCase();
        if (msg.includes('cancel') || msg.includes('abort') || shareErr?.name === 'AbortError') {
          return true; // User dismissed share sheet
        }
        console.warn('Share.share with files failed, attempting fallback with url:', shareErr);
      }

      // Secondary native attempt with 'url' containing the file URI (NO 'text' parameter)
      try {
        await Share.share({
          title,
          url: fileUri,
          dialogTitle,
        });
        return true;
      } catch (urlErr: any) {
        const msg = String(urlErr?.message || '').toLowerCase();
        if (msg.includes('cancel') || msg.includes('abort') || urlErr?.name === 'AbortError') {
          return true;
        }
        console.warn('Share.share with url failed:', urlErr);
      }
    }
  } catch (fsErr) {
    console.warn('Filesystem.writeFile failed, attempting web share fallback:', fsErr);
  }

  // 2. Fallback: Browser Web Share API with real File object
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const fullDataUrl = dataUrlOrBase64.startsWith('data:')
        ? dataUrlOrBase64
        : `data:${mimeType};base64,${dataUrlOrBase64}`;
      const res = await fetch(fullDataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: mimeType });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          // Do NOT pass text here either so WhatsApp doesn't drop the file attachment!
        });
        return true;
      }
    } catch (webShareErr: any) {
      const msg = String(webShareErr?.message || '').toLowerCase();
      if (webShareErr?.name === 'AbortError' || msg.includes('cancel') || msg.includes('abort')) {
        return true;
      }
      console.warn('Web Share API error:', webShareErr);
    }
  }

  // 3. Fallback: Direct Download in browser
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const fullUrl = dataUrlOrBase64.startsWith('data:')
        ? dataUrlOrBase64
        : `data:${mimeType};base64,${dataUrlOrBase64}`;
      const link = document.createElement('a');
      link.href = fullUrl;
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

/**
 * Shares a JPG image using Capacitor Native Share or Web Share
 */
export async function shareBase64Image(
  dataUrlOrBase64: string,
  options: ShareOptions = {}
): Promise<boolean> {
  return shareBase64File(dataUrlOrBase64, 'image/jpeg', options);
}

/**
 * Shares a multi-page PDF document using Capacitor Native Share or Web Share
 */
export async function shareBase64Pdf(
  dataUrlOrBase64: string,
  options: ShareOptions = {}
): Promise<boolean> {
  return shareBase64File(dataUrlOrBase64, 'application/pdf', options);
}
