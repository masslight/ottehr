// The data map's computed fields and link lookups, handed to the report code as `helpers`. Thin
// wrappers over the utils helpers the EHR itself uses (getInPersonVisitStatus etc.), plus a few pure
// conveniences for working on raw FHIR resources. Deep imports keep the iframe bundle lean.
import type {
  Appointment,
  CodeableConcept,
  Coding,
  Encounter,
  FhirResource,
  Patient,
  PaymentNotice,
  Practitioner,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  RelatedPerson,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { appointmentTypeForAppointment } from 'utils/lib/fhir/appointments';
import { getEncounterVisitType } from 'utils/lib/fhir/encounter';
import { isInPersonAppointment, isTelemedAppointment } from 'utils/lib/fhir/moduleIdentification';
import { getFirstName, getLastName, getMiddleName } from 'utils/lib/fhir/patient';
import { parsePaymentRefundsFromNotice, settledRefundTotalInCents } from 'utils/lib/fhir/paymentRefunds';
import { getAdmitterPractitionerId, getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { getInPersonVisitStatus, getVisitStatusHistory, getVisitTotalTime } from 'utils/lib/utils/visitUtils';

export type ResourceIndex = {
  /** Every fetched resource grouped by type: index.byType.Encounter. */
  byType: Record<string, FhirResource[]>;
  /** "Type/id" → resource. */
  byRef: Map<string, FhirResource>;
};

const WAIT_STATUSES = new Set(['arrived', 'ready']);

export const ref = (resource: { resourceType: string; id?: string }): string =>
  `${resource.resourceType}/${resource.id}`;

export const refId = (reference: string | undefined): string | undefined => reference?.split('/').pop();

export function index(...resourceLists: FhirResource[][]): ResourceIndex {
  const byType: Record<string, FhirResource[]> = {};
  const byRef = new Map<string, FhirResource>();
  for (const list of resourceLists) {
    for (const resource of list ?? []) {
      (byType[resource.resourceType] ??= []).push(resource);
      if (resource.id) byRef.set(ref(resource), resource);
    }
  }
  return { byType, byRef };
}

export const resolve = <T extends FhirResource = FhirResource>(
  reference: string | undefined,
  idx: ResourceIndex
): T | undefined => (reference ? (idx.byRef.get(reference) as T | undefined) : undefined);

/** The first participant reference of a type on an appointment ("Location/…", "Patient/…"). */
export const participantRef = (appointment: Appointment, type: string): string | undefined =>
  appointment.participant?.find((p) => p.actor?.reference?.startsWith(`${type}/`))?.actor?.reference;

/** Encounters of an appointment ("main" visit encounter first). */
export const encountersOf = (appointment: Appointment, encounters: Encounter[]): Encounter[] =>
  encounters.filter((e) => e.appointment?.[0]?.reference === ref(appointment));

export const localDay = (iso: string | undefined): string | undefined =>
  iso ? DateTime.fromISO(iso).toLocal().toISODate() ?? undefined : undefined;

export const localTime = (iso: string | undefined): string | undefined =>
  iso ? DateTime.fromISO(iso).toLocal().toFormat('HH:mm') : undefined;

export const localHour = (iso: string | undefined): number | undefined =>
  iso ? DateTime.fromISO(iso).toLocal().hour : undefined;

export const weekdayName = (iso: string | undefined): string | undefined =>
  iso ? DateTime.fromISO(iso).toLocal().toFormat('cccc') : undefined;

export const minutesBetween = (startIso: string | undefined, endIso: string | undefined): number | undefined =>
  startIso && endIso
    ? Math.round(DateTime.fromISO(endIso).diff(DateTime.fromISO(startIso), 'minutes').minutes)
    : undefined;

export const ageAt = (birthDate: string | undefined, atIso?: string): number | undefined =>
  birthDate
    ? Math.floor((atIso ? DateTime.fromISO(atIso) : DateTime.now()).diff(DateTime.fromISO(birthDate), 'years').years)
    : undefined;

export const fullName = (individual: Patient | Practitioner | RelatedPerson | undefined): string =>
  individual?.name?.[0]
    ? [getFirstName(individual), getMiddleName(individual), getLastName(individual)].filter(Boolean).join(' ')
    : '';

export const codings = (concept: CodeableConcept | undefined, system?: string): Coding[] =>
  (concept?.coding ?? []).filter((c) => !system || c.system === system);

export const codeOf = (concept: CodeableConcept | undefined, system?: string): string | undefined =>
  codings(concept, system)[0]?.code;

export const displayOf = (concept: CodeableConcept | undefined, system?: string): string | undefined =>
  codings(concept, system)[0]?.display ?? concept?.text ?? codings(concept)[0]?.code;

export const hasTag = (resource: FhirResource, code: string): boolean =>
  resource.meta?.tag?.some((t) => t.code === code) ?? false;

// ---- visits -----------------------------------------------------------------------------------

export const visitStatus = (appointment: Appointment, encounter: Encounter | undefined): string =>
  encounter
    ? getInPersonVisitStatus(appointment, encounter, true)
    : appointment.status === 'booked'
    ? 'pending'
    : appointment.status;

export const visitStatusHistory = (
  encounter: Encounter,
  appointment?: Appointment
): ReturnType<typeof getVisitStatusHistory> => getVisitStatusHistory(encounter, appointment);

export const visitTotalMinutes = (appointment: Appointment, encounter: Encounter): number =>
  getVisitTotalTime(appointment, getVisitStatusHistory(encounter, appointment), DateTime.now());

/** Minutes spent in the waiting statuses (arrived, ready) before intake began. */
export const waitMinutes = (encounter: Encounter, appointment?: Appointment): number => {
  let total = 0;
  for (const entry of getVisitStatusHistory(encounter, appointment)) {
    if (!WAIT_STATUSES.has(entry.status) || !entry.period.start) continue;
    const end = entry.period.end ? DateTime.fromISO(entry.period.end) : DateTime.now();
    total += end.diff(DateTime.fromISO(entry.period.start), 'minutes').minutes;
  }
  return Math.round(total);
};

export const attendingId = (encounter: Encounter): string | undefined => getAttendingPractitionerId(encounter);
export const admitterId = (encounter: Encounter): string | undefined => getAdmitterPractitionerId(encounter);
export const encounterVisitType = (encounter: Encounter): string => getEncounterVisitType(encounter);
export const isTelemed = (appointment: Appointment): boolean => isTelemedAppointment(appointment);
export const isInPerson = (appointment: Appointment): boolean => isInPersonAppointment(appointment);
export const appointmentType = (appointment: Appointment): string => appointmentTypeForAppointment(appointment);

// ---- billing ----------------------------------------------------------------------------------

/** A payment's amount less its settled refunds, in USD. */
export const paymentNetAmount = (notice: PaymentNotice): number =>
  (notice.amount?.value ?? 0) - settledRefundTotalInCents(parsePaymentRefundsFromNotice(notice)) / 100;

// ---- forms ------------------------------------------------------------------------------------

/** QuestionnaireResponse → { linkId: answer value | [values] } over the whole item tree. */
export function qrAnswers(response: QuestionnaireResponse): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const walk = (items: QuestionnaireResponseItem[] | undefined): void => {
    for (const item of items ?? []) {
      const values = (item.answer ?? []).map((a) => {
        const value = Object.entries(a).find(([key]) => key.startsWith('value'))?.[1];
        return value && typeof value === 'object' && 'code' in (value as object)
          ? (value as Coding).display ?? (value as Coding).code
          : value;
      });
      if (values.length) out[item.linkId] = values.length === 1 ? values[0] : values;
      walk(item.item);
    }
  };
  walk(response.item);
  return out;
}

// ---- aggregation ------------------------------------------------------------------------------

export const groupBy = <T>(items: T[], key: (item: T) => string | undefined | null): Record<string, T[]> => {
  const out: Record<string, T[]> = {};
  for (const item of items) (out[key(item) ?? 'Unknown'] ??= []).push(item);
  return out;
};

export const countBy = <T>(items: T[], key: (item: T) => string | undefined | null): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item) ?? 'Unknown';
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
};

