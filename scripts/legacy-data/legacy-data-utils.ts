import * as fs from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { FileType, FileTypeMap } from '../../packages/utils/lib/types/data/legacy-data';

// ── V1 data ──────────────────────────────────────────────────────────

/**
 * Parses a patient folder name of the form: {PatientID}_{LastName}_{FirstName}_{DOB}
 * Returns the Z3 prefix: {lastName}_{firstName}_{dob}/{patientId}
 * Returns null when the folder name doesn't match the expected format.
 */
export function parseFolderName(folderName: string): { z3Prefix: string; patientId: string } | null {
  const parts = folderName.split('_');
  if (parts.length < 4) {
    console.warn(`  Skipping unrecognized folder format: ${folderName}`);
    return null;
  }

  const patientId = parts[0];
  const lastName = parts[1].toLowerCase();
  const firstName = parts[2].toLowerCase();
  // DOB is everything after the first 3 underscore-separated parts
  const dob = parts.slice(3).join('-');

  const z3Prefix = `${lastName}_${firstName}_${dob}/${patientId}`;
  return { z3Prefix, patientId };
}

// ── V2 data ──────────────────────────────────────────────────────────
const fileTypeToS3SanitizedDescriptionMap: Partial<Record<FileType, string[]>> = {
  [FileType.CHART_TRANSCRIPTION]: ['Chart Transcription', 'Chart Transcription / INS VER', 'Chart Transcription / DOT'],
  [FileType.CODE_SUMMARY]: ['Code Summary'],
  [FileType.COMPANY_MEDICAL_RECORD]: ['Company Medical Record'],
  [FileType.CONSENTS]: ['Consents Imported'],
  [FileType.DRIVERS_LICENSE]: [
    "Driver's License: Front",
    "Driver's License: Back",
    'Drivers License Front Imported',
    'Drivers License Imported',
    'Drivers License Back Imported',
    "Driver's License",
    'DR LIC Imported',
    'DRI LIC Imported',
    "Driver's License: Front / LIC",
    'DRI LIC (MOM) Imported',
    "MOM'S DR LIC Imported",
    'DRI LIC (DAD) Imported',
  ],
  [FileType.LIC]: ['LIC Imported'],
  [FileType.EXAM]: ['Exam', 'Exam Image'],
  [FileType.EXAM_SUMMARY]: ['S/PHYS Imported'],
  [FileType.EXAM_LAB]: ['Exam / LAB REQ'],
  [FileType.EXAM_DOT]: ['Exam / DOT PHYS'],
  [FileType.GENERATED_FORM]: ['Generated Form (Chart)', 'Generated Form (Patient)', 'Generated Form (Chart) / VITALS'],
  [FileType.HIPAA_CONSENT]: ['HIPAA Consent', 'HIPAA Consent / REG', 'HIPAA Consent / PT REG'],
  [FileType.HIPAA_NOTICE]: ['HIPAA Notice signed on', 'Hipaa Notice Imported', 'HIPPA/Ins Agree Imported'],
  [FileType.ID_CARD]: [
    'ID Card: Front',
    'ID Card: Back',
    'ID Imported',
    "MOM'S ID Imported",
    'ID CARD Imported',
    "DAD'S ID Imported",
  ],
  [FileType.IMPORTED_CHART]: ['Imported Chart'],
  [FileType.INSURANCE]: [
    'Insurance Imported',
    'INS VER Imported',
    'MEDICARE Imported',
    'INS Imported',
    'Insurance Consent / INS VER',
    'INS VEF Imported',
  ],
  [FileType.INSURANCE_AGREEMENT]: ['Insurance Agreement signed on', 'Insurance Agreement Imported'],
  [FileType.INSURANCE_CARD]: [
    'Insurance Card: Front',
    'Insurance Card: Back',
    'Insurance Card - Primary: Front',
    'Insurance Card - Primary: Back',
    'Insurance Card - Primary',
    'Insurance Card Back Imported',
    'Insurance Card Front Imported',
    'Insurance Card - Secondary: Front',
    'Insurance Card - Secondary: Back',
    'Insurance Card - Primary: Front / INS VER',
    'Insurance Card - Primary / INS VER',
    'Insurance Card - Secondary',
    'INS CARD Imported',
    'Insurance Card - Primary: Front / INS CARD',
  ],
  [FileType.LAB_REPORT]: [
    'Lab Report 1',
    'Lab Report 2',
    'Lab Report 3',
    'Quest Lab Report 1',
    'Quest Lab Report 2',
    'Quest Lab Report 3',
    'Scanned Lab Results',
  ],
  [FileType.LAB_REQ]: ['LAB REQ Imported'],
  [FileType.LAB]: ['LAB RES Imported', 'LAB REP Imported'],
  [FileType.MED_HX]: ['Multipage/Med Hx Imported'],
  [FileType.PAT_HX]: ['Pat Hx Imported'],
  [FileType.PATIENT_AUTHORIZATION]: ['Patient Authorization'],
  [FileType.PATIENT_CLINICAL_SUMMARY]: ['Patient Clinical Summary'],
  [FileType.PATIENT_INFO]: ['Pat Info Imported'],
  [FileType.PAYMENT_RECEIPT]: ['Payment Receipt'],
  [FileType.PROGRESS_NOTE]: ['Composite', 'Patient Documentation'],
  [FileType.REGISTRATION_FORM]: ['Registration Form Imported'],
  [FileType.SCHOOL_NOTE]: ['School Note'],
  [FileType.TEXAS_IMMUNIZATION_REGISTRY_VITAL_REPORT]: ['TX005 Vitals'],
  [FileType.TRANSCRIPTION]: ['Transcription'],
  [FileType.VISIT_FOLLOW_UP_COMM]: [
    'Visit Follow-up Communication signed on',
    'Visit Follow Up Communication Imported',
  ],
  [FileType.VITALS]: ['Vitals Imported', 'TX005 Vitals'],
  [FileType.WORK_NOTE]: ['Work Note', 'Work Status Note'],
  [FileType.XRAY_OVER_READ_REPORT]: ['X-Ray Over Read Report 1', 'XRAY REP (CHX) Imported'],
  [FileType.XRAY_CHEST]: ['CXR REP Imported', 'XRAY REP (CHEST) Imported'],
  [FileType.XRAY]: ['X-RAY REP Imported', 'X-RAY CON Imported'],
  [FileType.BILLING]: ['Billing'],
  [FileType.REG]: ['REG Imported', 'PT REG Imported'],
  [FileType.DOT]: ['DOT PHYS Imported', 'DOT Imported'],
  [FileType.EKG]: ['EKG Imported'],
  [FileType.RX]: ['RX Imported', 'RX. Imported'],
  [FileType.PRE_OP_REQ]: ['PRE-OP REQ Imported'],
  [FileType.REQ]: ['REQ Imported'],
  [FileType.M_CLR_FX]: ['M/CLR FX Imported'],
};

