/**
 * BOM-aware text decoding.
 * Detects UTF-16 LE/BE and UTF-8 BOM, falls back to UTF-8.
 */
export function decodeWithBOM(raw: Uint8Array): string {
  if (raw.length >= 2) {
    // UTF-16 LE BOM: 0xFF 0xFE
    if (raw[0] === 0xFF && raw[1] === 0xFE) {
      return new TextDecoder('utf-16le').decode(raw);
    }
    // UTF-16 BE BOM: 0xFE 0xFF
    if (raw[0] === 0xFE && raw[1] === 0xFF) {
      return new TextDecoder('utf-16be').decode(raw);
    }
  }
  // UTF-8 (with or without BOM) — TextDecoder('utf-8') handles UTF-8 BOM automatically
  return new TextDecoder('utf-8').decode(raw);
}
