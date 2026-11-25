export interface CvxVaccine {
  cvx: string;
  name: string;
  fullName: string;
  notes?: string;
}

export interface MvxManufacturer {
  mvx: string;
  name: string;
}

// Active codes a practice would not stock: national stockpile, avian and Southern Hemisphere flu,
// self-administered nasal flu and the shortage-only yellow fever product
export const CVX_NOT_OFFERED: ReadonlySet<string> = new Set([
  '160',
  '183',
  '200',
  '201',
  '202',
  '231',
  '318',
  '321',
  '322',
  '331',
  '333',
  '337',
]);

const CDC_DATE = /^\d{4}\/\d{2}\/\d{2}$/;

function readCdcRows(text: string, fieldCount: number): { row: string; cells: string[] }[] {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line, index) => ({ line, row: `row ${index + 1}` }))
    .filter(({ line }) => line.trim())
    .map(({ line, row }) => {
      const cells = line.split('|').map((cell) => cell.trim());
      if (cells.length !== fieldCount) throw new Error(`${cells.length} fields on ${row}, expected ${fieldCount}`);
      return { row, cells };
    });
}

export function parseCdcCvx(text: string): CvxVaccine[] {
  const seen = new Set<string>();
  const vaccines: CvxVaccine[] = [];
  readCdcRows(text, 7).forEach(({ row, cells: [cvx, name, fullName, notes, status, nonVaccine, updated] }) => {
    if (!/^\d{2,3}$/.test(cvx)) throw new Error(`Malformed CVX "${cvx}" on ${row}`);
    if (!name || !fullName) throw new Error(`CVX ${cvx} has no name on ${row}`);
    if (!status || !/^(True|False)$/.test(nonVaccine) || !CDC_DATE.test(updated)) {
      throw new Error(`CVX ${cvx} has an unexpected status, non-vaccine flag or date on ${row}`);
    }
    if (seen.has(cvx)) throw new Error(`Duplicate CVX ${cvx} on ${row}`);
    seen.add(cvx);
    if (status === 'Active' && nonVaccine === 'False' && !CVX_NOT_OFFERED.has(cvx)) {
      vaccines.push({ cvx, name, fullName, ...(notes ? { notes } : {}) });
    }
  });
  if (!vaccines.length) throw new Error('No active CVX vaccines found');
  return vaccines.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

export function parseCdcMvx(text: string): MvxManufacturer[] {
  const seen = new Set<string>();
  const manufacturers: MvxManufacturer[] = [];
  readCdcRows(text, 5).forEach(({ row, cells: [mvx, name, , status, updated] }) => {
    if (!/^[A-Z]{2,3}$/.test(mvx)) throw new Error(`Malformed MVX "${mvx}" on ${row}`);
    if (!name) throw new Error(`MVX ${mvx} has no name on ${row}`);
    if (!status || !CDC_DATE.test(updated)) throw new Error(`MVX ${mvx} has an unexpected status or date on ${row}`);
    if (seen.has(mvx)) throw new Error(`Duplicate MVX ${mvx} on ${row}`);
    seen.add(mvx);
    if (status === 'Active') manufacturers.push({ mvx, name });
  });
  if (!manufacturers.length) throw new Error('No active MVX manufacturers found');
  return manufacturers.sort((a, b) => (a.mvx < b.mvx ? -1 : a.mvx > b.mvx ? 1 : 0));
}
