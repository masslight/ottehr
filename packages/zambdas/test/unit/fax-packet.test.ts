import { PageSizes, PDFDocument } from 'pdf-lib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/shared/z3Utils', () => ({
  createPresignedUrl: (_token: string, url: string) => Promise.resolve(url),
  uploadObjectToZ3: vi.fn(),
}));

import { drawFaxCoverPage, loadFaxCoverAssets } from '../../src/shared/fax/fax-cover-page';
import { assembleFaxPacket, renderFaxContent } from '../../src/shared/fax/fax-packet';

// Smallest valid PNG (1x1, transparent) — pdf-lib needs real image bytes to embed.
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const makePdfBytes = async (pageCount: number): Promise<Uint8Array> => {
  const document = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) document.addPage(PageSizes.A4);
  return document.save();
};

const coverContext = {
  recipient: { faxNumber: '+12125551234', name: 'Dr. Tomas Jhonson' },
  sender: { organizationName: 'Ottehr Urgent Care' },
  generatedAt: '05/11/2026 11:57 AM',
};

describe('fax packet', () => {
  let files: Record<string, { bytes: Uint8Array; ok: boolean }>;

  beforeEach(async () => {
    files = {
      'https://z3.example/note.pdf': { bytes: await makePdfBytes(2), ok: true },
      'https://z3.example/card.png': { bytes: new Uint8Array(ONE_PIXEL_PNG), ok: true },
      'https://z3.example/archive.zip': { bytes: new Uint8Array([1, 2, 3]), ok: true },
      'https://z3.example/missing.pdf': { bytes: new Uint8Array(), ok: false },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const file = files[url];
        return Promise.resolve({
          ok: file?.ok ?? false,
          status: file?.ok ? 200 : 404,
          arrayBuffer: () => Promise.resolve(file?.bytes.buffer ?? new ArrayBuffer(0)),
        });
      })
    );
  });

  it('renders documents in order, one page per image', async () => {
    const content = await renderFaxContent(
      [{ url: 'https://z3.example/note.pdf' }, { url: 'https://z3.example/card.png' }],
      'token'
    );

    expect(content.pageCount).toBe(3);
  });

  it('skips formats a fax cannot render without downloading them', async () => {
    const content = await renderFaxContent(
      [{ url: 'https://z3.example/archive.zip', contentType: 'application/zip' }],
      'token'
    );

    expect(content.pageCount).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails rather than silently sending a partial record when a selected document is unreachable', async () => {
    await expect(
      renderFaxContent([{ url: 'https://z3.example/missing.pdf' }, { url: 'https://z3.example/note.pdf' }], 'token')
    ).rejects.toThrow('Could not download fax attachment');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fails rather than silently omitting an unreadable selected document', async () => {
    files['https://z3.example/corrupt.pdf'] = { bytes: new Uint8Array([1, 2, 3]), ok: true };

    await expect(renderFaxContent([{ url: 'https://z3.example/corrupt.pdf' }], 'token')).rejects.toThrow();
  });

  it('stops reading a selection as soon as it crosses the memory budget', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(new Uint8Array(11), { status: 200 }));

    await expect(
      renderFaxContent([{ url: 'https://z3.example/huge.pdf' }], 'token', { maxBytes: 10 })
    ).rejects.toMatchObject({
      message: expect.stringContaining('too large to fax'),
    });
  });

  it('puts a cover sheet in front of the documents', async () => {
    const content = await renderFaxContent([{ url: 'https://z3.example/note.pdf' }], 'token');

    const packet = await assembleFaxPacket(
      content,
      { title: 'Medical Record of Black, Oliver', identifiers: ['PID: 123456'] },
      coverContext,
      await loadFaxCoverAssets()
    );

    expect((await PDFDocument.load(packet)).getPageCount()).toBe(3);
  });

  it('lays out a cover sheet whose fields are longer than a line', async () => {
    const content = await renderFaxContent([], 'token');

    const packet = await assembleFaxPacket(
      content,
      {
        title: 'Comprehensive Urgent Care and Occupational Medicine Visit of Vandersteen-Whitmore, Alexandria',
        identifiers: ['PID: 123456', 'VID: 3f2b7c10-9d44-4a1e-9d8f-6a2b3c4d5e6f', 'DOS: 05/05/2026'],
      },
      {
        ...coverContext,
        recipient: {
          faxNumber: '+12125551234',
          name: 'Dr. Bartholomew Fitzgerald-Montgomery III, MD, FACP',
          organization: 'Greater Metropolitan Area Urgent Care and Family Medicine Associates',
          phoneNumber: '2125559876',
        },
        sender: {
          organizationName: 'Ottehr Urgent Care of the Greater Metropolitan Area',
          address: '78 Old Town Road, Suite 1400, New York, NY 12345',
          faxNumber: '2125550000',
          phoneNumber: '2125550001',
          senderName: 'Dr. Sarah Lion, MD',
        },
      },
      await loadFaxCoverAssets()
    );

    // Wrapped fields must stay on the cover sheet rather than spilling onto a page of their own.
    expect((await PDFDocument.load(packet)).getPageCount()).toBe(1);
  });

  it('continues below whichever cover-party column is taller', async () => {
    const pdf = await PDFDocument.create();
    const layout = await drawFaxCoverPage(
      pdf,
      {
        title: 'Medical Record of Black, Oliver',
        identifiers: ['PID: 123456'],
        recipient: {
          faxNumber: '+12125551234',
          name: 'Dr. Bartholomew Fitzgerald-Montgomery III, MD, FACP',
          organization: 'Greater Metropolitan Area Urgent Care and Family Medicine Associates',
          phoneNumber: '2125559876',
        },
        sender: { organizationName: 'Ottehr' },
        generatedAt: coverContext.generatedAt,
        pageCount: 1,
      },
      await loadFaxCoverAssets()
    );

    expect(layout.recipientBottom).toBeLessThan(layout.senderBottom);
    expect(layout.partyBottom).toBe(layout.recipientBottom);
  });

  it('reuses the rendered documents for every recipient', async () => {
    const content = await renderFaxContent([{ url: 'https://z3.example/note.pdf' }], 'token');
    const assets = await loadFaxCoverAssets();
    const cover = { title: 'Medical Record of Black, Oliver', identifiers: ['PID: 123456'] };

    const first = await assembleFaxPacket(content, cover, coverContext, assets);
    const second = await assembleFaxPacket(
      content,
      cover,
      { ...coverContext, recipient: { faxNumber: '+12125559999' } },
      assets
    );

    expect((await PDFDocument.load(first)).getPageCount()).toBe(3);
    expect((await PDFDocument.load(second)).getPageCount()).toBe(3);
    // One download for the document, regardless of how many packets were built from it.
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
