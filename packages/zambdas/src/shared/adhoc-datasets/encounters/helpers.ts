// Helpers shared by the encounters dataset's root and layer modules.
import {
  Appointment,
  DocumentReference,
  Location,
  Observation,
  Practitioner,
  QuestionnaireResponse,
  Resource,
  Schedule,
  ServiceRequest,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { isInHouseLabServiceRequest } from 'utils/lib/helpers/in-house-labs';
import { getQuestionnaireResponseByLinkId } from 'utils/lib/helpers/paperwork/paperwork-response';
import { formatScreeningQuestionValue } from 'utils/lib/helpers/screening-questions/screening-questions-formatting.helper';
import { patientScreeningQuestionsConfig } from 'utils/lib/ottehr-config/screening-questions';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ClosureType, OVERRIDE_DATE_FORMAT } from 'utils/lib/types/common';
import { applyOverridesToDailySchedule, DOW, getScheduleExtension } from 'utils/lib/utils/scheduleUtils';
import { getVisitStatusHistory } from 'utils/lib/utils/visitUtils';

export const minutesBetween = (start?: string, end?: string): number | null => {
  if (!start || !end) return null;

  const m = Math.round(DateTime.fromISO(end).diff(DateTime.fromISO(start), 'minutes').minutes);

  return Number.isFinite(m) ? m : null;
};

export const normalizeDrugName = (display: string): string => {
  const base = display
    .split(/\s+\d/)[0]
    .trim()
    .replace(/[\s,-]+$/, '');
  return base || display.trim();
};

export const round1 = (n: number): number => Math.round(n * 10) / 10;

export const hasChartTag = (resource: Resource, code: string): boolean =>
  Boolean(resource.meta?.tag?.some((tag) => tag.code === code));

export type ChartNoteType = NonNullable<AdHocEncounterRow['chartNotes']>[number]['type'];

export const practitionerDisplayName = (p?: Practitioner): string | null => {
  const nm = `${p?.name?.[0]?.given?.[0] || ''} ${p?.name?.[0]?.family || ''}`.trim();
  return nm || null;
};

export const practitionerIdFromRef = (ref?: string): string | undefined =>
  ref?.startsWith('Practitioner/') ? ref.replace('Practitioner/', '') : undefined;

export const conditionIdFromRef = (ref?: string): string | undefined =>
  ref?.startsWith('Condition/') ? ref.replace('Condition/', '') : undefined;

export const SYSTOLIC_CODES = ['271649006', '8480-6'];
export const DIASTOLIC_CODES = ['271650006', '8462-4'];

export const VITAL_ALERT_FIELDS: Record<string, string> = {
  [VitalFieldNames.VitalTemperature]: 'temperatureF',
  [VitalFieldNames.VitalHeartbeat]: 'heartRate',
  [VitalFieldNames.VitalRespirationRate]: 'respirationRate',
  [VitalFieldNames.VitalOxygenSaturation]: 'oxygenSaturation',
  [VitalFieldNames.VitalBloodPressure]: 'bloodPressure',
  [VitalFieldNames.VitalWeight]: 'weightKg',
  [VitalFieldNames.VitalHeight]: 'heightCm',
};

// "Ask the patient" screening answers are chart-data Observations (makeObservationResource): code.text
// is the config field's fhirField; radio/select/text answers are valueString (the option's fhirValue
// or free text), yes/no answers valueBoolean, date answers valueDateTime, date ranges effectivePeriod.
export const SCREENING_FIELD_BY_CODE = new Map(patientScreeningQuestionsConfig.fields.map((f) => [f.fhirField, f]));

export const screeningAnswer = (o: Observation): { question: string; answer: string } | undefined => {
  const field = o.code?.text ? SCREENING_FIELD_BY_CODE.get(o.code.text) : undefined;

  if (!field) return undefined;

  // A date answer stays the ISO date as charted.
  if (o.valueDateTime) return { question: field.question, answer: o.valueDateTime };

  const raw =
    o.valueString ??
    o.valueBoolean ??
    (o.effectivePeriod ? [o.effectivePeriod.start ?? '', o.effectivePeriod.end ?? ''] : undefined);

  if (raw === undefined || raw === '') return undefined;

  // The chart's own formatter: option label, Yes / No, date range.
  const answer = formatScreeningQuestionValue(field.fhirField, raw);

  return answer ? { question: field.question, answer } : undefined;
};

export const isActiveOrder = (sr: ServiceRequest): boolean =>
  sr.status !== 'revoked' && sr.status !== 'entered-in-error';

