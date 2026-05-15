/**
 * Script to analyze / summarize v2 legacy EHR data.
 *
 * Usage:
 *   npx tsx scripts/legacy-data/summarize-legacy-data-types.ts --data-dir [path to dir with 1 or more csv files]
 *
 * Mapping Csv Files:
 *   Should have the expected headers:
 *   Last_Name,First_Name,Path,BirthDate,Sex,Patient Number,Clinic,DateOfVisit,Visit Type,Document Type,Description
 *
 * Output:
 *   Logs a high level summary of information including total documents, total unique patients, document descriptions and file types
 *
 */

import { parse } from 'csv-parse';
import * as fs from 'fs';
import { buildPatientFolder, type CsvRow, stripDateFromDescription } from './legacy-data-utils';

// ── Types ──────────────────────────────────────────────────────────
// example: { Patient Document: { vitals: 8; insurance: 12; imported chart: 5 } }
type DocumentMap = Record<string, Record<string, number>>;

type Summary = {
  totalDocuments: number;

  uniquePatients: Set<string>; // based on first, last, dob, patient id
  patientsWithMultipleNames: Set<string>; // example: Mary Jane (first name) Vaughan Williams (last name)

  rowPrepFailures: number;

  documentTypeSummary: DocumentMap;
  fileTypeSummary: Record<string, number>;
};

// ── Consts ──────────────────────────────────────────────────────────
const summary: Summary = {
  totalDocuments: 0,

  uniquePatients: new Set(),
  patientsWithMultipleNames: new Set(),

  rowPrepFailures: 0,

  documentTypeSummary: {},
  fileTypeSummary: {},
};

const INDENT = '  ';

const COUNT_TO_PRINT = 5000;

// const DOC_TYPES_TO_ANALYZE: string[] = ['Composite', 'Patient Documentation'];
const DOC_TYPES_TO_ANALYZE: string[] = [];

// ── Argument parsing ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);

const dataDirIdx = args.indexOf('--data-dir');
const dataDir = dataDirIdx !== -1 && args[dataDirIdx + 1] ? args[dataDirIdx + 1] : undefined;

// ── Helpers ──────────────────────────────────────────────────────────
function getFileType(path: string): string | null {
  const fileName = path.split('/').pop();

  if (!fileName) return null;

  const extension = fileName.split('.').pop();

  return extension ? extension.toLowerCase() : null;
}

/**
 * checks if first name or last name contains spaces or hyphens
 */
