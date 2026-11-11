// The CDC code sets the vaccine catalog is built from: CVX (the vaccine), MVX (the manufacturer) and the
// NDC crosswalk (which box is which vaccine from which manufacturer). The sources are CDC downloads kept in
// scripts/data/cdc-vaccines/; `npm run codes:vaccines` turns them into the *.generated.ts tables next to
// this file. The parsers live here so the generator and the test that keeps the tables in step share them.

/** One vaccine the practice can switch on: one entry per CVX code. */
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

/** One package from the CDC NDC crosswalk. NDCs are 11-digit, hyphenated 5-4-2, as the crosswalk spells them. */
export interface NdcVaccineProduct {
  saleNdc: string;
  useNdc?: string;
  name: string;
  labeler: string;
  cvx: string;
  mvx: string;
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

const readPsvRows = (text: string): string[][] =>
  text
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => line.split('|').map((cell) => cell.trim()));

/** scripts/data/cdc-vaccines/cvx-active.psv → the vaccines the catalog offers, in name order. */
export function parseCvxPsv(text: string): CvxVaccine[] {
  const seen = new Set<string>();
  return readPsvRows(text)
    .map((row, index) => {
      const [cvx, name, fullName, notes] = row;
      if (!/^\d{2,3}$/.test(cvx ?? '')) throw new Error(`Malformed CVX "${cvx}" on row ${index + 1}`);
      if (!name || !fullName) throw new Error(`CVX ${cvx} has no name on row ${index + 1}`);
      if (seen.has(cvx)) throw new Error(`Duplicate CVX ${cvx} on row ${index + 1}`);
      seen.add(cvx);
      return { cvx, name, fullName, ...(notes ? { notes } : {}) };
    })
    .filter((vaccine) => !CVX_NOT_OFFERED.has(vaccine.cvx))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** scripts/data/cdc-vaccines/mvx-active.psv → the active manufacturers, in code order. */
export function parseMvxPsv(text: string): MvxManufacturer[] {
  const seen = new Set<string>();
  return readPsvRows(text)
    .map((row, index) => {
      const [mvx, name] = row;
      if (!/^[A-Z]{2,3}$/.test(mvx ?? '')) throw new Error(`Malformed MVX "${mvx}" on row ${index + 1}`);
      if (!name) throw new Error(`MVX ${mvx} has no name on row ${index + 1}`);
      if (seen.has(mvx)) throw new Error(`Duplicate MVX ${mvx} on row ${index + 1}`);
      seen.add(mvx);
      return { mvx, name };
    })
    .sort((a, b) => a.mvx.localeCompare(b.mvx));
}

const NDC11 = /^\d{5}-\d{4}-\d{2}$/;

/**
 * scripts/data/cdc-vaccines/cdc-ndc-lookup.txt (the CDC "NDC Lookup Crosswalk" flat file: quoted,
 * pipe-delimited, one row per sale NDC × use NDC) → the packages of the offered vaccines. Packages whose
 * sale ended before `keepEndedSince` (YYYY-MM-DD) are dropped; a box can outlive its listing for a while.
 */
export function parseCdcNdcLookup(text: string, offered: Set<string>, keepEndedSince: string): NdcVaccineProduct[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim());
  const [header, ...rows] = lines.map((line) => line.split('|').map((cell) => cell.replace(/^"|"$/g, '').trim()));
  const column = (name: string): number => {
    const index = (header ?? []).indexOf(name);
    if (index < 0) throw new Error(`Missing "${name}" column`);
    return index;
  };
  const at = {
    sale: column('Sale NDC11'),
    name: column('Sale Proprietary Name'),
    labeler: column('Sale Labeler'),
    end: column('End Date'),
    use: column('Use NDC11'),
    cvx: column('CVX Code'),
    mvx: column('MVX Code'),
  };
  const toIsoDate = (mdy: string): string | undefined => {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(mdy);
    return match ? `${match[3]}-${match[1]}-${match[2]}` : undefined;
  };
  const seen = new Set<string>();
  return rows
    .flatMap((row): NdcVaccineProduct[] => {
      const saleNdc = row[at.sale] ?? '';
      const useNdc = row[at.use] || undefined;
      const cvx = row[at.cvx] ?? '';
      const ended = toIsoDate(row[at.end] ?? '');
      if (!NDC11.test(saleNdc) || !offered.has(cvx) || (ended && ended < keepEndedSince)) return [];
      const key = `${saleNdc}|${useNdc ?? ''}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [
        {
          saleNdc,
          ...(useNdc && NDC11.test(useNdc) ? { useNdc } : {}),
          name: row[at.name] ?? '',
          labeler: row[at.labeler] ?? '',
          cvx,
          mvx: row[at.mvx] ?? '',
        },
      ];
    })
    .sort((a, b) => a.saleNdc.localeCompare(b.saleNdc) || (a.useNdc ?? '').localeCompare(b.useNdc ?? ''));
}

/**
 * The 11-digit 5-4-2 NDCs a typed NDC could mean. 11 digits (hyphenated or not) is itself; a hyphenated
 * 10-digit NDC (4-4-2, 5-3-2, 5-4-1) pads its short segment; 10 bare digits could be any of the three.
 */
export const ndc11Candidates = (input: string): string[] => {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  const parts = trimmed.split('-');
  if (digits.length === 11) return [`${digits.slice(0, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`];
  if (digits.length !== 10) return [];
  if (parts.length === 3 && parts.every((part) => /^\d+$/.test(part))) {
    const [labeler, product, pkg] = parts;
    return [`${labeler.padStart(5, '0')}-${product.padStart(4, '0')}-${pkg.padStart(2, '0')}`];
  }
  if (parts.length !== 1) return [];
  return [
    `0${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`,
    `${digits.slice(0, 5)}-0${digits.slice(5, 8)}-${digits.slice(8)}`,
    `${digits.slice(0, 5)}-${digits.slice(5, 9)}-0${digits.slice(9)}`,
  ];
};
