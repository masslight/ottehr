import { strToU8, Zip, ZipPassThrough } from 'fflate';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import type { PatientDocumentInfo } from 'src/hooks/useGetPatientDocs';
import { getFirstName, getLastName } from 'utils/lib/fhir/patient';
import { MIME_TYPES, sanitizeFileNameForZ3 } from 'utils/lib/utils/file';

const LOCAL_FILE_HEADER_BYTES = 30;
const DATA_DESCRIPTOR_BYTES = 16;
const CENTRAL_DIRECTORY_HEADER_BYTES = 46;
const END_OF_CENTRAL_DIRECTORY_BYTES = 22;
const MAX_ZIP_ARCHIVE_BYTES = 0xffffffff;
const DEFAULT_BLOB_PART_BYTES = 32 * 1024 * 1024;

export class ArchiveTooLargeError extends Error {
  constructor() {
    super('The archive is larger than a ZIP file can hold');
    this.name = 'ArchiveTooLargeError';
  }
}

export const isArchiveSizeError = (error: unknown): boolean => {
  if (error instanceof ArchiveTooLargeError || error instanceof RangeError) return true;
  if (!(error instanceof Error)) return false;
  if (error.name === 'QuotaExceededError') return true;
  return error.name === 'InternalError' && /allocation|memory/i.test(error.message);
};

export const isSingleFileDownload = (documents: PatientDocumentInfo[]): boolean =>
  documents.length === 1 && (documents[0].attachments ?? []).length === 1;

const MAX_LISTED_DOCUMENT_NAMES = 3;

export const describeIncompleteArchive = (documentNames: string[]): string => {
  const listed = documentNames.slice(0, MAX_LISTED_DOCUMENT_NAMES).join(', ');
  const remaining = documentNames.length - MAX_LISTED_DOCUMENT_NAMES;
  return `Some files could not be downloaded and were left out of the archive. Affected documents: ${listed}${
    remaining > 0 ? ` and ${remaining} more` : ''
  }.`;
};

export const makeDocumentsZipFileName = (patient: Patient | undefined, now: DateTime = DateTime.now()): string => {
  const namePart =
    sanitizeFileNameForZ3([getLastName(patient), getFirstName(patient)].filter(Boolean).join('_').toLowerCase()) ||
    'patient';
  return `docs-${namePart}-${now.toFormat('yyyy-MM-dd_HH-mm')}.zip`;
};

export interface DocumentsZipWriter {
  add: (name: string, bytes: Uint8Array) => void;
  finish: () => Blob;
  discard: () => void;
}

export interface DocumentsZipWriterOptions {
  blobPartBytes?: number;
  maxArchiveBytes?: number;
}

export const createDocumentsZipWriter = ({
  blobPartBytes = DEFAULT_BLOB_PART_BYTES,
  maxArchiveBytes = MAX_ZIP_ARCHIVE_BYTES,
}: DocumentsZipWriterOptions = {}): DocumentsZipWriter => {
  let parts: Blob[] = [];
  let pending: Uint8Array<ArrayBuffer>[] = [];
  let pendingBytes = 0;
  let entriesBytes = 0;
  let centralDirectoryBytes = 0;
  let zipError: Error | undefined;

  const flush = (): void => {
    if (pending.length === 0) return;
    parts.push(new Blob(pending));
    pending = [];
    pendingBytes = 0;
  };

  const zip = new Zip((error, chunk, final) => {
    if (error) {
      zipError = error;
      return;
    }
    pending.push(chunk);
    pendingBytes += chunk.length;
    if (final || pendingBytes >= blobPartBytes) flush();
  });

  const throwZipError = (): void => {
    if (!zipError) return;
    const error = zipError;
    zipError = undefined;
    throw error;
  };

  return {
    add: (name, bytes) => {
      const nameBytes = strToU8(name).length;
      const entryBytes = LOCAL_FILE_HEADER_BYTES + nameBytes + bytes.length + DATA_DESCRIPTOR_BYTES;
      const entryDirectoryBytes = CENTRAL_DIRECTORY_HEADER_BYTES + nameBytes;
      const archiveBytes =
        entriesBytes + entryBytes + centralDirectoryBytes + entryDirectoryBytes + END_OF_CENTRAL_DIRECTORY_BYTES;
      if (archiveBytes > maxArchiveBytes) {
        throw new ArchiveTooLargeError();
      }

      const entry = new ZipPassThrough(name);
      zip.add(entry);
      entry.push(bytes, true);
      throwZipError();

      entriesBytes += entryBytes;
      centralDirectoryBytes += entryDirectoryBytes;
    },
    finish: () => {
      zip.end();
      throwZipError();
      flush();
      return new Blob(parts, { type: MIME_TYPES.ZIP });
    },
    discard: () => {
      zip.terminate();
      parts = [];
      pending = [];
      pendingBytes = 0;
    },
  };
};
