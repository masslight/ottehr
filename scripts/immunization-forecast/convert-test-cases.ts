/**
 * Converts the CDC CDSi "Healthy Childhood and Adult" test case workbook into the JSON fixture used by
 * packages/utils/lib/immunization-forecast/cdsi-test-cases.test.ts.
 *
 * Usage:
 *   npx tsx scripts/immunization-forecast/convert-test-cases.ts \
 *     --xlsx "<CDSi_Healthy_Childhood_and_Adult_Test_Cases_v4.45.xlsx>" --version 4.45 \
 *     --out packages/utils/lib/immunization-forecast/test-data/cdsi-test-cases.json
 *
 * The workbook is read with `unzip -p` (no xlsx dependency); only the "FITS Exported TestCases" sheet is used.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { child, children, parseXml, XmlElement } from './xml';

export interface CdsiTestDose {
  date: string;
  cvx: string;
  name: string;
  /** Expected CDSi evaluation status: Valid | Not Valid | Extraneous | Sub-standard. */
  status: string;
  reason?: string;
}

export interface CdsiTestCase {
  id: string;
  name: string;
  dob: string;
  gender: string;
  assessmentDate: string;
  vaccineGroup: string;
  /** Expected series status: Complete | Not complete | Aged out | Immune | Contraindicated | Not recommended. */
  seriesStatus: string;
  doses: CdsiTestDose[];
  forecast?: { doseNumber?: number; earliest?: string; recommended?: string; pastDue?: string };
  evaluationTestType?: string;
  forecastTestType?: string;
}

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || i + 1 >= process.argv.length) throw new Error(`Missing --${name}`);
  return process.argv[i + 1];
}

function unzipEntry(xlsx: string, entry: string): string {
  return execFileSync('unzip', ['-p', xlsx, entry], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

function sheetPath(xlsx: string, sheetName: string): string {
  const workbook = parseXml(unzipEntry(xlsx, 'xl/workbook.xml')).children[0];
  const rels = parseXml(unzipEntry(xlsx, 'xl/_rels/workbook.xml.rels')).children[0];
  const sheet = children(child(workbook, 'sheets')!, 'sheet').find((s) => s.attrs.name === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  const rid = sheet.attrs['r:id'];
  const rel = children(rels, 'Relationship').find((r) => r.attrs.Id === rid);
  if (!rel) throw new Error(`No relationship for sheet "${sheetName}"`);
  return 'xl/' + rel.attrs.Target.replace(/^\/?xl\//, '');
}

function sharedStrings(xlsx: string): string[] {
  const sst = parseXml(unzipEntry(xlsx, 'xl/sharedStrings.xml')).children[0];
  return children(sst, 'si').map((si) => collectText(si));
}

function collectText(el: XmlElement): string {
  let out = el.name === 't' ? el.text : '';
  for (const c of el.children) out += collectText(c);
  return out;
}

/** Excel serial date (1900 system) to ISO yyyy-mm-dd. */
function serialToIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readSheet(xlsx: string, sheetName: string): (string | number | undefined)[][] {
  const strings = sharedStrings(xlsx);
  const sheet = parseXml(unzipEntry(xlsx, sheetPath(xlsx, sheetName))).children[0];
  const rows: (string | number | undefined)[][] = [];
  for (const row of children(child(sheet, 'sheetData')!, 'row')) {
    const cells: (string | number | undefined)[] = [];
    for (const c of children(row, 'c')) {
      const idx = colIndex(c.attrs.r);
      const t = c.attrs.t;
      let value: string | number | undefined;
      if (t === 's') value = strings[Number(child(c, 'v')?.text ?? -1)];
      else if (t === 'inlineStr') value = collectText(c);
      else if (t === 'str' || t === 'b' || t === 'e') value = child(c, 'v')?.text;
      else {
        const v = child(c, 'v')?.text;
        value = v === undefined ? undefined : Number(v);
      }
      cells[idx] = value;
    }
    rows.push(cells);
  }
  return rows;
}

const asDate = (v: string | number | undefined): string | undefined => {
  if (v === undefined || v === '') return undefined;
  if (typeof v === 'number') return serialToIso(v);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return v.slice(0, 10);
};

const asText = (v: string | number | undefined): string | undefined => {
  if (v === undefined) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
};

function main(): void {
  const xlsx = arg('xlsx');
  const version = arg('version');
  const out = arg('out');
  const rows = readSheet(xlsx, 'FITS Exported TestCases');
  const header = rows[0].map((h) => String(h ?? ''));
  const col = (name: string): number => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`Column ${name} not found`);
    return i;
  };
  const cases: CdsiTestCase[] = [];
  for (const row of rows.slice(1)) {
    const id = asText(row[col('CDC_Test_ID')]);
    if (!id) continue;
    const doses: CdsiTestDose[] = [];
    for (let k = 1; k <= 7; k++) {
      const date = asDate(row[col(`Date_Administered_${k}`)]);
      const cvx = asText(row[col(`CVX_${k}`)]);
      if (!date || !cvx) continue;
      doses.push({
        date,
        cvx: cvx.padStart(2, '0'),
        name: asText(row[col(`Vaccine_Name_${k}`)]) ?? '',
        status: asText(row[col(`Evaluation_Status_${k}`)]) ?? '',
        reason: asText(row[col(`Evaluation_Reason_${k}`)]),
      });
    }
    const forecastNumber = asText(row[col('Forecast_#')]);
    const forecast = {
      doseNumber: forecastNumber && /^\d+$/.test(forecastNumber) ? Number(forecastNumber) : undefined,
      earliest: asDate(row[col('Earliest_Date')]),
      recommended: asDate(row[col('Recommended_Date')]),
      pastDue: asDate(row[col('Past_Due_Date')]),
    };
    cases.push({
      id,
      name: asText(row[col('Test_Case_Name')]) ?? '',
      dob: asDate(row[col('DOB')])!,
      gender: asText(row[col('gender')]) ?? '',
      assessmentDate: asDate(row[col('Assessment_Date')])!,
      vaccineGroup: asText(row[col('Vaccine_Group')]) ?? '',
      seriesStatus: asText(row[col('Series_Status')]) ?? '',
      doses,
      forecast: Object.values(forecast).some((v) => v !== undefined) ? forecast : undefined,
      evaluationTestType: asText(row[col('Evaluation_Test_Type')]),
      forecastTestType: asText(row[col('Forecast_Test_Type')]),
    });
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify(
      { source: path.basename(xlsx), version, generatedAt: new Date().toISOString().slice(0, 10), cases },
      null,
      1
    ) + '\n'
  );
  console.log(`Wrote ${cases.length} test cases to ${out}`);
}

main();
