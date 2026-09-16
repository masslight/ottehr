import { Jimp, JimpMime } from 'jimp';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Document } from '../document';
import { generatePdf } from '../draw';

const makeImage = async (mime: typeof JimpMime.jpeg | typeof JimpMime.png): Promise<Uint8Array> => {
  const image = new Jimp({ width: 40, height: 24, color: 0xff0000ff });
  // cast: jimp's Buffer type resolves against a second @types/node copy in this workspace
  return Uint8Array.from((await image.getBuffer(mime)) as unknown as Uint8Array);
};

/** Copies into a fresh ArrayBuffer: a view's .buffer is ArrayBufferLike, which ImageItem does not take. */
const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const documentWith = (imageItems: Document['imageItems']): Document => ({
  patientInfo: { name: 'Test Patient', id: 'patient-id', friendlyId: 'ABC-123' },
  visitInfo: { type: 'In Person', time: '10:00 AM', date: '08/10/2026' },
  sections: [{ title: 'Contact information', items: [{ question: 'Email', answer: 'test@example.com' }] }],
  imageItems,
});

const indexOfBytes = (haystack: Uint8Array, needle: Uint8Array): number => {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
};

describe('paperwork-to-pdf image rendering', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('embeds an image by its real format, not by the name/contentType it was stored under', async () => {
    // The staging failure: a JPEG stored (and labelled) as insurance-card-front-2.png. Handing
    // those bytes to embedPng throws "The input is not a PNG file!", so the format has to come
    // from the bytes. pdf-lib embeds JPEG streams verbatim, so finding the bytes back in the
    // output proves the JPEG decoder was used.
    const jpeg = await makeImage(JimpMime.jpeg);
    const pdf = await generatePdf(
      documentWith([{ title: 'Insurance card front (secondary)', imageBytes: Promise.resolve(toArrayBuffer(jpeg)) }])
    );
    const saved = await pdf.save();

    expect(indexOfBytes(saved, jpeg)).toBeGreaterThan(-1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('embeds a real PNG', async () => {
    const png = await makeImage(JimpMime.png);
    const pdf = await generatePdf(
      documentWith([{ title: 'Photo ID front', imageBytes: Promise.resolve(toArrayBuffer(png)) }])
    );

    expect((await pdf.save()).length).toBeGreaterThan(0);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('renders a placeholder for an unreadable image instead of failing the whole document', async () => {
    const jpeg = await makeImage(JimpMime.jpeg);
    const pdf = await generatePdf(
      documentWith([
        {
          title: 'Insurance card front',
          imageBytes: Promise.resolve(toArrayBuffer(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))),
        },
        { title: 'Insurance card back', imageBytes: Promise.reject(new Error('z3 download failed')) },
        { title: 'Photo ID front', imageBytes: Promise.resolve(toArrayBuffer(jpeg)) },
      ])
    );
    const saved = await pdf.save();

    // the good image still made it into the document
    expect(indexOfBytes(saved, jpeg)).toBeGreaterThan(-1);
    expect(console.error).toHaveBeenCalledTimes(2);
    expect(vi.mocked(console.error).mock.calls.map((call) => String(call[0]))).toEqual([
      expect.stringContaining("'Insurance card front' is not a renderable image"),
      expect.stringContaining("failed to download image 'Insurance card back'"),
    ]);
  });
});
