// Generic interpreter for the reviewed procedure-coding decision tables
// (./tables/*-decision-tables.json). Implements ONLY the weak vocabulary:
// rowLookup (top-down first match, omitted fact = wildcard), threshold banding,
// unit caps, doc checklists, payer notes. No family-specific branches, no expressions.
//
// Chaining convention (generic, mirrored in the JSON's meta.semantics.chaining):
// a matched row/band output whose flags contain "proceed:<tableId>" transfers the walk
// to that table — rowLookup (row output) or threshold (band output) alike; bare
// "proceed" means the next code-emitting rowLookup in document order. An output with
// no proceed flag settles the walk: its codes (possibly empty) are the emission.

import { DefendCodeFinding, SuggestedClaimLine, SuggestResult } from './model.types';

export type FactValue = string | number | boolean;
export type Facts = Record<string, FactValue | undefined>;

/** SuggestResult plus the engine-internal extras dispatch strips before returning. */
export interface EvaluatorSuggestResult extends SuggestResult {
  aux: Record<string, unknown>;
  /** Codes whose units were computed by a threshold band from a counted fact (units are
   * facts-authoritative for these; rowLookup emissions are per-invocation instead). */
  bandDerivedCodes?: string[];
}

interface Row {
  when: Record<string, FactValue>;
  output: Record<string, any>;
}

interface Band {
  min: number | null;
  max: number | null;
  output: Record<string, any>;
}

interface UnitCap {
  code: string;
  maxUnitsPerDay: number;
}

interface Table {
  id: string;
  kind: 'rowLookup' | 'threshold' | 'unitCaps' | 'docChecklist' | 'payerNotes';
  input?: string;
  inputs?: string[];
  rows?: Row[];
  bands?: Band[];
  caps?: UnitCap[];
  code?: string;
  required?: string[];
  notes?: string[];
}

export interface Family {
  family: string;
  codes: string[];
  tables: Table[];
}

export interface TableDoc {
  families: Family[];
}

export function getFamily(doc: TableDoc, familyName: string): Family {
  const family = doc.families.find((f) => f.family === familyName);
  if (!family) throw new Error(`unknown family: ${familyName}`);
  return family;
}

function rowMatches(when: Record<string, FactValue>, facts: Facts): boolean {
  return Object.entries(when).every(([fact, expected]) => facts[fact] === expected);
}

function lookupRow(table: Table, facts: Facts): Record<string, any> | undefined {
  return (table.rows ?? []).find((row) => rowMatches(row.when, facts))?.output;
}

function lookupBand(table: Table, facts: Facts): Record<string, any> | undefined {
  const value = facts[table.input ?? ''];
  if (typeof value !== 'number') return undefined;
  return (table.bands ?? []).find(
    (band) => (band.min == null || value >= band.min) && (band.max == null || value <= band.max)
  )?.output;
}

/** A rowLookup table that can emit claim lines (vs auxiliary lookups like diagnosis/same-day-E/M). */
function emitsCodes(table: Table): boolean {
  return table.kind === 'rowLookup' && (table.rows ?? []).some((row) => Array.isArray(row.output.codes));
}

export function familyCaps(family: Family): UnitCap[] {
  return family.tables.filter((t) => t.kind === 'unitCaps').flatMap((t) => t.caps ?? []);
}

/** Required-documentation items from the docChecklist tables matching the emitted codes. */
export function checklistDocs(tables: Table[], emitted: string[]): string[] {
  return tables
    .filter((t) => t.kind === 'docChecklist' && (t.code ?? '').split('|').some((c) => emitted.includes(c)))
    .flatMap((t) => t.required ?? []);
}

