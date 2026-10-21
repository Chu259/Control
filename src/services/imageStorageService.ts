import { Filesystem, Directory } from '@capacitor/filesystem';
import { Product } from '../types';

export const formatImageFileName = (barcode?: string, id?: string, dataUrl?: string): string => {
  const cleanCode = (barcode || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const baseName = cleanCode || (id || 'prod').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const isPng = dataUrl?.startsWith('data:image/png');
  const ext = isPng ? 'png' : 'jpg';
  return `${baseName}.${ext}`;
};

/**
 * Service to manage physical public image replicas in the phone's native file storage.
 * Bypasses Scoped Storage barriers by storing images directly in the public root folder
 * 'depos_images' (and Documents/depos_images) accessible via Android Files / WhatsApp / Quick Share.
 */
export const ImageStorageService = {
  /**
   * Initializes the public 'depos_images' folder in root ExternalStorage and Documents.
   */
  async initImageDirectory(): Promise<void> {
    try {
      await Filesystem.mkdir({
        path: 'depos_images',
        directory: Directory.ExternalStorage,
        recursive: true,
      });
    } catch {
      // Ignore if already exists or restricted
    }

    try {
      await Filesystem.mkdir({
        path: 'depos_images',
        directory: Directory.Documents,
        recursive: true,
      });
    } catch {
      // Ignore if already exists
    }
  },

  /**
   * Saves a physical replica of a product's image into the public 'depos_images' folder.
   * Named by product barcode (e.g. "7790670050012.jpg").
   */
  async saveProductImageReplica(product: {
    barcode?: string;
    barcodeUnit?: string;
    id?: string;
    image?: string;
  }): Promise<{ success: boolean; path?: string }> {
    if (!product.image || !product.image.startsWith('data:image/')) {
      return { success: false };
    }

    const barcode = product.barcodeUnit || product.barcode || product.id;
    const fileName = formatImageFileName(barcode, product.id, product.image);
    const base64Data = product.image.includes(',')
      ? product.image.split(',')[1]
      : product.image;

    let saved = false;
    let savedUri: string | undefined;

    // 1. Write to public root ExternalStorage (/storage/emulated/0/depos_images)
    try {
      const res = await Filesystem.writeFile({
        path: `depos_images/${fileName}`,
        data: base64Data,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
      saved = true;
      savedUri = res.uri;
    } catch (err) {
      console.warn(`Could not write to ExternalStorage/depos_images/${fileName}:`, err);
    }

    // 2. Also write/mirror to public Documents (/storage/emulated/0/Documents/depos_images)
    // Ensures accessibility on Android 11+ with Scoped Storage restrictions
    try {
      const res = await Filesystem.writeFile({
        path: `depos_images/${fileName}`,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });
      saved = true;
      if (!savedUri) savedUri = res.uri;
    } catch (err) {
      console.warn(`Could not write to Documents/depos_images/${fileName}:`, err);
    }

    return { success: saved, path: savedUri };
  },

  /**
   * Replicates all product images into the public 'depos_images' folder.
   * Used during smart JSON backup import or mass synchronization.
   */
  async replicateAllProductImages(products: Product[]): Promise<{ total: number; replicated: number }> {
    await this.initImageDirectory();
    let replicated = 0;
    const withImages = products.filter((p) => p.image && p.image.startsWith('data:image/'));

    for (const p of withImages) {
      try {
        const res = await this.saveProductImageReplica(p);
        if (res.success) replicated++;
      } catch (err) {
        console.warn(`Failed replicating image for product ${p.barcode || p.name}:`, err);
      }
    }

    return { total: withImages.length, replicated };
  },
};
