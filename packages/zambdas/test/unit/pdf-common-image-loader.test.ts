import { PDFImage } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { createImageLoader } from '../../src/shared/pdf/pdf-common';
import { PdfClient } from '../../src/shared/pdf/types';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const GARBAGE_BYTES = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

// embedImage is createPdfClient's PNG decoder; embedJpg is the JPEG one.
const makeClient = (
  overrides: Partial<Pick<PdfClient, 'embedImage' | 'embedJpg'>> = {}
): Pick<PdfClient, 'embedImage' | 'embedJpg'> => ({
  embedImage: vi.fn(async () => 'png-image' as unknown as PDFImage),
  embedJpg: vi.fn(async () => 'jpeg-image' as unknown as PDFImage),
  ...overrides,
});

const embed = async (
  client: Pick<PdfClient, 'embedImage' | 'embedJpg'>,
  bytes: Uint8Array,
  url: string
): Promise<PDFImage> => createImageLoader('token').embedImage(client as PdfClient, toArrayBuffer(bytes), url);

describe('visit details pdf image loader', () => {
  it('embeds by the bytes, not by the url extension', async () => {
    // The staging failure: a JPEG stored as insurance-card-front-2.png. Going by the extension sent
    // it to the PNG decoder, which threw and left the card missing from the PDF entirely.
    const client = makeClient();
    await expect(embed(client, JPEG_BYTES, 'https://z3/2026-08-10-insurance-card-front-2.png')).resolves.toBe(
      'jpeg-image'
    );
    expect(client.embedImage).not.toHaveBeenCalled();

    const other = makeClient();
    await expect(embed(other, PNG_BYTES, 'https://z3/2026-08-10-insurance-card-front-2.jpg')).resolves.toBe(
      'png-image'
    );
    expect(other.embedJpg).not.toHaveBeenCalled();
  });

  it('falls back to trying both decoders when the format cannot be named', async () => {
    const client = makeClient({
      embedJpg: vi.fn(async () => {
        throw new Error('not a jpeg');
      }),
    });

    await expect(embed(client, GARBAGE_BYTES, 'https://z3/card.dat')).resolves.toBe('png-image');
    expect(client.embedJpg).toHaveBeenCalledOnce();
  });
});
