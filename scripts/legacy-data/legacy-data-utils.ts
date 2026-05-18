// ── V1 data ──────────────────────────────────────────────────────────

/**
 * Parses a patient folder name of the form: {PatientID}_{LastName}_{FirstName}_{DOB}
 * Returns the Z3 prefix: {lastName}_{firstName}_{dob}/{patientId}
 * Returns null when the folder name doesn't match the expected format.
 */
export function parseFolderName(folderName: string): { z3Prefix: string; patientId: string } | null {
  const parts = folderName.split('_');
  if (parts.length < 4) {
    console.warn(`  Skipping unrecognised folder format: ${folderName}`);
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
export type CsvRow = {
  lastName: string;
  firstName: string;
  dob: string;
  patientId: string;
  path: string;
  documentType: string;
  description: string;
  file: string;
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
export function formatDob(dob: string, row: CsvRow): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    const [year, month, day] = dob.split('-');
    return `${month}-${day}-${year}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(dob)) {
    return dob;
  }
  throw new Error(
    `Unexpected dob format: "${dob}". Expected YYYY-MM-DD or MM-DD-YYYY.\nRow with error: ${JSON.stringify(row)}`
  );
}

/**
 * Builds the Z3 prefix from a CSV row.
 * Returns: {lastName}_{firstName}_{dob}/{patientId}
 */
export function buildPatientFolder(row: CsvRow): string {
  return (
    `${sanitizeForZ3(row.lastName.toLowerCase())}_` +
    `${sanitizeForZ3(row.firstName.toLowerCase())}_` +
    `${sanitizeForZ3(formatDob(row.dob, row))}/` +
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
