import { Filesystem, Directory } from '@capacitor/filesystem';
import { ImageStorageService } from './imageStorageService';
import { shareBase64File } from '../utils/nativeShare';

export interface AssistantItem {
  id: string;
  barcode: string;
  name: string;
  images: [string, string]; // Exactly 2 top commercial white-background images
  selectedImageIndex: 0 | 1;
  status: 'pending' | 'approved';
  scannedAt: string;
  savedImagePath?: string;
  isLoadingImages?: boolean;
}

const STORAGE_KEY = 'depos_catalog_assistant_queue_v1';

/**
 * Generates a clean, studio-grade white-background commercial pack image (JPEG data URL)
 * when an external supermarket catalog photo is unavailable or offline.
 */
function generateStudioCatalogImage(
  barcode: string,
  productName: string,
  variant: 'front' | 'angled'
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Clean studio pure white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 600, 600);

  // Subtle floor shadow
  const shadowGrad = ctx.createRadialGradient(300, 520, 30, 300, 520, 220);
  shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.18)');
  shadowGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.05)');
  shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(300, 520, 200, 35, 0, 0, Math.PI * 2);
  ctx.fill();

  // Commercial Product Packaging Body
  ctx.save();
  if (variant === 'angled') {
    ctx.translate(20, -10);
  }

  // Pack colors based on barcode hash
  const hash = barcode.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue = (hash * 47) % 360;
  const primaryColor = `hsl(${hue}, 70%, 45%)`;
  const secondaryColor = `hsl(${(hue + 40) % 360}, 85%, 55%)`;

  // Draw Packaging Bottle / Box
  const packGrad = ctx.createLinearGradient(160, 100, 440, 500);
  packGrad.addColorStop(0, primaryColor);
  packGrad.addColorStop(1, secondaryColor);

  ctx.fillStyle = packGrad;
  ctx.strokeStyle = '#D1D5DB';
  ctx.lineWidth = 2;

  // Rounded pack shape
  const x = 180;
  const y = 110;
  const w = 240;
  const h = 390;
  const r = 24;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // White commercial label block
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(200, 200, 200, 240, 16);
  ctx.fill();
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Commercial Badge
  ctx.fillStyle = primaryColor;
  ctx.beginPath();
  ctx.roundRect(220, 220, 160, 28, 8);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CATÁLOGO OFICIAL', 300, 239);

  // Product Name on Label
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 16px sans-serif';
  const nameToRender = productName || `PRODUCTO ${barcode.slice(-4)}`;
  const displayWords = nameToRender.split(' ');
  const line1 = displayWords.slice(0, 3).join(' ');
  const line2 = displayWords.slice(3, 6).join(' ');
  ctx.fillText(line1, 300, 280);
  if (line2) {
    ctx.font = '13px sans-serif';
    ctx.fillText(line2, 300, 302);
  }

  // Simulated Barcode graphic on label
  ctx.fillStyle = '#000000';
  for (let i = 230; i < 370; i += 5) {
    const barW = (i % 3 === 0) ? 3 : 1.5;
    ctx.fillRect(i, 350, barW, 40);
  }
  ctx.font = 'bold 11px monospace';
  ctx.fillText(barcode, 300, 405);

  // Variant Indicator
  ctx.fillStyle = '#6B7280';
  ctx.font = '10px sans-serif';
  ctx.fillText(variant === 'front' ? 'OPCIÓN 1: FRENTE NETO' : 'OPCIÓN 2: PACKAGING COMERCIAL', 300, 425);

  ctx.restore();

  // Return crisp JPEG
  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Downloads a remote image URL or converts data URL to base64 JPEG
 */
async function convertUrlToJpegBase64(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('data:image/jpeg') || imageUrl.startsWith('data:image/jpg')) {
    return imageUrl.includes(',') ? imageUrl.split(',')[1] : imageUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 600;
        canvas.height = img.naturalHeight || 600;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          resolve(dataUrl.split(',')[1]);
          return;
        }
      } catch (err) {
        console.warn('Canvas conversion failed, fallback:', err);
      }
      resolve('');
    };
    img.onerror = () => {
      resolve('');
    };
    img.src = imageUrl;
  });
}

