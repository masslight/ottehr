import { RepairDepthSelection } from './model.types';

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
