import { describe, expect, it } from 'vitest';
import { MAX_ERA_FILE_SIZE_BYTES, readEraFile } from '../../src/utils/eraFile';

const X12 = 'ISA*00*          *00*          *ZZ*SENDER~GS*HP*SENDER*RECEIVER~ST*835*0001~';

function makeFile(content: BlobPart, name = 'remit.835'): File {
  return new File([content], name, {
    type: 'text/plain',
  });
}

describe('readEraFile', () => {
  it('returns the text of an X12 file', async () => {
    const result = await readEraFile(makeFile(X12));

    expect(result).toEqual({
      ok: true,
      text: X12,
    });
  });

  it('accepts an empty file and leaves emptiness to the required rule', async () => {
    const result = await readEraFile(makeFile(''));

    expect(result).toEqual({
      ok: true,
      text: '',
    });
  });

  it('decodes multi-byte characters rather than mistaking them for binary', async () => {
    // cSpell:ignore CLÍNICA MÉDICA
    const accented = `${X12}N1*PE*CLÍNICA MÉDICA~`;

    const result = await readEraFile(makeFile(accented));

    expect(result).toEqual({
      ok: true,
      text: accented,
    });
  });

  it('rejects a file over the size limit without reading it', async () => {
    const file = makeFile(X12);
    Object.defineProperty(file, 'size', {
      value: MAX_ERA_FILE_SIZE_BYTES + 1,
    });

    const result = await readEraFile(file);

    expect(result).toEqual({
      ok: false,
      error: 'File is too large. The maximum ERA file size is 5 MB.',
    });
  });

  it('rejects a file containing NUL bytes', async () => {
    const result = await readEraFile(makeFile(new Uint8Array([0, 1, 2])));

    expect(result).toEqual({
      ok: false,
      error: 'This file does not look like a text-based 835/X12 file.',
    });
  });

  it('rejects control bytes that no signature identifies and no NUL accompanies', async () => {
    const result = await readEraFile(makeFile(new Uint8Array([1, 2, 3])));

    expect(result).toEqual({
      ok: false,
      error: 'This file does not look like a text-based 835/X12 file.',
    });
  });

  it('rejects invalid UTF-8 that no signature identifies', async () => {
    const result = await readEraFile(makeFile(new Uint8Array([0xc3, 0x28, 0x41])));

    expect(result).toEqual({
      ok: false,
      error: 'This file does not look like a text-based 835/X12 file.',
    });
  });

  it('accepts an X12 file delimited with information separators', async () => {
    const separatorDelimited = 'ISA*00*SENDER\u001dGS*HP*SENDER*RECEIVER\u001dST*835*0001\u001d';

    const result = await readEraFile(makeFile(separatorDelimited));

    expect(result).toEqual({
      ok: true,
      text: separatorDelimited,
    });
  });

  it('accepts an X12 file with CRLF line endings', async () => {
    const withCrlf = 'ISA*00*SENDER~\r\nGS*HP*SENDER*RECEIVER~\r\n';

    const result = await readEraFile(makeFile(withCrlf));

    expect(result).toEqual({
      ok: true,
      text: withCrlf,
    });
  });

  it('names the format of a JPEG renamed to a text extension', async () => {
    const result = await readEraFile(makeFile(new Uint8Array([0xff, 0xd8, 0xff]), 'remit.txt'));

    expect(result).toEqual({
      ok: false,
      error: 'This file is image/jpeg, not a text-based 835/X12 file.',
    });
  });

  it('names the format of a PDF renamed to a text extension', async () => {
    const result = await readEraFile(makeFile(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]), 'remit.txt'));

    expect(result).toEqual({
      ok: false,
      error: 'This file is application/pdf, not a text-based 835/X12 file.',
    });
  });
});
