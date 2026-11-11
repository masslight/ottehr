import { DateTime } from 'luxon';
import { effectiveVisitTypes, expandProviderSchedule } from 'utils/lib/provider-schedule/expand';
import { ProviderScheduleConfig, ScheduledAppointment } from 'utils/lib/provider-schedule/types';
import { buildMockConfigs, MOCK_LOCATIONS, MOCK_PATIENT_NAMES, MOCK_PROVIDERS, MOCK_VISIT_TYPES } from './mockSeed';
import { ProviderScheduleApi } from './providerScheduleApi';

const STORAGE_KEY = 'ottehr.provider-schedule.mock.v1';
const LATENCY_MS = 150;

const delay = <T>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), LATENCY_MS));

const readStored = (): Record<string, ProviderScheduleConfig> | undefined => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ProviderScheduleConfig>) : undefined;
  } catch {
    return undefined;
  }
};

const writeStored = (configs: Record<string, ProviderScheduleConfig>): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  } catch {
    // Storage unavailable (private mode etc.) — edits last for the session only.
  }
};

/** Deterministic 0..1 from a string, so generated appointments are stable across reloads. */
const hash01 = (input: string): number => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
};

/**
 * Appointments are generated from the *seed* templates, not the current (possibly edited) ones.
 * That mirrors reality: changing a template doesn't move appointments that are already booked,
 * so the UI can show which bookings now fall outside the schedule.
 */
const seedConfigs = buildMockConfigs();
const appointmentCache = new Map<string, ScheduledAppointment[]>();

const generateAppointmentsForDay = (providerId: string, date: string): ScheduledAppointment[] => {
  const cacheKey = `${providerId}:${date}`;
  const cached = appointmentCache.get(cacheKey);
  if (cached) return cached;

  const config = seedConfigs[providerId];
  const out: ScheduledAppointment[] = [];
  if (config) {
    const now = DateTime.now().setZone(config.timezone);
    const daysOut = DateTime.fromISO(date, { zone: config.timezone }).diff(now.startOf('day'), 'days').days;
    // Busier near today, thinning out a few weeks ahead.
    const fill = daysOut < 0 ? 0.85 : Math.max(0.15, 0.85 - daysOut * 0.025);
    const visitTypes = effectiveVisitTypes(config, MOCK_VISIT_TYPES);
    const blocks = expandProviderSchedule(config, date, date).filter((b) => b.kind === 'bookable');

    for (const block of blocks) {
      const allowed = block.visitTypeIds.length
        ? visitTypes.filter((v) => block.visitTypeIds.includes(v.id))
        : visitTypes;
      if (!allowed.length) continue;
      let cursor = DateTime.fromISO(block.start, { setZone: true });
      const end = DateTime.fromISO(block.end, { setZone: true });
      let n = 0;
      while (cursor < end) {
        const seed = `${providerId}:${date}:${block.key}:${n++}`;
        const vt = allowed[Math.floor(hash01(seed + 'vt') * allowed.length)];
        const apptEnd = cursor.plus({ minutes: vt.durationMinutes });
        if (apptEnd > end) break;
        if (hash01(seed) < fill) {
          const isPast = apptEnd < now;
          const isNow = cursor <= now && now < apptEnd;
          const roll = hash01(seed + 'status');
          out.push({
            id: `mock-${seed}`,
            providerId,
            patientName: MOCK_PATIENT_NAMES[Math.floor(hash01(seed + 'pt') * MOCK_PATIENT_NAMES.length)],
            visitTypeId: vt.id,
            start: cursor.toISO({ suppressMilliseconds: true })!,
            end: apptEnd.toISO({ suppressMilliseconds: true })!,
            status: isNow
              ? 'in-progress'
              : isPast
              ? roll < 0.06
                ? 'no-show'
                : 'completed'
              : roll < 0.05
              ? 'cancelled'
              : 'booked',
          });
          cursor = apptEnd;
        } else {
          // Leave a gap of one shortest-visit length.
          cursor = cursor.plus({ minutes: Math.min(...allowed.map((v) => v.durationMinutes)) });
        }
      }
    }
  }
  appointmentCache.set(cacheKey, out);
  return out;
};

let configs: Record<string, ProviderScheduleConfig> = readStored() ?? buildMockConfigs();

export const mockProviderScheduleApi: ProviderScheduleApi = {
  listProviders: () => delay(MOCK_PROVIDERS),
  listLocations: () => delay(MOCK_LOCATIONS),
  listVisitTypes: () => delay(MOCK_VISIT_TYPES),

  getScheduleConfig: (providerId) =>
    delay(
      configs[providerId] ?? {
        providerId,
        timezone: MOCK_LOCATIONS[0].timezone,
        visitTypeSettings: [],
        templates: [],
        exceptions: [],
      }
    ),

  saveScheduleConfig: (config) => {
    configs = { ...configs, [config.providerId]: structuredClone(config) };
    writeStored(configs);
    return delay(config);
  },

  listAppointments: ({ providerId, startDate, endDate }) => {
    const out: ScheduledAppointment[] = [];
    let day = DateTime.fromISO(startDate);
    const last = DateTime.fromISO(endDate);
    while (day <= last) {
      out.push(...generateAppointmentsForDay(providerId, day.toISODate()!));
      day = day.plus({ days: 1 });
    }
    return delay(out);
  },
};

/** Restores the demo data — wired to a "Reset demo data" action while the API is mocked. */
export const resetMockProviderSchedules = (): void => {
  configs = buildMockConfigs();
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};
