import { describe, expect, it } from 'vitest';
import { getMimeType, MIME_TYPES, parseFiletype } from './file';

describe('file utilities', () => {
  describe('parseFiletype', () => {
    it('should extract filetype from URL', () => {
      expect(parseFiletype('https://example.com/file.pdf')).toBe('pdf');
      expect(parseFiletype('https://example.com/image.png')).toBe('png');
    });

    it('should handle URLs with query parameters', () => {
      expect(parseFiletype('https://example.com/file.jpg')).toBe('jpg');
    });

    it('should throw for URLs without extension', () => {
      expect(() => parseFiletype('')).toThrow();
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME type for common extensions', () => {
      expect(getMimeType('file.pdf')).toBe(MIME_TYPES.PDF);
      expect(getMimeType('photo.jpg')).toBe(MIME_TYPES.JPEG);
      expect(getMimeType('photo.jpeg')).toBe(MIME_TYPES.JPEG);
      expect(getMimeType('image.png')).toBe(MIME_TYPES.PNG);
      expect(getMimeType('animation.gif')).toBe(MIME_TYPES.GIF);
      expect(getMimeType('image.webp')).toBe(MIME_TYPES.WEBP);
    });

    it('should be case insensitive', () => {
      expect(getMimeType('file.PDF')).toBe(MIME_TYPES.PDF);
      expect(getMimeType('photo.JPG')).toBe(MIME_TYPES.JPEG);
    });

    it('should return undefined for unknown extensions', () => {
      expect(getMimeType('file.xyz')).toBeUndefined();
      expect(getMimeType('file.doc')).toBeUndefined();
    });

    it('should return undefined for files without extension', () => {
      expect(getMimeType('noextension')).toBeUndefined();
    });
  });

  describe('MIME_TYPES', () => {
    it('should have standard MIME type values', () => {
      expect(MIME_TYPES.PDF).toBe('application/pdf');
      expect(MIME_TYPES.JPEG).toBe('image/jpeg');
      expect(MIME_TYPES.PNG).toBe('image/png');
    });
  });
});