export const isLabOrder = (sr: ServiceRequest): boolean =>
  Boolean(sr.code?.coding?.some((c) => c.system?.includes('oystehr-lab-local-codes'))) ||
  isInHouseLabServiceRequest(sr) ||
  Boolean(sr.meta?.tag?.some((t) => t.code === 'generic-lab-order' || t.code === 'in-house-lab' || t.code === 'lab'));

export const orderDisplay = (sr: ServiceRequest): string =>
  sr.code?.text || sr.code?.coding?.find((c) => c.display)?.display || sr.code?.coding?.[0]?.code || '';

export const SIGNED_VISIT_STATUSES = ['completed', 'awaiting supervisor approval'];

export const lastSignedAt = (history: ReturnType<typeof getVisitStatusHistory>): string | null => {
  let start: string | null = null;
  for (const entry of history) {
    if (SIGNED_VISIT_STATUSES.includes(entry.status)) start ??= entry.period.start ?? null;
    else start = null;
  }
  return start;
};

/**
 * Hours the clinic was open on the day `start` falls on, from a Schedule extension (closures and the day's
 * override applied, as slot generation applies them). 0 on a closed day; null when no schedule is set.
 */
export const openHoursOnDay = (owner: Schedule | Location, start: string, timezone: string): number | null => {
  const scheduleExtension = getScheduleExtension(owner);

  if (!scheduleExtension?.schedule) return null;

  const day = DateTime.fromISO(start).setZone(timezone);

  if (!day.isValid) return null;

  const dayKey = day.toFormat(OVERRIDE_DATE_FORMAT);

  for (const closure of scheduleExtension.closures ?? []) {
    if (closure.type === ClosureType.OneDay && closure.start === dayKey) return 0;

    if (closure.type === ClosureType.Period) {
      const from = DateTime.fromFormat(closure.start, OVERRIDE_DATE_FORMAT, { zone: timezone }).startOf('day');
      const to = DateTime.fromFormat(closure.end, OVERRIDE_DATE_FORMAT, { zone: timezone }).endOf('day');

      if (day >= from && day <= to) return 0;
    }
  }

  const { dailySchedule } = applyOverridesToDailySchedule({
    from: day,
    scheduleOverrides: scheduleExtension.scheduleOverrides ?? {},
    dailySchedule: scheduleExtension.schedule,
    timezone,
  });

  const scheduleDay = dailySchedule[day.toFormat('cccc').toLowerCase() as DOW];

  if (!scheduleDay) return null;

  if (!scheduleDay.workingDay) return 0;

  // As slot generation reads it: a close of 0 after a later opening means midnight.
  const close = scheduleDay.close === 0 && scheduleDay.open !== 0 ? 24 : scheduleDay.close;

  return Math.max(0, close - scheduleDay.open);
};

export const groupIdOf = (appointment: Appointment): string | undefined =>
  appointment.participant
    ?.find((p) => p.actor?.reference?.startsWith('HealthcareService/'))
    ?.actor?.reference?.replace('HealthcareService/', '');

export const hasDocRefTypeCode = (docRef: DocumentReference, code: string): boolean =>
  docRef.status === 'current' && Boolean(docRef.type?.coding?.some((c) => c.code === code));

// A free-text answer in the intake paperwork, the way the chart reads one (getQuestionnaireResponseByLinkId).
export const paperworkAnswer = (questionnaireResponse: QuestionnaireResponse | undefined, linkId: string): string =>
  getQuestionnaireResponseByLinkId(linkId, questionnaireResponse)?.answer?.[0]?.valueString?.trim() ?? '';

// The chart's own note DTO builder, for the visit's provider notes and addenda.
export const noteRecordBase = (note: NoteDTO): { text: string; author: string; addedAt: string | null } => ({
  text: note.text,
  author: note.authorName,
  addedAt: note.lastUpdated || null,
});

export const stripEnc = (ref?: string): string | undefined => ref?.replace('Encounter/', '');

/** Groups items by the encounter id `encOf` reads off each one. */
export const indexByEncounter = <T>(items: T[], encOf: (item: T) => string | undefined): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const encId = encOf(item);
    if (encId) map.set(encId, [...(map.get(encId) ?? []), item]);
  }
  return map;
};

/** Every vital the chart writes, by its Observation tag code (chart-data `fillMeta(field, field)`). FHIR `_tag` has no wildcard. */
export const VITAL_TAG_CODES = Object.values(VitalFieldNames).join(',');
