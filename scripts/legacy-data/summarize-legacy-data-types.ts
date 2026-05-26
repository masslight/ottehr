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
import {
  buildObjectPath,
  buildPatientFolder,
  type CsvRow,
  readCsvRow,
  stripDateFromDescription,
  writeCsvToLegacyDataOutput,
} from './legacy-data-utils';

// ── Types ──────────────────────────────────────────────────────────
// example: { Patient Document: { vitals: 8; insurance: 12; imported chart: 5 } }
type DocumentMap = Record<string, Record<string, number>>;

type Summary = {
  totalRowsProcessed: number;

  uniquePatients: Set<string>; // based on first, last, dob, patient id
  patientsWithMultipleNames: Set<string>; // example: Mary Jane (first name) Vaughan Williams (last name)
  namesWithSpecialChars: Set<string>; // example: Mary Jane (first name) Vaughan Williams (last name)

  rowPrepFailures: number;
  rowPrepFailuresDetails: { errorMsg: string; row: CsvRow }[];

  documentTypeSummary: DocumentMap;
  fileTypeSummary: Record<string, number>;
  z3filePaths: Map<string, number>;
};

// ── Consts ──────────────────────────────────────────────────────────
const summary: Summary = {
  totalRowsProcessed: 0,

  uniquePatients: new Set(),
  patientsWithMultipleNames: new Set(),
  namesWithSpecialChars: new Set(),

  rowPrepFailures: 0,
  rowPrepFailuresDetails: [],

  documentTypeSummary: {},
  fileTypeSummary: {},
  z3filePaths: new Map(),
};

const INDENT = '  ';

const COUNT_TO_PRINT = 500;

// if undefined, analyze everything
const DOC_TYPES_TO_ANALYZE: string[] | undefined = undefined;

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

function checkForInvalidCharsInNames(row: CsvRow): Set<string> {
  const names = [row.firstName, row.lastName];

  return new Set(names.filter((name) => !/^[A-Za-z0-9+!_\-'.()@$\s]+$/.test(name)));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('Reading and summarizing legacy data');
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

  console.time('Reading Csvs');

  const rows: CsvRow[] = [];

  for (const file of csvFiles) {
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(`${dataDir}/${file}`)
        .pipe(parse({ columns: true }))
        .on('data', (data) => {
          const description = stripDateFromDescription(data['Description']);
          if (DOC_TYPES_TO_ANALYZE === undefined) {
            rows.push(readCsvRow(data, file));
          } else if (DOC_TYPES_TO_ANALYZE.includes(description)) {
            rows.push(readCsvRow(data, file));
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
  }

  console.timeEnd('Reading Csvs');

  for (const row of rows) {
    summary.totalRowsProcessed += 1;

    for (const name of checkForMultipleNames(row)) {
      summary.patientsWithMultipleNames.add(name);
    }

    for (const name of checkForInvalidCharsInNames(row)) {
      summary.namesWithSpecialChars.add(name);
    }

    let patientFolder: string | undefined;
    let z3FilePath: string | undefined;

    if (row.dob === '') {
      summary.rowPrepFailuresDetails.push({ errorMsg: 'missing dob', row });
      summary.rowPrepFailures++;
      // won't bother trying to build folder because it will for sure fail without a dob
      continue;
    } else {
      try {
        patientFolder = buildPatientFolder(row);
        z3FilePath = buildObjectPath(row);
      } catch (err) {
        // console.error(`  ✗ Failed to prepare file for row: ${JSON.stringify(row)}`);
        // console.error(`    Error: ${err instanceof Error ? err.message : String(err)}\n`);
        const errorMsg = err instanceof Error ? err.message : String(err);
        summary.rowPrepFailuresDetails.push({ errorMsg, row });
        summary.rowPrepFailures++;
        continue;
      }
    }

    summary.uniquePatients.add(patientFolder);

    const { path, documentType, description } = row;

    summary.z3filePaths.set(z3FilePath, (summary.z3filePaths.get(z3FilePath) ?? 0) + 1);

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
  console.log(`Total Rows Processed:${INDENT}${INDENT}${summary.totalRowsProcessed}`);
  console.log(`Unique Patients:${INDENT}${INDENT}${INDENT}${summary.uniquePatients.size}`);

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

  console.log('========== NAMES ==========');

  if (summary.patientsWithMultipleNames.size > 0) {
    console.log(`Total names with hyphens or spaces: ${summary.patientsWithMultipleNames.size}\n`);
    // console.log(`Names with hyphens or spaces: ${[...summary.patientsWithMultipleNames].join(', ')}\n`);
  } else {
    console.log('No names with hyphens or spaces found\n');
  }

  if (summary.namesWithSpecialChars.size > 0) {
    console.log(`Total names with special characters: ${summary.namesWithSpecialChars.size}\n`);
    // console.log(`Names with special characters: ${[...summary.namesWithSpecialChars].join('; ')}\n`);
  } else {
    console.log('No names with special characters found\n');
  }

  console.log('========== DUPLICATE FILE NAMES ==========');
  const duplicateZ3FilePaths = [...summary.z3filePaths.entries()].filter(([, count]) => count > 1);
  duplicateZ3FilePaths.sort((a, b) => b[1] - a[1]);
  if (duplicateZ3FilePaths.length === 0) {
    console.log('No duplicate file paths\n');
  } else {
    console.log(`Total duplicate z3 file paths: ${duplicateZ3FilePaths.length}`);
    console.log(`See output file for details on duplicates\n`);
  }

  console.log('========== FAILURES ==========');
  if (summary.rowPrepFailures === 0) {
    console.log('\nNo row prep failures');
  } else {
    console.log(`Row prep failures: ${summary.rowPrepFailures}`);
    console.log('See output file for details on failures');
  }

  // ── CSV output ──────────────────────────────────────────────────────
  console.log('\n========== WRITING CSVs ==========');

  writeCsvToLegacyDataOutput(
    'summary.csv',
    ['metric', 'value'],
    [
      ['total_rows_processed', summary.totalRowsProcessed],
      ['unique_patients', summary.uniquePatients.size],
      ['row_prep_failures', summary.rowPrepFailures],
      ['names_with_multiple_parts', summary.patientsWithMultipleNames.size],
      ['names_with_special_chars', summary.namesWithSpecialChars.size],
    ]
  );

  const docTypeRows: (string | number)[][] = [];
  for (const [docType, descriptions] of Object.entries(summary.documentTypeSummary)) {
    for (const [description, count] of Object.entries(descriptions)) {
      docTypeRows.push([docType, description, count]);
    }
  }
  docTypeRows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || (b[2] as number) - (a[2] as number));
  writeCsvToLegacyDataOutput('document_types.csv', ['document_type', 'description', 'count'], docTypeRows);

  writeCsvToLegacyDataOutput(
    'file_types.csv',
    ['extension', 'count'],
    Object.entries(summary.fileTypeSummary).sort((a, b) => b[1] - a[1])
  );

  writeCsvToLegacyDataOutput('duplicate_z3_file_paths.csv', ['file_path', 'count'], duplicateZ3FilePaths);

  writeCsvToLegacyDataOutput(
    'row_prep_failures.csv',
    ['error_message', 'file', 'row detail'],
    summary.rowPrepFailuresDetails.map((detail) => [
      detail.errorMsg,
      Object.values(detail.row).at(-1) || '',
      Object.values(detail.row).slice(0, -1).join(','),
    ])
  );
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
