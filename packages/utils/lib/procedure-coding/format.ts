import { detectProcedureFamily } from './evaluate';
import { CptCodeRef, RepairDepthSelection } from './model.types';
import { CodingField, StructuredFacts } from './structured-fields';

export const REPAIR_DEPTH_OPTIONS: Array<{ value: RepairDepthSelection; label: string }> = [
  { value: 'superficial-single', label: 'Superficial — single-layer closure' },
  { value: 'subcutaneous-single', label: 'Subcutaneous — single-layer closure' },
  { value: 'subcutaneous-layered', label: 'Subcutaneous — layered closure' },
  { value: 'fascia-muscle-layered', label: 'Fascia/muscle involved — layered closure' },
  { value: 'tissue-adhesive-only', label: 'Tissue adhesive only (e.g. Dermabond)' },
  { value: 'strips-only', label: 'Adhesive strips only' },
];

export function isRepairDepthSelection(value: string | undefined): value is RepairDepthSelection {
  return REPAIR_DEPTH_OPTIONS.some((option) => option.value === value);
}

export function repairDepthDisplayLabel(value: string): string {
  return REPAIR_DEPTH_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

const CLOCK_TIME_PATTERN = /^\s*(\d{1,2}):(\d{2})\s*$/;
const MINUTES_PER_DAY = 24 * 60;

export function parseClockTime(raw: string | undefined): number | undefined {
  if (!raw) return undefined;

  const match = CLOCK_TIME_PATTERN.exec(raw);

  if (!match) return undefined;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours > 23 || minutes > 59) return undefined;

  return hours * 60 + minutes;
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function clockSpan(
  startMinutes: number,
  stopMinutes: number
): { durationMinutes: number; crossesMidnight: boolean } {
  const crossesMidnight = stopMinutes < startMinutes;

  return {
    durationMinutes: stopMinutes - startMinutes + (crossesMidnight ? MINUTES_PER_DAY : 0),
    crossesMidnight,
  };
}

export function formatInfusionTimeRange(startTime?: string, stopTime?: string): string | undefined {
  if (!startTime && !stopTime) return undefined;
  const start = parseClockTime(startTime);
  const stop = parseClockTime(stopTime);
  const range = `${startTime ?? ''}–${stopTime ?? ''}`;

  if (start === undefined || stop === undefined) return range;

  return `${range} (${clockSpan(start, stop).durationMinutes} min)`;
}

/** Displays the actual saved answers, without inventing defaults or dropping unfamiliar legacy keys. */
export function formatStructuredFacts(facts: StructuredFacts | undefined, procedureType?: string): string {
  if (!facts) return '';
  const fields = detectProcedureFamily({ procedureType })?.fields ?? [];
  const humanize = (key: string): string => {
    const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  };
  const format = (answers: StructuredFacts, definitions: readonly CodingField[]): string[] => {
    const keys = [...new Set([...definitions.map((field) => field.key), ...Object.keys(answers)])];
    return keys.flatMap((key) => {
      const value = answers[key];
      if (value === undefined || value === '') return [];
      const field = definitions.find((item) => item.key === key);
      const label = field?.label ?? humanize(key);
      if (Array.isArray(value)) {
        const children = field?.kind === 'rows' ? field.fields : [];
        return value.flatMap((row, index) => {
          const parts = format(row, children);
          return parts.length ? [`${label} ${index + 1}: ${parts.join('; ')}`] : [];
        });
      }
      return [`${label}: ${typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}`];
    });
  };
  return format(facts, fields).join('\n');
}

/** Modifiers and quantity are part of a saved billing choice on every review surface. */
export function formatProcedureCptCode(cpt: CptCodeRef): string {
  const modifiers = cpt.modifier?.map((modifier) => modifier.code).join(', ');
  const quantity = cpt.billableUnits === undefined ? '' : ` × ${cpt.billableUnits}`;
  const description = cpt.display && cpt.display !== cpt.code ? ` — ${cpt.display}` : '';
  return `${cpt.code}${modifiers ? `-${modifiers}` : ''}${quantity}${description}`;
}