export const ACCEPTED_FILE_TYPES = ['.pdf', '.tiff', '.tif', '.jpeg', '.jpg', '.png', '.html', '.heic'];

export const MAPPING_HEADERS = {
  lastName: 'Last_Name',
  firstName: 'First_Name',
  path: 'Path',
  dob: 'BirthDate',
  sex: 'Sex',
  patientId: 'Patient Number',
  clinic: 'Clinic',
  dateOfVisit: 'DateOfVisit',
  visitType: 'Visit Type',
  documentType: 'Document Type',
  description: 'Description',
};

type MappingFields = Record<keyof typeof MAPPING_HEADERS, string>;

export type CsvRow = MappingFields & {
  file: string;
};

export const readCsvRow = (data: any, file: string): CsvRow => {
  const description = data[MAPPING_HEADERS.description];
  const sanitizedDescription = stripDateFromDescription(description);

  return {
    lastName: data[MAPPING_HEADERS.lastName],
    firstName: data[MAPPING_HEADERS.firstName],
    path: data[MAPPING_HEADERS.path],
    dob: data[MAPPING_HEADERS.dob],
    sex: data[MAPPING_HEADERS.sex],
    patientId: data[MAPPING_HEADERS.patientId],
    clinic: data[MAPPING_HEADERS.clinic],
    dateOfVisit: data[MAPPING_HEADERS.dateOfVisit],
    visitType: data[MAPPING_HEADERS.visitType],
    documentType: data[MAPPING_HEADERS.documentType],
    description: sanitizedDescription,
    file,
  };
};

