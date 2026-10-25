export const DOCUMENT_LIMITS = {
  fileBytes: 4 * 1024 * 1024,
  bodyBytes: 4 * 1024 * 1024 + 128 * 1024,
  pages: 80,
  textPages: 20,
  pageCharacters: 8000,
  textCharacters: 60000,
  visionPages: 4,
  visionImageBytes: 256 * 1024,
  visionPixels: 2_000_000,
  timeoutMs: 20000,
} as const;
