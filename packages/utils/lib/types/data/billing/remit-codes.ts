// One claim adjustment reason code (CARC) or remittance advice remark code (RARC), with the
// plain-language description billers see.
export interface RemitCodeEntry {
  code: string;
  description: string;
}

export interface RemitCodeLists {
  carc: RemitCodeEntry[];
  rarc: RemitCodeEntry[];
}

const CODE_FORMAT = {
  CARC: /^[A-Z]?\d{1,3}$/,
  RARC: /^(?:M|MA|N)\d{1,3}$/,
} as const;

// Reads the remit code source (scripts/data/remit-codes.csv): a header row, then one row per code
// with its `type` (CARC or RARC), `code` and `label`, the description billers see. Other columns are
// notes for whoever maintains the list. Each list comes back in code order. Throws on anything
// unexpected so a bad edit fails generation loudly.
export function parseRemitCodeCsv(text: string): RemitCodeLists {
  const [header, ...rows] = readCsvRows(text);
  const column = (name: string): number => {
    const index = (header ?? []).indexOf(name);
    if (index < 0) throw new Error(`Missing "${name}" column`);
    return index;
  };
  const [typeAt, codeAt, labelAt] = [column('type'), column('code'), column('label')];

  const lists: RemitCodeLists = { carc: [], rarc: [] };
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const where = `row ${index + 2}`;
    const type = row[typeAt]?.trim() ?? '';
    const code = row[codeAt]?.trim() ?? '';
    const description = row[labelAt]?.trim() ?? '';
    if (type !== 'CARC' && type !== 'RARC') throw new Error(`Unknown type "${type}" on ${where}`);
    if (!CODE_FORMAT[type].test(code)) throw new Error(`Malformed ${type} "${code}" on ${where}`);
    if (!description) throw new Error(`${type} ${code} has no label on ${where}`);
    if (seen.has(`${type} ${code}`)) throw new Error(`Duplicate ${type} ${code} on ${where}`);
    seen.add(`${type} ${code}`);
    lists[type === 'CARC' ? 'carc' : 'rarc'].push({ code, description });
  });
  lists.carc.sort(compareRemitCodes);
  lists.rarc.sort(compareRemitCodes);
  return lists;
}

// Number-only codes first, then by letter prefix, each prefix in numeric order:
// 1, 2, …, 253, A0, A1, …, B1, …; M1, …, M144, MA01, …, N1, ….
function compareRemitCodes(a: RemitCodeEntry, b: RemitCodeEntry): number {
  const [prefixA, numberA] = splitCode(a.code);
  const [prefixB, numberB] = splitCode(b.code);
  if (prefixA !== prefixB) return prefixA < prefixB ? -1 : 1;
  if (numberA !== numberB) return numberA - numberB;
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
}

function splitCode(code: string): [string, number] {
  const [, prefix = '', digits = '0'] = /^([A-Z]*)(\d+)$/.exec(code) ?? [];
  return [prefix, Number(digits)];
}

// CSV as spreadsheets write it: commas between fields, and double quotes around a field holding a
// comma, quote or line break, with "" for a quote inside. Blank lines are skipped.
function readCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endRow = (): void => {
    row.push(field);
    if (row.some((value) => value.trim())) rows.push(row);
    row = [];
    field = '';
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[index + 1] === '"') field += text[++index];
      else quoted = false;
    } else if (char === '"' && field === '') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') endRow();
    else if (char !== '\r') field += char;
  }
  if (quoted) throw new Error('Unterminated quoted field');
  endRow();
  return rows;
}
