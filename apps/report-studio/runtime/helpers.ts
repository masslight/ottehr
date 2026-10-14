// The data map's computed fields and link lookups, handed to the report code as `helpers`. Thin
// wrappers over the utils helpers the EHR itself uses (getInPersonVisitStatus etc.), plus a few pure
// conveniences for working on raw FHIR resources. Deep imports keep the iframe bundle lean.
import type {
  Appointment,
  CodeableConcept,
  Coding,
  Condition,
  DiagnosticReport,
  Encounter,
  FhirResource,
  Observation,
  Patient,
  PaymentNotice,
  Practitioner,
  Procedure,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  RelatedPerson,
  ServiceRequest,
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

// ---- codes ------------------------------------------------------------------------------------

/** The ICD-10 code of a diagnosis: the coding whose system names icd-10 (sid/icd-10 or icd-10-cm), else the first. */
export const icd10Code = (condition: Condition | undefined): string | undefined =>
  (condition?.code?.coding?.find((c) => c.system?.includes('icd-10')) ?? condition?.code?.coding?.[0])?.code;

/** What a visit Procedure is, from its meta tag: em (E&M level), cpt (procedure code), surgical-history, or undefined. */
export const procedureKind = (procedure: Procedure): 'em' | 'cpt' | 'surgical-history' | undefined =>
  hasTag(procedure, 'em-code')
    ? 'em'
    : hasTag(procedure, 'cpt-code')
    ? 'cpt'
    : hasTag(procedure, 'surgical-history')
    ? 'surgical-history'
    : undefined;

// Resources of a type grouped by the reference field that points at their encounter, built once per index.
const encounterGroups = new WeakMap<ResourceIndex, Map<string, Map<string, FhirResource[]>>>();
function byEncounter<T extends FhirResource>(
  idx: ResourceIndex,
  type: T['resourceType'],
  field: string
): Map<string, T[]> {
  let groups = encounterGroups.get(idx);
  if (!groups) encounterGroups.set(idx, (groups = new Map()));
  let group = groups.get(type);
  if (!group) {
    group = new Map();
    for (const resource of idx.byType[type] ?? []) {
      const reference = (resource as unknown as Record<string, { reference?: string } | undefined>)[field]?.reference;
      if (!reference) continue;
      const list = group.get(reference);
      if (list) list.push(resource);
      else group.set(reference, [resource]);
    }
    groups.set(type, group);
  }
  return group as Map<string, T[]>;
}

export interface VisitDiagnosis {
  code: string;
  display: string;
  primary: boolean;
  condition: Condition;
}

/** The visit's diagnoses in rank order (rank 1 first), one per ICD-10 code; references to missing Conditions are skipped. */
export function diagnosesOf(encounter: Encounter, idx: ResourceIndex): VisitDiagnosis[] {
  const out: VisitDiagnosis[] = [];
  const ranked = [...(encounter.diagnosis ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  for (const entry of ranked) {
    const condition = resolve<Condition>(entry.condition?.reference, idx);
    const code = icd10Code(condition);
    if (!condition || !code || out.some((d) => d.code === code)) continue;
    out.push({ code, display: displayOf(condition.code) ?? code, primary: entry.rank === 1, condition });
  }
  return out;
}

export interface VisitProcedure {
  code: string;
  display: string;
  kind: 'em' | 'cpt' | 'surgical-history' | undefined;
  procedure: Procedure;
}

/** The visit's E&M and CPT codes (Procedures with encounter → this Encounter), one per code; kind "em" first. */
export function proceduresOf(encounter: Encounter, idx: ResourceIndex): VisitProcedure[] {
  const out: VisitProcedure[] = [];
  for (const procedure of byEncounter<Procedure>(idx, 'Procedure', 'encounter').get(ref(encounter)) ?? []) {
    const code = codeOf(procedure.code);
    if (!code || out.some((p) => p.code === code)) continue;
    out.push({ code, display: displayOf(procedure.code) ?? code, kind: procedureKind(procedure), procedure });
  }
  return out.sort((a, b) => (a.kind === 'em' ? -1 : 0) - (b.kind === 'em' ? -1 : 0));
}

const LAB_CODE_SYSTEMS = ['in-house-lab-test-code', 'oystehr-lab-local-codes'];
const labCoding = (concept: CodeableConcept | undefined): Coding | undefined =>
  concept?.coding?.find((c) => LAB_CODE_SYSTEMS.some((s) => c.system?.includes(s)));
/** The test name of a lab order / result: the in-house coding's code, the external coding's display, or code.text. */
const labName = (concept: CodeableConcept | undefined): string | undefined => {
  const coding = labCoding(concept);
  return coding ? coding.display ?? coding.code : concept?.text;
};

export interface VisitLabs {
  orders: { name: string; status: string; serviceRequest: ServiceRequest }[];
  results: { name: string; abnormal: boolean; status: string; report: DiagnosticReport }[];
  abnormal: number;
}

/** Lab orders (ServiceRequests coded as lab tests, not revoked) and results (DiagnosticReports) of a visit. */
export function labResultsOf(encounter: Encounter, idx: ResourceIndex): VisitLabs {
  const key = ref(encounter);
  const orders = (byEncounter<ServiceRequest>(idx, 'ServiceRequest', 'encounter').get(key) ?? [])
    .filter((sr) => labCoding(sr.code) && sr.status !== 'revoked' && sr.status !== 'entered-in-error')
    .map((sr) => ({ name: labName(sr.code) ?? '(unnamed test)', status: sr.status, serviceRequest: sr }));
  const results = (byEncounter<DiagnosticReport>(idx, 'DiagnosticReport', 'encounter').get(key) ?? [])
    .filter((dr) => dr.status !== 'cancelled' && dr.status !== 'entered-in-error')
    .map((dr) => ({
      name: labName(dr.code) ?? '(unnamed result)',
      abnormal: hasTag(dr, 'abnormal') || hasTag(dr, 'inconclusive'),
      status: dr.status,
      report: dr,
    }));
  return { orders, results, abnormal: results.filter((r) => r.abnormal).length };
}

// ---- vitals -----------------------------------------------------------------------------------

const VITAL_TAG_PREFIX = 'vital-';
const SYSTOLIC_CODES = new Set(['8480-6', '271649006']);
const DIASTOLIC_CODES = new Set(['8462-4', '271650006']);

export interface VisitVitals {
  /** Latest temperature in °F (charted in °C unless the unit says F). */
  temperatureF?: number;
  heartRate?: number;
  respirationRate?: number;
  oxygenSaturation?: number;
  systolicBP?: number;
  diastolicBP?: number;
  weightKg?: number;
  heightCm?: number;
  /** A blood-pressure observation exists (even when it carries no component values). */
  hasBloodPressure: boolean;
  count: number;
}

const quantity = (observation: Observation | undefined): number | undefined =>
  typeof observation?.valueQuantity?.value === 'number' ? observation.valueQuantity.value : undefined;

/** The latest reading per vital out of one visit's vital-* Observations (group them by encounter first). */
export function vitalsOf(observations: Observation[]): VisitVitals {
  const latest = new Map<string, Observation>();
  for (const observation of [...observations].sort((a, b) =>
    (a.effectiveDateTime ?? '').localeCompare(b.effectiveDateTime ?? '')
  )) {
    const tag = observation.meta?.tag?.find((t) => t.code?.startsWith(VITAL_TAG_PREFIX))?.code;
    if (tag) latest.set(tag, observation);
  }
  const temperature = latest.get('vital-temperature');
  const celsius = quantity(temperature);
  const unit = (temperature?.valueQuantity?.unit ?? temperature?.valueQuantity?.code ?? '').toUpperCase();
  const bloodPressure = latest.get('vital-blood-pressure');
  const component = (codes: Set<string>): number | undefined => {
    const match = bloodPressure?.component?.find((c) => c.code?.coding?.some((coding) => codes.has(coding.code ?? '')));
    return typeof match?.valueQuantity?.value === 'number' ? match.valueQuantity.value : undefined;
  };
  return {
    temperatureF: celsius === undefined ? undefined : round(unit.startsWith('F') ? celsius : (celsius * 9) / 5 + 32, 1),
    heartRate: quantity(latest.get('vital-heartbeat')),
    respirationRate: quantity(latest.get('vital-respiration-rate')),
    oxygenSaturation: quantity(latest.get('vital-oxygen-sat')),
    systolicBP: component(SYSTOLIC_CODES),
    diastolicBP: component(DIASTOLIC_CODES),
    weightKg: quantity(latest.get('vital-weight')),
    heightCm: quantity(latest.get('vital-height')),
    hasBloodPressure: Boolean(bloodPressure),
    count: observations.length,
  };
}

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

export interface VisitTiming {
  /** ISO instants of the first time the visit entered each status (arrived falls back to ready). */
  arrived?: string;
  intake?: string;
  provider?: string;
  discharged?: string;
  completed?: string;
  /** Interval minutes; undefined when either end is missing. */
  arrivedToIntake?: number;
  intakeToProvider?: number;
  arrivedToProvider?: number;
  providerToDischarge?: number;
  /** arrived → discharged (or completed when there was no discharge). */
  total?: number;
  /** Minutes spent in the "provider" status, summed over its periods. */
  withProvider?: number;
}

/** The visit's key instants and intervals from the status timeline (Encounter.period is never used). */
export function visitTiming(appointment: Appointment, encounter: Encounter): VisitTiming {
  const history = getVisitStatusHistory(encounter, appointment);
  const first = (status: string): string | undefined => history.find((h) => h.status === status)?.period.start;
  const arrived = first('arrived') ?? first('ready');
  const intake = first('intake');
  const provider = first('provider');
  const discharged = first('discharged');
  const completed = first('completed');
  const end = discharged ?? completed;
  let withProvider: number | undefined;
  for (const entry of history) {
    const minutes = entry.status === 'provider' ? minutesBetween(entry.period.start, entry.period.end) : undefined;
    if (minutes !== undefined && minutes >= 0) withProvider = (withProvider ?? 0) + minutes;
  }
  return {
    arrived,
    intake,
    provider,
    discharged,
    completed,
    arrivedToIntake: minutesBetween(arrived, intake),
    intakeToProvider: minutesBetween(intake, provider),
    arrivedToProvider: minutesBetween(arrived, provider),
    providerToDischarge: minutesBetween(provider, end),
    total: minutesBetween(arrived, end),
    withProvider,
  };
}

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
  icd10Code,
  procedureKind,
  diagnosesOf,
  proceduresOf,
  labResultsOf,
  vitalsOf,
  visitStatus,
  visitStatusHistory,
  visitTotalMinutes,
  visitTiming,
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
