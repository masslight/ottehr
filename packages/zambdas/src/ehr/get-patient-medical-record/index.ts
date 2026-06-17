import Oystehr from '@oystehr/sdk';
import archiver from 'archiver';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DocumentReference, List, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  createFilesDocumentReferences,
  getAllFhirSearchPages,
  getFileNameFromUrl,
  GetPatientMedicalRecordOutput,
  getSecret,
  MEDICAL_RECORD_EXPORT_CODE,
  MIME_TYPES,
  OTTEHR_CODE_SYSTEM_BASE_URL,
  PATIENT_FOLDERS_CODE,
  sanitizeFileNameForZ3,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { makeZ3Url } from '../../shared/presigned-file-urls';
import { createPresignedUrl, uploadObjectToZ3 } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-patient-medical-record';

// OOM guard: the whole compressed archive is buffered for the Z3 upload (presigned PUT needs a
// Content-Length), and assembly briefly holds ~2 copies. Cap the payload at half the function's
// memory after headroom, so we fail with a clear error instead of crashing. (1 GB fallback locally.)
const FUNCTION_MEMORY_MB = Number(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE) || 1024;
const MEMORY_HEADROOM_MB = 256;
const MAX_MEDICAL_RECORD_BYTES = Math.max(64, Math.floor((FUNCTION_MEMORY_MB - MEMORY_HEADROOM_MB) / 2)) * 1024 * 1024;

type NamedAttachment = {
  url: string;
  name: string;
};

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    let validatedParameters: ReturnType<typeof validateRequestParameters>;
    try {
      validatedParameters = validateRequestParameters(input);
    } catch (error: any) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: `Invalid request parameters. ${error.message || error}` }),
      };
    }

    const { patientId, secrets } = validatedParameters;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const response = await performEffect(oystehr, patientId, secrets);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

export const performEffect = async (
  oystehr: Oystehr,
  patientId: string,
  secrets: Secrets | null
): Promise<GetPatientMedicalRecordOutput> => {
  console.log(`Collecting documents for Patient/${patientId}`);

  const [patient, documentReferences, folderLists] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId }).catch(() => undefined),
    // Page through all results: a "complete" record must not be truncated by a single page.
    // No status filter: include every document the patient/staff sees in the Docs UI
    // (e.g. superseded discharge summaries), matching "all patient documents".
    getAllFhirSearchPages<DocumentReference>(
      {
        resourceType: 'DocumentReference',
        params: [{ name: 'subject', value: `Patient/${patientId}` }],
      },
      oystehr
    ),
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

  // Exclude previously generated medical-record archives so they are never bundled into a new one.
  const collectibleDocuments = documentReferences.filter((docRef) => !isMedicalRecordExport(docRef));

  const attachments = collectibleDocuments.flatMap((docRef) =>
    (docRef.content ?? [])
      .map((content) => content.attachment)
      .filter((attachment) => !!attachment?.url)
      .map((attachment) => ({
        url: attachment.url as string,
        title: attachment.title,
        contentType: attachment.contentType,
        // Creation date of the owning document, used to disambiguate duplicate file names.
        date: docRef.date,
      }))
  );

  console.log(
    `Found ${collectibleDocuments.length} collectible DocumentReferences ` +
      `(of ${documentReferences.length} total) with ${attachments.length} attachments`
  );

  // Resolve archive entry names up front from metadata alone, so no bytes are held while naming.
  const baseNames = attachments.map((a) => deriveFileName(a.url, a.title, a.contentType));
  const nameCounts = new Map<string, number>();
  for (const baseName of baseNames) {
    nameCounts.set(baseName, (nameCounts.get(baseName) ?? 0) + 1);
  }
  const usedNames = new Set<string>();
  const namedAttachments: NamedAttachment[] = attachments.map((attachment, i) => ({
    url: attachment.url,
    name: resolveFileName(baseNames[i], attachment.date, (nameCounts.get(baseNames[i]) ?? 0) > 1, usedNames),
  }));

  const archiveFileName = makeArchiveFileName(patient);

  console.log(`Zipping up to ${namedAttachments.length} files into ${archiveFileName}`);
  const { zipBytes, archivedCount } = await buildMedicalRecordZip(namedAttachments);

  if (archivedCount === 0) {
    console.log('No downloadable documents found for patient');
    return {
      downloadUrl: '',
      fileName: archiveFileName,
      documentCount: 0,
    };
  }

  const zipZ3Url = makeZ3Url({
    secrets,
    patientID: patientId,
    bucketName: BUCKET_NAMES.MEDICAL_RECORD_EXPORTS,
    fileName: archiveFileName,
  });
  const uploadUrl = await createPresignedUrl(m2mToken, zipZ3Url, 'upload');
  await uploadObjectToZ3(zipBytes, uploadUrl, MIME_TYPES.ZIP);

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

  const downloadUrl = await createPresignedUrl(m2mToken, zipZ3Url, 'download');

  console.log(`Done. ${archivedCount} files archived.`);
  return {
    downloadUrl,
    fileName: archiveFileName,
    documentCount: archivedCount,
  };
};

