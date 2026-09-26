import { Product } from '../types';

/**
 * Normalizes text for search: lowercase, removes accents / diacritics.
 */
export function normalizeSearchText(text?: string | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Breaks a user search query into normalized individual word tokens.
 * E.g. "Perita Molto" -> ["perita", "molto"]
 * Insensitive to word ordering.
 */
export function tokenizeQuery(query: string): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  return normalized.split(/\s+/).filter((t) => t.length > 0);
}

/**
 * Checks if a Product matches all word tokens of the search query in ANY order.
 * Works seamlessly for:
 * - "Molto Perita" <-> "Perita Molto"
 * - Partial terms: "tom per molt"
 * - Barcodes (Unit or Bulk)
 * - Category names
 * - Notes & Bulk pack descriptions
 */
export function matchProductTokens(product: Product, query: string): boolean {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return true;

  // Build searchable corpus from all product attributes
  const searchableParts = [
    product.name,
    product.category,
    product.barcode,
    product.barcodeUnit,
    product.barcodeBulk,
    product.bulkUnitName,
    product.notes,
    product.unit,
  ];

  const corpus = normalizeSearchText(searchableParts.filter(Boolean).join(' '));

  // Check if EVERY token is contained somewhere in the corpus (order independent)
  return tokens.every((token) => corpus.includes(token));
}

/**
 * Helper to filter an array of products using the tokenized search matcher.
 */
export function filterProductsByTokens(products: Product[], query: string): Product[] {
  if (!query.trim()) return products;
  return products.filter((p) => matchProductTokens(p, query));
}
