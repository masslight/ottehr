import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { List, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { BUCKET_NAMES, OTTEHR_CODE_SYSTEM_BASE_URL } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { createFilesDocumentReferences } from 'utils/lib/fhir/helpers';
import { PATIENT_FOLDERS_CODE } from 'utils/lib/fhir/list';
import { Secrets } from 'utils/lib/secrets';
import { MEDICAL_RECORD_EXPORT_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { MIME_TYPES } from 'utils/lib/utils/file';
import { collectPatientRecordAttachments, getAllPatientDocumentReferences } from '../patient-documents';
import { makeZ3Url } from '../presigned-file-urls/helpers';
import { createPresignedUrl } from '../z3Utils';
import { openAttachmentStream } from './download';
import { MedicalRecordExportUserError } from './errors';
import { makeArchiveFileName, nameAttachments } from './naming';
import { resolveAttachmentSizes } from './sizes';
import { MAX_SINGLE_PUT_BYTES, predictZipSize, streamZipToPresignedUrl, ZipEntry } from './zip-stream';

// Each probe is a one-byte ranged GET, so this bounds wall clock without bounding memory.
const SIZE_PROBE_CONCURRENCY = 20;

// Below this, opening an upload only produces an archive abandoned part-written.
const MIN_STREAMING_BUDGET_MS = 30_000;

export interface RunExportInput {
  oystehr: Oystehr;
  token: string;
  secrets: Secrets | null;
  patientId: string;
  /** Epoch ms the worker must be finished by; enforced as a wall clock, not between documents. */
  deadlineAt?: number;
  onProgress?: (processed: number, total: number) => Promise<void> | void;
}

export interface RunExportResult {
  /** Un-presigned Z3 url of the archive; absent when the chart had nothing to archive. */
  fileUrl?: string;
  fileName: string;
  documentCount: number;
  skippedCount: number;
  archiveBytes: number;
}

/**
 * Builds a patient's medical-record archive and files it in the chart. Runs in a subscription worker, not
 * the request path: the collection is thousands of round trips, far past the 27 s API Gateway ceiling on
 * an `http_auth` zambda.
 */
export const runMedicalRecordExport = async ({
  oystehr,
  token,
  secrets,
  patientId,
  deadlineAt,
  onProgress,
}: RunExportInput): Promise<RunExportResult> => {
  console.log(`Collecting documents for Patient/${patientId}`);

  const [patient, documentReferences, folderLists] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }).catch(() => undefined),
    getAllPatientDocumentReferences(oystehr, patientId),
    getAllFhirSearchPages<List>(
      {
        resourceType: 'List',
        params: [
          { name: 'subject', value: `Patient/${patientId}` },
          { name: 'code', value: PATIENT_FOLDERS_CODE },
        ],
      },
      oystehr
    ),
  ]);

  // Excludes previously generated medical-record archives and sent fax packets. Besides preventing
  // recursive exports, this keeps another recipient's cover-sheet details out of a downloaded record.
  const attachments = collectPatientRecordAttachments(documentReferences);
  console.log(
    `Found ${attachments.length} attachments to archive (of ${documentReferences.length} DocumentReferences)`
  );

  const archiveFileName = makeArchiveFileName(patient);
  const named = nameAttachments(attachments);

  if (named.length === 0) {
    console.log('No documents found for patient');
    return { fileName: archiveFileName, documentCount: 0, skippedCount: 0, archiveBytes: 0 };
  }

  const {
    entries: sized,
    skipped,
    totalBytes,
  } = await resolveAttachmentSizes({
    attachments: named,
    presign: (url) => createPresignedUrl(token, url, 'download'),
    concurrency: SIZE_PROBE_CONCURRENCY,
  });

  console.log(`Resolved ${sized.length} attachment sizes totalling ${totalBytes} bytes; skipped ${skipped.length}`);

  if (sized.length === 0) {
    console.log('No downloadable documents found for patient');
    return {
      fileName: archiveFileName,
      documentCount: 0,
      skippedCount: skipped.length,
      archiveBytes: 0,
    };
  }

  const zipEntries: ZipEntry[] = sized.map((entry) => ({
    name: entry.name,
    size: entry.size,
    open: () =>
      openAttachmentStream({
        url: entry.url,
        name: entry.name,
        presign: (url) => createPresignedUrl(token, url, 'download'),
      }),
  }));

  // One timestamp for prediction and write, so the two cannot describe different archives.
  const mtime = new Date();

  // Fail before creating the Z3 object rather than after opening a doomed upload.
  const predicted = predictZipSize(zipEntries, mtime);
  if (predicted > MAX_SINGLE_PUT_BYTES) {
    throw new MedicalRecordExportUserError(
      `This medical record is too large to export as a single download: the archive would be ` +
        `${Math.round(predicted / (1024 * 1024))} MB, over the ` +
        `${Math.round(MAX_SINGLE_PUT_BYTES / (1024 * 1024))} MB limit for one file.`
    );
  }

  // The whole budget goes to the streaming phase, the only part that holds anything open.
  const streamingBudgetMs = deadlineAt === undefined ? undefined : deadlineAt - Date.now();
  if (streamingBudgetMs !== undefined && streamingBudgetMs < MIN_STREAMING_BUDGET_MS) {
    throw new MedicalRecordExportUserError(
      `Ran out of time measuring this record's ${sized.length} document(s); the export was not started. ` +
        `Please try again.`
    );
  }

  const zipZ3Url = makeZ3Url({
    secrets,
    patientID: patientId,
    bucketName: BUCKET_NAMES.MEDICAL_RECORD_EXPORTS,
    fileName: archiveFileName,
  });
  const uploadUrl = await createPresignedUrl(token, zipZ3Url, 'upload');

  console.log(`Streaming ${zipEntries.length} files into ${archiveFileName} (${predicted} bytes)`);
  const { bytesUploaded } = await streamZipToPresignedUrl({
    entries: zipEntries,
    uploadUrl,
    contentType: MIME_TYPES.ZIP,
    mtime,
    timeBudgetMs: streamingBudgetMs,
    onProgress: onProgress ? (processed) => onProgress(processed, zipEntries.length) : undefined,
  });

  // Persist the archive as a DocumentReference so it can be retrieved later from the patient
  // Docs UI. It is tagged with MEDICAL_RECORD_EXPORT_CODE and therefore excluded from the
  // collection query above, so it is never bundled into a subsequent export.
  await createFilesDocumentReferences({
    files: [{ url: zipZ3Url, title: archiveFileName }],
    type: {
      coding: [
        {
          system: `${OTTEHR_CODE_SYSTEM_BASE_URL}/document-type`,
          code: MEDICAL_RECORD_EXPORT_CODE,
          display: 'Medical Record Export',
        },
      ],
      text: 'Medical Record Export',
    },
    references: { subject: { reference: `Patient/${patientId}` } },
    dateCreated: DateTime.now().toUTC().toISO() ?? '',
    oystehr,
    generateUUID: randomUUID,
    searchParams: [
      { name: 'subject', value: `Patient/${patientId}` },
      { name: 'type', value: MEDICAL_RECORD_EXPORT_CODE },
    ],
    // The patient's folders; the helper files the export into the "Medical Records" folder
    // (matched via FOLDERS_CONFIG by MEDICAL_RECORD_EXPORT_CODE), creating it if absent.
    listResources: folderLists,
  });

  console.log(`Done. ${zipEntries.length} files archived into ${bytesUploaded} bytes.`);

  return {
    fileUrl: zipZ3Url,
    fileName: archiveFileName,
    documentCount: zipEntries.length,
    skippedCount: skipped.length,
    archiveBytes: bytesUploaded,
  };
};
