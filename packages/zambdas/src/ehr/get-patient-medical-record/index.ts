import Oystehr from '@oystehr/sdk';
import archiver from 'archiver';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DocumentReference, List, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  createFilesDocumentReferences,
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

type MedicalRecordFile = {
  name: string;
  bytes: Uint8Array;
};

type DownloadedFile = {
  baseName: string;
  date?: string;
  bytes: Uint8Array;
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
    oystehr.fhir
      .search<DocumentReference>({
        resourceType: 'DocumentReference',
        // No status filter: include every document the patient/staff sees in the Docs UI
        // (e.g. superseded discharge summaries), matching "all patient documents".
        params: [
          { name: 'subject', value: `Patient/${patientId}` },
          { name: '_count', value: '1000' },
        ],
      })
      .then((bundle) => bundle.unbundle()),
    oystehr.fhir
      .search<List>({
        resourceType: 'List',
        params: [
          { name: 'subject', value: `Patient/${patientId}` },
          { name: 'code', value: PATIENT_FOLDERS_CODE },
        ],
      })
      .then((bundle) => bundle.unbundle()),
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

  const downloaded: DownloadedFile[] = [];
  for (const attachment of attachments) {
    try {
      const downloadUrl = await createPresignedUrl(m2mToken, attachment.url, 'download');
      const response = await fetch(downloadUrl, { headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) {
        console.error(`Skipping attachment, download failed [${response.status}] for ${attachment.url}`);
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const baseName = deriveFileName(attachment.url, attachment.title, attachment.contentType);
      downloaded.push({ baseName, date: attachment.date, bytes });
    } catch (error) {
      console.error(`Skipping attachment, error downloading ${attachment.url}: ${String(error)}`);
    }
  }

  // Assign archive file names. A name that is unique across the archive stays clean;
  // when a name is shared by several documents, every copy in that group is disambiguated
  // by its creation timestamp (so no single copy is arbitrarily left without one).
  const nameCounts = new Map<string, number>();
  for (const file of downloaded) {
    nameCounts.set(file.baseName, (nameCounts.get(file.baseName) ?? 0) + 1);
  }
  const usedNames = new Set<string>();
  const files: MedicalRecordFile[] = downloaded.map((file) => ({
    name: resolveFileName(file.baseName, file.date, (nameCounts.get(file.baseName) ?? 0) > 1, usedNames),
    bytes: file.bytes,
  }));

  const archiveFileName = makeArchiveFileName(patient);

  if (files.length === 0) {
    console.log('No downloadable documents found for patient');
    return {
      downloadUrl: '',
      fileName: archiveFileName,
      documentCount: 0,
    };
  }

  console.log(`Zipping ${files.length} files into ${archiveFileName}`);
  const zipBytes = await createZipArchive(files);

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

  console.log(`Done. ${files.length} files archived.`);
  return {
    downloadUrl,
    fileName: archiveFileName,
    documentCount: files.length,
  };
};

// Identifies the DocumentReference we create for a generated archive, so prior exports
// are excluded from the collection query (otherwise each export would be bundled into the next).
const isMedicalRecordExport = (docRef: DocumentReference): boolean =>
  (docRef.type?.coding ?? []).some((coding) => coding.code === MEDICAL_RECORD_EXPORT_CODE);

const createZipArchive = async (files: MedicalRecordFile[]): Promise<Uint8Array> => {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on('data', (chunk: Buffer) => chunks.push(chunk));

  const finished = new Promise<void>((resolve, reject) => {
    archive.on('end', () => resolve());
    archive.on('warning', (err) => reject(err));
    archive.on('error', (err) => reject(err));
  });

  for (const file of files) {
    archive.append(Buffer.from(file.bytes), { name: file.name });
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
  return result;
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