/**
 * Removes leading/trailing spaces, replaces inner whitespace with "_",
 * Strips any character that is not accepted in z3 object naming.
 * Characters accepted: letters, numbers, plus (+), exclamation point (!), hyphen (-), underscore (_), single quote ('),
 * open parenthesis ((), closed parenthesis ()), period (.), at sign (@), dollar sign ($)
 */
function sanitizeForZ3(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9+!_\-'.()@$]/g, '');
}

/**
 * Converts YYYY-MM-DD to MM-DD-YYYY.
 * If the value is already MM-DD-YYYY it is returned unchanged.
 * Throws for any other format.
 */
export function formatDob(dob: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    const [year, month, day] = dob.split('-');
    return `${month}-${day}-${year}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(dob)) {
    return dob;
  }
  throw new Error(`Unexpected dob format: "${dob}". Expected YYYY-MM-DD or MM-DD-YYYY.`);
}

/**
 * Builds the Z3 prefix from a CSV row.
 * Returns: {lastName}_{firstName}_{dob}/{patientId}
 */
export function buildPatientFolder(row: CsvRow): string {
  return (
    `${sanitizeForZ3(row.lastName.toLowerCase())}_` +
    `${sanitizeForZ3(row.firstName.toLowerCase())}_` +
    `${sanitizeForZ3(formatDob(row.dob))}/` +
    `${sanitizeForZ3(row.patientId)}`
  );
}

/**
 * Many common descriptions in the mapping file contain dates, to get the base file description, remove the date
 * Example:
 * description passed: Imported Chart 11/11/2021
 * description returned: Imported Chart
 */
export function stripDateFromDescription(description: string): string {
  return (
    description
      // eslint-disable-next-line no-useless-escape
      .replace(/\b\d{2}[\/-]\d{2}[\/-]\d{4}\b/g, '')
      .trim()
      .replace(/\s+/g, ' ')
  );
}

/**
 * @param description values are should be specific to the data set being parsed
 * @returns folder name for z3 object path
 */
export function mapRowDescriptionToDocumentFolder(description: string): string {
  const lowerKey = description.toLowerCase();

  for (const [fileType, descriptions] of Object.entries(fileTypeToS3SanitizedDescriptionMap)) {
    if (lowerKey.includes('billing')) return FileType.BILLING;

    if (descriptions?.some((d) => d.toLowerCase() === lowerKey)) {
      return FileTypeMap[fileType as FileType].folder;
    }

    if (lowerKey.includes('x-ray') || lowerKey.includes('xray')) return FileType.XRAY;
    if (lowerKey.includes('lab report')) return FileType.LAB_REPORT;
    if (lowerKey.includes('insurance card')) return FileType.INSURANCE_CARD;
  }

  return FileTypeMap[FileType.OTHER].folder;
}

/**
 * File these under their applicable folders based on the description so that the front end shows them with the correct tag
 * @returns patientFolder/documentType/fileName
 */
export function buildObjectPath(row: CsvRow): string {
  const patientFolder = buildPatientFolder(row);
  const documentTypeFolder = mapRowDescriptionToDocumentFolder(row.description);
  const fileName = basename(row.path);

  if (!ACCEPTED_FILE_TYPES.some((type) => fileName.toLowerCase().endsWith(type))) {
    throw new Error(`Unexpected file type: ${fileName}`);
  }

  return `${patientFolder}/${documentTypeFolder}/${fileName}`;
}

export function writeCsvToLegacyDataOutput(filename: string, headers: string[], rows: (string | number)[][]): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // this dir is git ignored to make sure no client data gets pushed
  const outputDir = join(__dirname, 'legacy-data-output');

  fs.mkdirSync(outputDir, { recursive: true });
  const outPath = join(outputDir, filename);

  const escape = (v: string | number): string => {
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];

  fs.writeFileSync(outPath, lines.join('\n') + '\n');
  console.log(`  → wrote ${outPath}`);
}