function checkForMultipleNames(row: CsvRow): Set<string> {
  const names = [row.firstName, row.lastName];

  return new Set(names.filter((name) => name.includes('-') || name.includes(' ')));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('Reading legacy data and summarizing types');
  console.log('═'.repeat(60));
  if (!dataDir) {
    console.error('Missing --data-dir argument');
    process.exit(1);
  }

  if (!fs.statSync(dataDir).isDirectory()) {
    console.error(`--data-dir must be a directory: ${dataDir}`);
    process.exit(1);
  }

  const csvFiles = fs.readdirSync(dataDir).filter((f) => f.toLowerCase().endsWith('.csv'));

  console.log(`Data dir: ${dataDir}`);
  console.log(`CSV files:\n${csvFiles.map((f) => `  ${f}`).join('\n')}`);
  console.log('');

  const rows: CsvRow[] = [];

  for (const file of csvFiles) {
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(`${dataDir}/${file}`)
        .pipe(parse({ columns: true }))
        .on('data', (data) => {
          const description = stripDateFromDescription(data['Description']);
          if (DOC_TYPES_TO_ANALYZE.length > 0) {
            if (DOC_TYPES_TO_ANALYZE.includes(description)) {
              rows.push({
                lastName: data['Last_Name'],
                firstName: data['First_Name'],
                path: data['Path'],
                dob: data['BirthDate'],
                patientId: data['Patient Number'],
                documentType: data['Document Type'],
                description,
                file,
              });
            }
          } else {
            rows.push({
              lastName: data['Last_Name'],
              firstName: data['First_Name'],
              path: data['Path'],
              dob: data['BirthDate'],
              patientId: data['Patient Number'],
              documentType: data['Document Type'],
              description,
              file,
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
  }

  for (const row of rows) {
    summary.totalDocuments += 1;

    for (const name of checkForMultipleNames(row)) {
      summary.patientsWithMultipleNames.add(name);
    }

    let patientFolder: string | undefined;

    try {
      patientFolder = buildPatientFolder(row);
    } catch (err) {
      console.error(`  ✗ Failed to prepare file for row: ${JSON.stringify(row)}`);
      console.error(`    Error: ${err instanceof Error ? err.message : String(err)}\n`);
      summary.rowPrepFailures++;
      continue;
    }

    summary.uniquePatients.add(patientFolder);

    const { path, documentType, description } = row;

    if (summary.documentTypeSummary[documentType]) {
      if (summary.documentTypeSummary[documentType][description]) {
        summary.documentTypeSummary[documentType][description] += 1;
      } else {
        summary.documentTypeSummary[documentType][description] = 1;
      }
    } else {
      summary.documentTypeSummary[documentType] = { [description]: 1 };
    }

    const pathExt = getFileType(path);

    if (pathExt !== null) {
      if (summary.fileTypeSummary[pathExt]) {
        summary.fileTypeSummary[pathExt] += 1;
      } else {
        summary.fileTypeSummary[pathExt] = 1;
      }
    }
  }

  console.log('');
  console.log('========== SUMMARY ==========');
  console.log(`Total Documents:${INDENT}${INDENT}${summary.totalDocuments}`);
  console.log(`Unique Patients:${INDENT}${INDENT}${summary.uniquePatients.size}`);

  console.log('');
  console.log('========== DOCUMENT TYPES ==========');
  console.log('');

  for (const [docType, descriptions] of Object.entries(summary.documentTypeSummary)) {
    let total = 0;
    let descriptionsTotalLessThanCount = 0;

    console.log(`${INDENT}TYPE: ${docType}`);

    const descriptionsToPrint: [string, number][] = [];

    for (const [description, count] of Object.entries(descriptions)) {
      total += count;

      if (count > COUNT_TO_PRINT) {
        descriptionsToPrint.push([description, count]);
      } else {
        descriptionsTotalLessThanCount += 1;
      }
    }

    // sort biggest -> smallest
    descriptionsToPrint.sort((a, b) => b[1] - a[1]);

    console.log(`${INDENT}TOTAL: ${total}`);
    console.log(`${INDENT}Descriptions with less than ${COUNT_TO_PRINT}: ${descriptionsTotalLessThanCount}`);
    console.log(`${INDENT}Descriptions with more than ${COUNT_TO_PRINT}:`);

    for (const [description, count] of descriptionsToPrint) {
      console.log(`${INDENT}${INDENT}${description}: ${count}`);
    }

    console.log('');
  }

  console.log('========== FILE TYPES ==========');

  for (const [fileExt, count] of Object.entries(summary.fileTypeSummary)) {
    console.log(`${fileExt} count: ${count}`);
  }

  console.log('');

  console.log('========== MULTIPLE NAMES ==========');

  if (summary.patientsWithMultipleNames.size > 0) {
    console.log(`Total unique multiple names: ${summary.patientsWithMultipleNames.size}\n`);
    // console.log(`Names with hyphens or spaces: ${[...summary.patientsWithMultipleNames].join(', ')}\n`);
  } else {
    console.log('No names with hyphens or spaces found\n');
  }

  console.log('========== FAILURES ==========');
  if (summary.rowPrepFailures === 0) {
    console.log('none');
  } else {
    console.log(`Row prep failures: ${summary.rowPrepFailures}\n`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