export const CatalogAssistantService = {
  /**
   * Retrieves the current assistant queue
   */
  getItems(): AssistantItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  /**
   * Saves the assistant queue
   */
  saveItems(items: AssistantItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Error saving assistant items:', e);
    }
  },

  /**
   * Fetches product details and strictly the top 2 commercial white-background images
   */
  async extractProductData(barcode: string): Promise<{
    name: string;
    images: [string, string];
  }> {
    const cleanCode = barcode.trim();
    let suggestedName = `Artículo ${cleanCode}`;
    let remoteFrontImage: string | null = null;
    let remoteBackOrPackagingImage: string | null = null;

    // 1. Try querying Open Food Facts (global + Argentina mirror)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${cleanCode}.json`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json.status === 1 && json.product) {
          const p = json.product;
          const detected =
            p.product_name_es ||
            p.product_name ||
            p.generic_name_es ||
            p.generic_name ||
            p.brands;

          if (detected) {
            const brand = p.brands ? `${p.brands} - ` : '';
            suggestedName = `${brand}${detected}`.trim();
          }

          if (p.image_front_url || p.image_url) {
            remoteFrontImage = p.image_front_url || p.image_url;
          }
          if (p.image_packaging_url || p.image_ingredients_url) {
            remoteBackOrPackagingImage = p.image_packaging_url || p.image_ingredients_url;
          }
        }
      }
    } catch (e) {
      // Offline or request timed out
    }

    // 2. Build strictly the TOP 2 commercial images with studio white background
    const option1 = remoteFrontImage || generateStudioCatalogImage(cleanCode, suggestedName, 'front');
    const option2 =
      remoteBackOrPackagingImage ||
      generateStudioCatalogImage(cleanCode, suggestedName, 'angled');

    return {
      name: suggestedName,
      images: [option1, option2],
    };
  },

  /**
   * Adds a single barcode to the queue and starts background image extraction
   */
  async addBarcode(barcode: string): Promise<AssistantItem> {
    const cleanCode = barcode.trim().replace(/[^0-9]/g, '');
    const items = this.getItems();

    // Check if already in queue
    const existing = items.find((it) => it.barcode === cleanCode);
    if (existing) {
      return existing;
    }

    const newItem: AssistantItem = {
      id: `asist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      barcode: cleanCode,
      name: `Cargando producto (${cleanCode})...`,
      images: [
        generateStudioCatalogImage(cleanCode, 'Cargando...', 'front'),
        generateStudioCatalogImage(cleanCode, 'Cargando...', 'angled'),
      ],
      selectedImageIndex: 0,
      status: 'pending',
      scannedAt: new Date().toISOString(),
      isLoadingImages: true,
    };

    items.unshift(newItem);
    this.saveItems(items);

    // Background extraction
    this.extractProductData(cleanCode).then(({ name, images }) => {
      const currentList = this.getItems();
      const idx = currentList.findIndex((it) => it.id === newItem.id);
      if (idx !== -1) {
        currentList[idx].name = name;
        currentList[idx].images = images;
        currentList[idx].isLoadingImages = false;
        this.saveItems(currentList);
        window.dispatchEvent(new CustomEvent('catalog_assistant_updated'));
      }
    });

    return newItem;
  },

  /**
   * Adds multiple barcodes in a rapid burst
   */
  async addBurstCodes(barcodes: string[]): Promise<number> {
    let addedCount = 0;
    for (const rawCode of barcodes) {
      const clean = rawCode.trim().replace(/[^0-9]/g, '');
      if (clean.length >= 8) {
        await this.addBarcode(clean);
        addedCount++;
      }
    }
    return addedCount;
  },

  /**
   * Updates commercial name of an item
   */
  updateName(id: string, newName: string): void {
    const items = this.getItems();
    const item = items.find((it) => it.id === id);
    if (item) {
      item.name = newName;
      this.saveItems(items);
      window.dispatchEvent(new CustomEvent('catalog_assistant_updated'));
    }
  },

  /**
   * Selects image 0 (Option 1) or 1 (Option 2)
   */
  selectImage(id: string, imageIndex: 0 | 1): void {
    const items = this.getItems();
    const item = items.find((it) => it.id === id);
    if (item) {
      item.selectedImageIndex = imageIndex;
      this.saveItems(items);
      window.dispatchEvent(new CustomEvent('catalog_assistant_updated'));
    }
  },

  /**
   * Approves the item:
   * 1. Saves physical photo in real JPG format strictly to "Almacenamiento interno/Documents/depos_images/[barcode].jpg"
   * 2. Marks item as approved in local queue
   */
  async approveItem(id: string): Promise<{ success: boolean; filePath?: string }> {
    const items = this.getItems();
    const item = items.find((it) => it.id === id);
    if (!item) return { success: false };

    const selectedImage = item.images[item.selectedImageIndex];
    let base64Jpeg = await convertUrlToJpegBase64(selectedImage);

    // If conversion fails, use generated studio shot as fail-safe
    if (!base64Jpeg) {
      const fallbackDataUrl = generateStudioCatalogImage(
        item.barcode,
        item.name,
        item.selectedImageIndex === 0 ? 'front' : 'angled'
      );
      base64Jpeg = fallbackDataUrl.split(',')[1];
    }

    const fileName = `${item.barcode}.jpg`;
    let savedUri: string | undefined;

    // 1. Write physically to Documents/depos_images/[barcode].jpg
    try {
      const docRes = await Filesystem.writeFile({
        path: `depos_images/${fileName}`,
        data: base64Jpeg,
        directory: Directory.Documents,
        recursive: true,
      });
      savedUri = docRes.uri;
    } catch (err) {
      console.warn(`Filesystem.writeFile Documents/depos_images/${fileName} error:`, err);
    }

    // 2. Also replicate to ExternalStorage/depos_images/[barcode].jpg
    try {
      const extRes = await Filesystem.writeFile({
        path: `depos_images/${fileName}`,
        data: base64Jpeg,
        directory: Directory.ExternalStorage,
        recursive: true,
      });
      if (!savedUri) savedUri = extRes.uri;
    } catch (err) {
      console.warn(`Filesystem.writeFile ExternalStorage/depos_images/${fileName} error:`, err);
    }

    // Mark as approved
    item.status = 'approved';
    item.savedImagePath = savedUri || `depos_images/${fileName}`;
    this.saveItems(items);
    window.dispatchEvent(new CustomEvent('catalog_assistant_updated'));

    return { success: true, filePath: savedUri || `depos_images/${fileName}` };
  },

  /**
   * Deletes an item from the queue
   */
  deleteItem(id: string): void {
    const items = this.getItems().filter((it) => it.id !== id);
    this.saveItems(items);
    window.dispatchEvent(new CustomEvent('catalog_assistant_updated'));
  },

  /**
   * Clears all items in the queue
   */
  clearQueue(): void {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('catalog_assistant_updated'));
  },

  /**
   * Generates the ultralightweight JSON payload containing EXCLUSIVELY
   * the Commercial Name and the Barcode (Zero Base64).
   * E.g.:
   * [
   *   {
   *     "barcode": "7790070507273",
   *     "name": "Aceite de Girasol Cocinero 900ml"
   *   }
   * ]
   */
  getLightweightCatalogJson(): string {
    const items = this.getItems();
    // Only approved items or all non-empty items
    const targetItems = items.filter((it) => it.name && it.barcode);
    const cleanList = targetItems.map((it) => ({
      barcode: it.barcode,
      name: it.name,
    }));
    return JSON.stringify(cleanList, null, 2);
  },

  /**
   * Exports the lightweight JSON file via native share or browser download
   */
  async exportLightweightJson(): Promise<boolean> {
    const jsonStr = this.getLightweightCatalogJson();
    const todayStr = new Date().toISOString().slice(0, 10);
    const fileName = `catalogo_asistente_${todayStr}.json`;

    // Encode to base64 for native file writer
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    utf8Bytes.forEach((b) => (binary += String.fromCharCode(b)));
    const base64Data = btoa(binary);

    return shareBase64File(base64Data, 'application/json', {
      fileName,
      title: 'Catálogo depos Asistente',
      dialogTitle: 'Compartir Catálogo JSON (.json)',
    });
  },
};