export const sum = (values: (number | undefined | null)[]): number =>
  values.reduce<number>((acc, v) => acc + (typeof v === 'number' && Number.isFinite(v) ? v : 0), 0);

export const avg = (values: (number | undefined | null)[]): number | undefined => {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return nums.length ? sum(nums) / nums.length : undefined;
};

export const median = (values: (number | undefined | null)[]): number | undefined => {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return undefined;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

export const round = (value: number | undefined, digits = 1): number | undefined =>
  value === undefined ? undefined : Math.round(value * 10 ** digits) / 10 ** digits;

/** Every helper, as handed to the report code. The names are also documented in the planner prompt. */
export const helpers = {
  ref,
  refId,
  index,
  resolve,
  participantRef,
  encountersOf,
  localDay,
  localTime,
  localHour,
  weekdayName,
  minutesBetween,
  ageAt,
  fullName,
  codings,
  codeOf,
  displayOf,
  hasTag,
  visitStatus,
  visitStatusHistory,
  visitTotalMinutes,
  waitMinutes,
  attendingId,
  admitterId,
  encounterVisitType,
  isTelemed,
  isInPerson,
  appointmentType,
  paymentNetAmount,
  qrAnswers,
  groupBy,
  countBy,
  sum,
  avg,
  median,
  round,
};

export type ReportHelpers = typeof helpers;
