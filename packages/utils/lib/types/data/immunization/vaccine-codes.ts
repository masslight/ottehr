// The CDC code sets the immunization list is built from: CVX (the vaccine) and MVX (the manufacturer). The
// sources are CDC's own downloads, kept unedited in scripts/data/cdc-vaccines/ (see the README there);
// `npm run codes:vaccines` turns them into the *.generated.ts tables next to this file. The parsers live here
// so the generator and the test that keeps the tables in step share them.

/** One vaccine that can be ordered: one entry per CVX code. */
export interface CvxVaccine {
  cvx: string;
  /** CDC short description, the name staff see. */
  name: string;
  fullName: string;
  notes?: string;
}

export interface MvxManufacturer {
  mvx: string;
  name: string;
}

/**
 * Active CVX codes a practice would not stock: national stockpile, avian flu, Southern Hemisphere flu, the
 * self-administered nasal flu and the shortage-only yellow fever formulation. Everything else active is offered.
 */
export const CVX_NOT_OFFERED = new Set([
  '318',
  '160',
  '321',
  '322',
  '231',
  '337',
  '200',
  '201',
  '202',
  '331',
  '333',
  '183',
]);

const CDC_DATE = /^\d{4}\/\d{2}\/\d{2}$/;

/**
 * The rows of a CDC code-set flat file (cvx.txt, mvx.txt): pipe-delimited, no header row, cells padded with
 * spaces. A row that is not `fieldCount` wide means the download is not the file we expect, so it throws.
 */
const readCdcRows = (text: string, fieldCount: number): string[][] =>
  text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      const cells = line.split('|').map((cell) => cell.trim());
      if (cells.length !== fieldCount) {
        throw new Error(`Row ${index + 1} has ${cells.length} fields, expected ${fieldCount}`);
      }
      return cells;
    });

/**
 * scripts/data/cdc-vaccines/cvx.txt (CDC's CVX code set: code | short description | full name | notes |
 * status | non-vaccine | last updated) → the vaccines the catalog offers, in name order. Kept: status Active
 * and non-vaccine False, minus CVX_NOT_OFFERED. Names and notes are CDC's text, unedited.
 */
export function parseCdcCvx(text: string): CvxVaccine[] {
  const seen = new Set<string>();
  const vaccines = readCdcRows(text, 7)
    .flatMap((row, index): CvxVaccine[] => {
      const [cvx, name, fullName, notes, status, nonVaccine, lastUpdated] = row;
      if (!/^\d{2,3}$/.test(cvx)) throw new Error(`Malformed CVX "${cvx}" on row ${index + 1}`);
      if (!name || !fullName) throw new Error(`CVX ${cvx} has no name on row ${index + 1}`);
      if (!status || !/^(True|False)$/.test(nonVaccine) || !CDC_DATE.test(lastUpdated)) {
        throw new Error(`CVX ${cvx} has an unexpected status, non-vaccine flag or date on row ${index + 1}`);
      }
      if (seen.has(cvx)) throw new Error(`Duplicate CVX ${cvx} on row ${index + 1}`);
      seen.add(cvx);
      if (status !== 'Active' || nonVaccine !== 'False' || CVX_NOT_OFFERED.has(cvx)) return [];
      return [{ cvx, name, fullName, ...(notes ? { notes } : {}) }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!vaccines.length) throw new Error('No active CVX vaccines found');
  return vaccines;
}

/**
 * scripts/data/cdc-vaccines/mvx.txt (CDC's MVX code set: code | manufacturer name | notes | status |
 * last updated) → the manufacturers with status Active, in code order.
 */
export function parseCdcMvx(text: string): MvxManufacturer[] {
  const seen = new Set<string>();
  const manufacturers = readCdcRows(text, 5)
    .flatMap((row, index): MvxManufacturer[] => {
      const [mvx, name, , status, lastUpdated] = row;
      if (!/^[A-Z]{2,3}$/.test(mvx)) throw new Error(`Malformed MVX "${mvx}" on row ${index + 1}`);
      if (!name) throw new Error(`MVX ${mvx} has no name on row ${index + 1}`);
      if (!status || !CDC_DATE.test(lastUpdated)) {
        throw new Error(`MVX ${mvx} has an unexpected status or date on row ${index + 1}`);
      }
      if (seen.has(mvx)) throw new Error(`Duplicate MVX ${mvx} on row ${index + 1}`);
      seen.add(mvx);
      return status === 'Active' ? [{ mvx, name }] : [];
    })
    .sort((a, b) => a.mvx.localeCompare(b.mvx));
  if (!manufacturers.length) throw new Error('No active MVX manufacturers found');
  return manufacturers;
}
