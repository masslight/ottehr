import { parse } from 'csv-parse/browser/esm/sync';
import { BillingChargeItemDefinitionProcedureCode } from 'utils';

/** Priority-ordered patterns for each CSV column type. First match wins. */
const CODE_PATTERNS = [
  /^proc(edure)?\s*code$/,
  /^cpt\s*(\/\s*hcpcs|code)?$/,
  /^hcpcs(\s*code)?$/,
  /^service\s*code$/,
  /^code$/,
  /proc(edure)?/,
  /^cpt/,
];
const AMOUNT_PATTERNS = [/amount/, /price/, /^rate$/, /^fee$/, /^charge$/, /^cost$/];
const MODIFIER_PATTERNS = [/^mod(ifier)?$/];
const DESCRIPTION_PATTERNS = [/^desc(ription)?$/, /desc/];

function findColumnIndex(headers: string[], patterns: RegExp[], exclude: Set<number>): number {
  for (const pattern of patterns) {
    const idx = headers.findIndex((c, i) => !exclude.has(i) && pattern.test(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseAmount(raw: string | undefined): number {
  const cleaned = raw?.trim().replace(/^\$/, '').replace(/,/g, '');
  if (!cleaned) return NaN;
  // Number('') / parseFloat('12abc') pitfalls: validate the entire cleaned value
  return Number(cleaned);
}

export function codeKey(pc: Pick<BillingChargeItemDefinitionProcedureCode, 'code' | 'modifier'>): string {
  return `${pc.code}|${pc.modifier ?? ''}`;
}

export type ParsedProcedureCodeCsv =
  | { ok: true; codes: BillingChargeItemDefinitionProcedureCode[]; skippedRows: string[]; hasDescriptions: boolean }
  | { ok: false; error: string };

export function parseProcedureCodeCsv(text: string): ParsedProcedureCodeCsv {
  let records: string[][];
  try {
    records = parse(text, { bom: true, skip_empty_lines: true, relax_column_count: true });
  } catch {
    return { ok: false, error: 'Error reading CSV file. Please try again.' };
  }
  if (records.length < 2) {
    return { ok: false, error: 'CSV file must have a header row and at least one data row.' };
  }

  const headers = records[0].map((h) => h.trim().toLowerCase());
  const claimed = new Set<number>();
  const codeIdx = findColumnIndex(headers, CODE_PATTERNS, claimed);
  if (codeIdx >= 0) claimed.add(codeIdx);
  const amountIdx = findColumnIndex(headers, AMOUNT_PATTERNS, claimed);
  if (amountIdx >= 0) claimed.add(amountIdx);
  const modifierIdx = findColumnIndex(headers, MODIFIER_PATTERNS, claimed);
  if (modifierIdx >= 0) claimed.add(modifierIdx);
  const descriptionIdx = findColumnIndex(headers, DESCRIPTION_PATTERNS, claimed);
  if (codeIdx < 0 || amountIdx < 0) {
    return { ok: false, error: 'CSV must have "Procedure Code" and "Amount" columns.' };
  }

  // Duplicate code+modifier rows: last one wins
  const codesByKey = new Map<string, BillingChargeItemDefinitionProcedureCode>();
  const skippedRows: string[] = [];
  records.slice(1).forEach((row, i) => {
    const code = row[codeIdx]?.trim();
    const amount = parseAmount(row[amountIdx]);
    if (!code || !Number.isFinite(amount) || amount < 0) {
      skippedRows.push(`Row ${i + 2}: invalid code or amount`);
      return;
    }
    const modifier = modifierIdx >= 0 ? row[modifierIdx]?.trim() || undefined : undefined;
    const description = descriptionIdx >= 0 ? row[descriptionIdx]?.trim() || undefined : undefined;
    codesByKey.set(codeKey({ code, modifier }), { code, description, modifier, amount });
  });
  if (codesByKey.size === 0) {
    return { ok: false, error: 'No valid rows found in the CSV file.' };
  }

  return { ok: true, codes: [...codesByKey.values()], skippedRows, hasDescriptions: descriptionIdx >= 0 };
}

export type DeltaStatus = 'added' | 'changed' | 'removed';

export interface DeltaRow {
  status: DeltaStatus;
  code: BillingChargeItemDefinitionProcedureCode;
  previousAmount?: number;
}

export function computeDelta(
  current: BillingChargeItemDefinitionProcedureCode[],
  uploaded: BillingChargeItemDefinitionProcedureCode[],
  csvHasDescriptions: boolean
): { rows: DeltaRow[]; unchangedCount: number } {
  const currentByKey = new Map(current.map((pc) => [codeKey(pc), pc]));
  const uploadedKeys = new Set(uploaded.map(codeKey));
  const rows: DeltaRow[] = [];
  let unchangedCount = 0;
  for (const pc of uploaded) {
    const existing = currentByKey.get(codeKey(pc));
    if (!existing) {
      rows.push({ status: 'added', code: pc });
    } else if (existing.amount !== pc.amount || (csvHasDescriptions && pc.description !== existing.description)) {
      rows.push({ status: 'changed', code: pc, previousAmount: existing.amount });
    } else {
      unchangedCount++;
    }
  }
  for (const pc of current) {
    if (!uploadedKeys.has(codeKey(pc))) {
      rows.push({ status: 'removed', code: pc });
    }
  }
  return { rows, unchangedCount };
}