// Identifies the DocumentReference we create for a generated archive, so prior exports
// are excluded from the collection query (otherwise each export would be bundled into the next).
const isMedicalRecordExport = (docRef: DocumentReference): boolean =>
  (docRef.type?.coding ?? []).some((coding) => coding.code === MEDICAL_RECORD_EXPORT_CODE);

// Returns the attachment's bytes, or undefined if it can't be fetched — one bad file is skipped
// rather than failing the whole export.
const downloadAttachment = async (url: string): Promise<Buffer | undefined> => {
  try {
    const downloadUrl = await createPresignedUrl(m2mToken, url, 'download');
    const response = await fetch(downloadUrl, { headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) {
      console.error(`Skipping attachment, download failed [${response.status}] for ${url}`);
      return undefined;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error(`Skipping attachment, error downloading ${url}: ${String(error)}`);
    return undefined;
  }
};

// Downloads and appends one document at a time so only a single document is held in memory at once,
// not the whole chart. The compressed output is still buffered in full (the Z3 upload needs its length).
const buildMedicalRecordZip = async (
  namedAttachments: NamedAttachment[]
): Promise<{ zipBytes: Uint8Array; archivedCount: number }> => {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));

  const finished = new Promise<void>((resolve, reject) => {
    archive.on('end', () => resolve());
    archive.on('warning', (err) => console.warn(`Archive warning while building medical record: ${String(err)}`));
    archive.on('error', (err) => reject(err));
  });

  let archivedCount = 0;
  let totalBytes = 0;
  for (const { url, name } of namedAttachments) {
    const buffer = await downloadAttachment(url);
    if (!buffer) continue;

    totalBytes += buffer.length;
    if (totalBytes > MAX_MEDICAL_RECORD_BYTES) {
      archive.abort();
      throw new Error(`Medical record exceeds the maximum supported size of ${MAX_MEDICAL_RECORD_BYTES} bytes`);
    }

    archive.append(buffer, { name });
    archivedCount++;
  }

  if (archivedCount === 0) {
    archive.abort();
    return { zipBytes: new Uint8Array(0), archivedCount: 0 };
  }

  await archive.finalize();
  await finished;

  const totalLength = chunks.reduce((length, chunk) => length + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return { zipBytes: result, archivedCount };
};

const deriveFileName = (url: string, title: string | undefined, contentType: string | undefined): string => {
  // Preserve the document's title as-is (only falling back when it is empty/whitespace).
  // We must not trim it: a title like " .png" would otherwise become a hidden ".png" dotfile.
  let name = title && title.trim() ? title : getFileNameFromUrl(url) || 'document';
  const extension = contentType?.split('/').pop();
  if (extension && !name.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) {
    name = `${name}.${extension}`;
  }
  return sanitizeArchiveEntryName(name);
};

// Sanitizes a name used as a zip *entry* (inside the archive): strip path separators and
// characters that are illegal in file names on common platforms, but otherwise keep the
// document's title readable (spaces, commas, parentheses, etc. are preserved). This is
// intentionally far more lenient than sanitizeFileNameForZ3, which names the Z3 object.
const sanitizeArchiveEntryName = (fileName: string): string => fileName.replace(/[/\\:*?"<>|]/g, '_');

const splitFileName = (fileName: string): { base: string; ext: string } => {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0
    ? { base: fileName.slice(0, dotIndex), ext: fileName.slice(dotIndex) }
    : { base: fileName, ext: '' };
};

const resolveFileName = (
  baseFileName: string,
  date: string | undefined,
  disambiguate: boolean,
  usedNames: Set<string>
): string => {
  const { base, ext } = splitFileName(baseFileName);

  // Duplicated names are disambiguated by the document's creation timestamp (meaningful,
  // unlike an opaque counter); unique names are kept as-is.
  const timestamp = disambiguate && date ? DateTime.fromISO(date).toUTC().toFormat('yyyy-MM-dd_HH-mm-ss') : undefined;
  let candidate = timestamp ? `${base}_${timestamp}${ext}` : baseFileName;

  // Guarantee global uniqueness; fall back to a counter if names still collide
  // (e.g. duplicates sharing the exact same creation timestamp).
  let counter = 2;
  while (usedNames.has(candidate)) {
    candidate = `${timestamp ? `${base}_${timestamp}` : base}_${counter}${ext}`;
    counter += 1;
  }
  usedNames.add(candidate);
  return candidate;
};

const makeArchiveFileName = (patient: Patient | undefined): string => {
  const name = patient?.name?.[0];
  const family = name?.family ?? 'patient';
  const given = name?.given?.[0] ?? '';
  // The archive file name is used both as the Z3 object name and the browser download name.
  const namePart = sanitizeFileNameForZ3([family, given].filter(Boolean).join('_').toLowerCase()) || 'patient';
  const timestamp = DateTime.now().toUTC().toFormat('yyyy-MM-dd_HH-mm');
  return `medical_record_${namePart}_${timestamp}.zip`;
};
