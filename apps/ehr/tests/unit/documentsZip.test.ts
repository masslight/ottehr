import { unzipSync } from 'fflate';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { nameArchiveEntries } from 'utils/lib/utils/archive-entry-names';
import { describe, expect, it } from 'vitest';
import {
  ArchiveTooLargeError,
  createDocumentsZipWriter,
  describeIncompleteArchive,
  isArchiveSizeError,
  isSingleFileDownload,
  makeDocumentsZipFileName,
} from '../../src/features/visits/shared/components/patient/docs/documentsZip';
import type { PatientDocumentInfo } from '../../src/hooks/useGetPatientDocs';

describe('isSingleFileDownload', () => {
  const document = (attachmentUrls: (string | undefined)[]): PatientDocumentInfo => ({
    id: 'doc-1',
    docName: 'Scan.pdf',
    attachments: attachmentUrls.map((z3Url, i) => ({ title: `page-${i}.pdf`, z3Url })),
  });

  it('is a single-file download only for one document with exactly one attachment', () => {
    expect(isSingleFileDownload([document(['https://z3.test/a'])])).toBe(true);
  });

  it('counts every attachment, including one without a file, so nothing is dropped silently', () => {
    expect(isSingleFileDownload([document(['https://z3.test/a', undefined])])).toBe(false);
  });

  it('is never a single-file download for several documents or a document without attachments', () => {
    expect(isSingleFileDownload([document(['https://z3.test/a']), document(['https://z3.test/b'])])).toBe(false);
    expect(isSingleFileDownload([document([])])).toBe(false);
  });
});

describe('describeIncompleteArchive', () => {
  it('names every affected document when there are three or fewer', () => {
    expect(describeIncompleteArchive(['Scan.pdf'])).toBe(
      'Some files could not be downloaded and were left out of the archive. Affected documents: Scan.pdf.'
    );
    expect(describeIncompleteArchive(['Scan.pdf', 'Lab Result.pdf', 'Visit Note.pdf'])).toBe(
      'Some files could not be downloaded and were left out of the archive. Affected documents: Scan.pdf, Lab Result.pdf, Visit Note.pdf.'
    );
  });

  it('names the first three affected documents and counts the rest', () => {
    expect(describeIncompleteArchive(['A.pdf', 'B.pdf', 'C.pdf', 'D.pdf', 'E.pdf'])).toBe(
      'Some files could not be downloaded and were left out of the archive. Affected documents: A.pdf, B.pdf, C.pdf and 2 more.'
    );
  });
});

const PATIENT: Patient = { resourceType: 'Patient', name: [{ family: 'Black', given: ['Oliver', 'Nickolas'] }] };
const NOW = DateTime.fromISO('2026-10-16T14:30:45Z', { zone: 'UTC' });

const bytesOf = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text);

const readZip = async (blob: Blob): Promise<Record<string, string>> => {
  const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  return Object.fromEntries(Object.entries(entries).map(([name, data]) => [name, new TextDecoder().decode(data)]));
};

describe('makeDocumentsZipFileName', () => {
  it('names the archive after the patient with a timestamp to the minute', () => {
    expect(makeDocumentsZipFileName(PATIENT, NOW)).toBe('docs-black_oliver-2026-10-16_14-30.zip');
  });

  it("uses the clock's zone, which is the user's local zone by default", () => {
    expect(makeDocumentsZipFileName(PATIENT, NOW.setZone('America/New_York'))).toBe(
      'docs-black_oliver-2026-10-16_10-30.zip'
    );
  });

  it('replaces characters that are unsafe in a file name', () => {
    const patient: Patient = { resourceType: 'Patient', name: [{ family: "O'Neil Smith", given: ['Zoë'] }] };
    expect(makeDocumentsZipFileName(patient, NOW)).toBe("docs-o'neil_smith_zo_-2026-10-16_14-30.zip");
  });

  it('falls back to "patient" when there is no name', () => {
    expect(makeDocumentsZipFileName(undefined, NOW)).toBe('docs-patient-2026-10-16_14-30.zip');
    expect(makeDocumentsZipFileName({ resourceType: 'Patient' }, NOW)).toBe('docs-patient-2026-10-16_14-30.zip');
  });
});

describe('createDocumentsZipWriter', () => {
  it('writes every entry and its bytes into an application/zip Blob spread over several parts', async () => {
    const writer = createDocumentsZipWriter({ blobPartBytes: 8 });
    writer.add('Visit Note.pdf', bytesOf('visit note'));
    writer.add('Ünïcødé scan.png', bytesOf('scan'));

    const blob = writer.finish();

    expect(blob.type).toBe('application/zip');
    expect(await readZip(blob)).toEqual({ 'Visit Note.pdf': 'visit note', 'Ünïcødé scan.png': 'scan' });
  });

  it('keeps documents that share a title apart by their dates', async () => {
    const names = nameArchiveEntries([
      {
        url: 'https://z3.test/a',
        title: 'Visit Note.pdf',
        contentType: 'application/pdf',
        date: '2024-10-12T08:30:00Z',
      },
      {
        url: 'https://z3.test/b',
        title: 'Visit Note.pdf',
        contentType: 'application/pdf',
        date: '2024-02-04T08:30:00Z',
      },
    ]);
    const writer = createDocumentsZipWriter();
    writer.add(names[0], bytesOf('october'));
    writer.add(names[1], bytesOf('february'));

    expect(await readZip(writer.finish())).toEqual({
      'Visit Note_2024-10-12_08-30-00.pdf': 'october',
      'Visit Note_2024-02-04_08-30-00.pdf': 'february',
    });
  });

  it('refuses an entry that would take the archive past the ZIP size limit and keeps the rest intact', async () => {
    const writer = createDocumentsZipWriter({ maxArchiveBytes: 200 });
    writer.add('small.pdf', bytesOf('ok'));

    expect(() => writer.add('large.pdf', new Uint8Array(200))).toThrow(ArchiveTooLargeError);
    expect(await readZip(writer.finish())).toEqual({ 'small.pdf': 'ok' });
  });

  it('produces nothing once discarded', () => {
    const writer = createDocumentsZipWriter();
    writer.add('note.pdf', bytesOf('note'));

    writer.discard();

    expect(() => writer.finish()).toThrow();
  });
});

describe('isArchiveSizeError', () => {
  it.each([
    ['the ZIP format limit', new ArchiveTooLargeError()],
    ['a failed buffer allocation', new RangeError('Array buffer allocation failed')],
    ["Firefox's allocation failure", Object.assign(new Error('allocation size overflow'), { name: 'InternalError' })],
    ['an exhausted blob storage quota', new DOMException('The quota has been exceeded.', 'QuotaExceededError')],
  ])('treats %s as the archive being too large', (_label, error) => {
    expect(isArchiveSizeError(error)).toBe(true);
  });

  it.each([
    ['a network failure', new TypeError('Failed to fetch')],
    ['a presign failure', new Error('Failed to fetch presigned URL for https://z3.test/a')],
    ['a cancelled request', new DOMException('This operation was aborted', 'AbortError')],
    ['an unrelated InternalError', Object.assign(new Error('too much recursion'), { name: 'InternalError' })],
    ['any other error', new Error('Something else went wrong')],
    ['a non-error value', 'RangeError'],
  ])('does not treat %s as the archive being too large', (_label, error) => {
    expect(isArchiveSizeError(error)).toBe(false);
  });
});
