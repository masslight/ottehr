import * as fs from 'fs';
import { basename, join } from 'path';

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
  if (['Composite', 'Patient Documentation'].includes(description)) {
    return 'ProgressNotes';
  } else if (description.includes('Insurance Card')) {
    return 'InsuranceCard';
  } else {
    return 'Other';
  }
}

/**
 * File these under ProgressNotes so that the front end shows them with the correct tag
 * @returns patientFolder/ProgressNotes/fileName
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