export function suggest(doc: TableDoc, familyName: string, facts: Facts): EvaluatorSuggestResult {
  const family = getFamily(doc, familyName);
  const tables = family.tables;
  const result: EvaluatorSuggestResult = { codes: [], requiredDocumentation: [], payerNotes: [], flags: [], aux: {} };

  let current = tables.find(emitsCodes);
  while (current) {
    // Fail closed: a rowLookup's declared inputs are the facts its rows discriminate
    // on. An undetermined input must refuse rather than fall through keyed rows onto
    // a wildcard (e.g. an unset compliance gate silently passing).
    if (current.kind !== 'threshold') {
      const undetermined = (current.inputs ?? []).filter((input) => facts[input] === undefined);
      if (undetermined.length > 0) {
        result.flags.push(...undetermined.map((input) => `missing:${input}`));
        break;
      }
    }
    const output = current.kind === 'threshold' ? lookupBand(current, facts) : lookupRow(current, facts);
    if (output === undefined) {
      result.flags.push(`${current.kind === 'threshold' ? 'no_band_matched' : 'no_row_matched'}:${current.id}`);
      break;
    }
    const flags: string[] = output.flags ?? [];
    const proceed = flags.find((f) => f === 'proceed' || f.startsWith('proceed:'));
    result.flags.push(...flags.filter((f) => f !== proceed));
    if (!proceed) {
      result.codes = (output.codes ?? []).map(
        (line: SuggestedClaimLine): SuggestedClaimLine => ({ ...line, modifiers: [...(line.modifiers ?? [])] })
      );
      if (current.kind === 'threshold') {
        result.bandDerivedCodes = result.codes.map((line) => line.code);
      }
      break;
    }
    const targetId = proceed.includes(':') ? proceed.slice(proceed.indexOf(':') + 1) : undefined;
    const from = current;
    current = targetId
      ? tables.find((t) => t.id === targetId)
      : tables.slice(tables.indexOf(from) + 1).find(emitsCodes);
    if (!current) throw new Error(`proceed target not found from table ${from.id}`);
  }

  // Unit caps are absolute inputs to claim assembly: clamp and flag.
  for (const line of result.codes) {
    const cap = familyCaps(family).find((c) => c.code === line.code);
    if (cap && line.units > cap.maxUnitsPerDay) {
      result.flags.push(`units_capped:${line.code}:${cap.maxUnitsPerDay}`);
      line.units = cap.maxUnitsPerDay;
    }
  }

  const emitted = result.codes.map((line) => line.code);
  result.requiredDocumentation.push(...checklistDocs(tables, emitted));
  result.payerNotes.push(...tables.filter((t) => t.kind === 'payerNotes').flatMap((t) => t.notes ?? []));

  // Auxiliary rowLookup tables (no code outputs) contribute advisory data — only when
  // all their declared input facts are determined, so wildcard rows can't fire on unknowns.
  for (const table of tables.filter((t) => t.kind === 'rowLookup' && !emitsCodes(t))) {
    if (!(table.inputs ?? []).every((input) => facts[input] !== undefined)) continue;
    const output = lookupRow(table, facts);
    if (output === undefined) continue;
    const { note: _note, specRef: _specRef, ...data } = output;
    Object.assign(result.aux, data);
  }

  if (
    result.flags.some(
      (f) =>
        f.startsWith('missing:') ||
        f.startsWith('no_row_matched') ||
        f.startsWith('no_band_matched') ||
        f.includes('requires_review')
    )
  ) {
    result.review = true;
  }
  return result;
}

export function defend(
  doc: TableDoc,
  familyName: string,
  selected: { code: string; units?: number }[],
  facts: Facts
): DefendCodeFinding[] {
  const family = getFamily(doc, familyName);
  const suggestion = suggest(doc, familyName, facts);
  const emitted = suggestion.codes.map((line) => line.code);

  return selected.map(({ code, units }) => {
    if (!family.codes.includes(code)) {
      return { code, status: 'not-assessed' as const, reasons: [`${code} is outside the ${familyName} tables`] };
    }
    if (!emitted.includes(code)) {
      const alternative = emitted.length > 0 ? [`tables yield ${emitted.join(' + ')} for these facts`] : [];
      return { code, status: 'not-supported' as const, reasons: [...suggestion.flags, ...alternative] };
    }
    const cap = familyCaps(family).find((c) => c.code === code);
    if (cap && (units ?? 1) > cap.maxUnitsPerDay) {
      return {
        code,
        status: 'not-supported' as const,
        reasons: [`${units} units exceed the ${cap.maxUnitsPerDay}-unit per-day cap`],
      };
    }
    // Threshold-band units are facts-derived (counted fact -> units): a selection claiming
    // more units than the bands computed (summed across the code's suggestion lines, e.g.
    // 93000 + 93000-76) is not supported. rowLookup emissions are per-invocation, so only
    // the MUE cap constrains them.
    const documentedUnits = suggestion.codes.filter((l) => l.code === code).reduce((sum, l) => sum + l.units, 0);
    if (documentedUnits > 0 && (suggestion.bandDerivedCodes ?? []).includes(code) && (units ?? 1) > documentedUnits) {
      return {
        code,
        status: 'not-supported' as const,
        reasons: [`${units} units exceed the ${documentedUnits} unit(s) the documented facts support`],
      };
    }
    return { code, status: 'supported' as const, reasons: [`facts match the ${code} claim-line row`] };
  });
}
