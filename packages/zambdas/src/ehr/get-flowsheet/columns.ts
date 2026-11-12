import { FlowsheetLabResult, FlowsheetReading, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { buildVitalsFlowsheet, describeOutsideResult, describeVisit, newestFirst } from './helpers';
import { LAB_ROW_LOINC_CODES } from './lab-loinc-codes.generated';
import { FlowsheetData, isUnlinkedResultKey } from './patient-data';

/**
 * A lab row. A result with LOINC codes lands on the row whose generated code list (from lab-row-rules.ts) has one of
 * them, by code alone; a result without any code lands on the first row whose `analyte` pattern matches its name and
 * whose `exclude` pattern does not.
 */
export interface LabRow {
  key: string;
  analyte: RegExp;
  exclude?: RegExp;
}

export const labRowFor = (rows: LabRow[], lab: FlowsheetLabResult): string | undefined =>
  (lab.loincCodes.length > 0
    ? rows.find((row) => lab.loincCodes.some((code) => LAB_ROW_LOINC_CODES[row.key]?.includes(code)))
    : rows.find((row) => row.analyte.test(lab.analyte) && !row.exclude?.test(lab.analyte))
  )?.key;

const byResultedAt = (a: FlowsheetLabResult, b: FlowsheetLabResult): number =>
  (a.resultedAt ?? '').localeCompare(b.resultedAt ?? '');

export interface ConditionColumns {
  /** The column for an encounter id or an unlinked-result key, made on first use and dated by `fallbackStart`. */
  columnFor: (key: string, fallbackStart: string | undefined) => FlowsheetVisit | undefined;
  addReading: (column: FlowsheetVisit, key: string, reading: FlowsheetReading) => void;
  /** Every numeric lab result that lands on one of `rows`, in its visit's or outside result's column. */
  addLabs: (rows: LabRow[]) => void;
  /** The columns that hold one of the condition's own items, newest first. */
  list: () => FlowsheetVisit[];
}

/**
 * The columns of a condition flowsheet: one per visit, plus one per unlinked outside result. Only the condition's own
 * items (every key but `vitalKeys`) put a column on the flowsheet; the vitals show in columns that exist anyway.
 */
export const conditionColumns = (data: FlowsheetData, vitalKeys: string[]): ConditionColumns => {
  // Keyed like the vitals builder groups them: by encounter id, '' for readings not linked to a visit.
  const columns = new Map<string, FlowsheetVisit>();
  buildVitalsFlowsheet({ ...data, observations: data.vitals ?? [] }).forEach((visit) => {
    const values = Object.fromEntries(Object.entries(visit.values).filter(([key]) => vitalKeys.includes(key)));
    if (Object.keys(values).length > 0) columns.set(visit.encounterId ?? '', { ...visit, values });
  });

  // A visit without vitals is dated by its appointment, else by the data that puts it on the flowsheet.
  const columnFor: ConditionColumns['columnFor'] = (key, fallbackStart) => {
    const existing = columns.get(key);
    if (existing) return existing;
    const described = isUnlinkedResultKey(key) ? describeOutsideResult() : describeVisit(key, data);
    const start = described.start ?? fallbackStart;
    if (!start) return undefined;
    const column = { ...described, start, values: {} };
    columns.set(key, column);
    return column;
  };
  const addReading: ConditionColumns['addReading'] = (column, key, reading) => {
    column.values[key] = { ...reading, readings: [...(column.values[key]?.readings ?? []), reading] };
  };
  const addLabs: ConditionColumns['addLabs'] = (rows) =>
    Object.entries(data.labs ?? {}).forEach(([key, labs]) => {
      // Oldest first, so the latest result of each row in the column is the cell value; every one is kept.
      // Only numeric results are shown.
      const matched = labs
        .filter((lab) => lab.value !== undefined)
        .flatMap((lab) => {
          const row = labRowFor(rows, lab);
          return row ? [{ row, lab }] : [];
        })
        .sort((a, b) => byResultedAt(a.lab, b.lab));
      if (matched.length === 0) return;
      const column = columnFor(key, matched[0].lab.resultedAt);
      if (!column) return;
      matched.forEach(({ row, lab }) => {
        addReading(column, row, {
          time: lab.resultedAt ?? column.start,
          value: lab.value as number,
          unit: lab.unit || undefined,
          flag: lab.flag,
        });
      });
    });
  const list: ConditionColumns['list'] = () =>
    newestFirst(
      [...columns.values()].filter((column) => Object.keys(column.values).some((key) => !vitalKeys.includes(key)))
    );

  return { columnFor, addReading, addLabs, list };
};
