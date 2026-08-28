import { Address, ContactPoint, HumanName, Patient, Practitioner } from 'fhir/r4b';
import {
  isBloodPressureVitalObservation,
  isBMIVitalObservation,
  isHeartbeatVitalObservation,
  isHeightVitalObservation,
  isLastMenstrualPeriodVitalObservation,
  isOxygenSaturationVitalObservation,
  isRespirationRateVitalObservation,
  isTemperatureVitalObservation,
  isWeightVitalObservation,
} from 'utils/lib/fhir/vitals';
import { celsiusToFahrenheit, HeightMeasurement, kgToLbs } from 'utils/lib/helpers/vitals';
import {
  VitalsBloodPressureObservationDTO,
  VitalsObservationDTO,
} from 'utils/lib/types/api/chart-data/chart-data.types';
import { FormFillContext } from './form-fill-context';

export type { FormFillContext };

/**
 * Resolves one token against a real encounter.
 *
 * Returning `undefined` is normal, not an error: chart data is routinely absent. Callers must treat it
 * as "leave the field untouched" and never write a placeholder — a form reading `undefined` in a box is
 * worse than one with a blank.
 */
export type FormTokenResolver = (ctx: FormFillContext) => string | number | boolean | undefined;

interface HasName {
  name?: HumanName[];
}

// Accessors work off HumanName so a patient and a practitioner share one implementation rather than
// each growing its own near-copy.
const givenName = (person: HasName | undefined, index = 0): string | undefined => person?.name?.[0]?.given?.[index];
const familyName = (person: HasName | undefined): string | undefined => person?.name?.[0]?.family;
const joinedName = (person: HasName | undefined): string | undefined =>
  [givenName(person), familyName(person)].filter(Boolean).join(' ') || undefined;

const homeAddress = (patient?: Patient): Address | undefined =>
  patient?.address?.find((a) => a.use === 'home') ?? patient?.address?.[0];

const contact = (telecom: ContactPoint[] | undefined, system: 'phone' | 'email'): string | undefined =>
  telecom?.find((t) => t.system === system)?.value;

/** The practitioner attending the visit, preferring the encounter's own participant list. */
const attendingPractitioner = (ctx: FormFillContext): Practitioner | undefined => {
  const participantIds = (ctx.encounter?.participant ?? [])
    .map((p) => p.individual?.reference)
    .filter((ref): ref is string => !!ref?.startsWith('Practitioner/'))
    .map((ref) => ref.split('/')[1]);

  const practitioners = ctx.appointmentPackage?.practitioners ?? [];
  return practitioners.find((p) => p.id && participantIds.includes(p.id)) ?? practitioners[0];
};

/**
 * The newest recorded observation of one kind of vital, or undefined if none was taken.
 *
 * Vitals accumulate across a visit and arrive in no guaranteed order, and an observation saved but never
 * edited can be missing `lastUpdated` — those sort oldest, so a timestamped reading always wins.
 */
const latestVital = <T extends VitalsObservationDTO>(
  ctx: FormFillContext,
  isMatch: (observation: VitalsObservationDTO) => observation is T
): T | undefined =>
  (ctx.allChartData?.chartData?.vitalsObservations ?? [])
    .filter(isMatch)
    .reduce<T | undefined>(
      (latest, o) => (!latest || (o.lastUpdated ?? '') > (latest.lastUpdated ?? '') ? o : latest),
      undefined
    );

/** Heights are stored in centimetres however they were entered, so one measurement backs every height token. */
const latestHeight = (ctx: FormFillContext): HeightMeasurement | undefined => {
  const cm = latestVital(ctx, isHeightVitalObservation)?.value;
  return cm === undefined ? undefined : HeightMeasurement.fromCm(cm);
};

/** The most recently recorded weight in kilograms, the unit it is stored in. */
const latestWeightKg = (ctx: FormFillContext): number | undefined =>
  // A weight can be recorded as a refusal rather than a number, in which case there is nothing to write.
  latestVital(ctx, isWeightVitalObservation)?.value;

const latestBloodPressure = (ctx: FormFillContext): VitalsBloodPressureObservationDTO | undefined =>
  latestVital(ctx, isBloodPressureVitalObservation);

const diagnoses = (ctx: FormFillContext): { code: string; display: string; isPrimary: boolean }[] =>
  ctx.allChartData?.chartData?.diagnosis ?? [];

const primaryDiagnosis = (ctx: FormFillContext): { code: string; display: string } | undefined => {
  const all = diagnoses(ctx);
  return all.find((d) => d.isPrimary) ?? all[0];
};

/**
 * The server-side half of the token catalog, joined to the descriptors in `utils` by key.
 *
 * A descriptor without a resolver is a token an administrator can pick that always produces a blank
 * field, so the two halves are kept in step by a test rather than by discipline.
 */
export const TOKEN_RESOLVERS: Record<string, FormTokenResolver> = {
  // ── Patient ───────────────────────────────────────────────────────────────
  'patient.firstName': (ctx) => givenName(ctx.patient),
  'patient.middleName': (ctx) => givenName(ctx.patient, 1),
  'patient.lastName': (ctx) => familyName(ctx.patient),
  'patient.fullName': (ctx) => joinedName(ctx.patient),
  'patient.dateOfBirth': (ctx) => ctx.patient?.birthDate,
  'patient.sex': (ctx) => ctx.patient?.gender,
  'patient.addressLine1': (ctx) => homeAddress(ctx.patient)?.line?.[0],
  'patient.addressLine2': (ctx) => homeAddress(ctx.patient)?.line?.[1],
  'patient.city': (ctx) => homeAddress(ctx.patient)?.city,
  'patient.state': (ctx) => homeAddress(ctx.patient)?.state,
  'patient.postalCode': (ctx) => homeAddress(ctx.patient)?.postalCode,
  'patient.phone': (ctx) => contact(ctx.patient?.telecom, 'phone'),
  'patient.email': (ctx) => contact(ctx.patient?.telecom, 'email'),
  'patient.recordNumber': (ctx) => ctx.patient?.id,

  // ── Visit ─────────────────────────────────────────────────────────────────
  // Resolves to an ISO date; the mapping's date transform decides how it is written into the PDF.
  'visit.date': (ctx) => ctx.appointmentPackage?.appointment?.start,
  'visit.reasonForVisit': (ctx) =>
    ctx.allChartData?.chartData?.reasonForVisit?.text ?? ctx.appointmentPackage?.appointment?.description,
  'visit.chiefComplaint': (ctx) => ctx.allChartData?.chartData?.chiefComplaint?.text,

  // ── Provider ──────────────────────────────────────────────────────────────
  'provider.firstName': (ctx) => givenName(attendingPractitioner(ctx)),
  'provider.middleName': (ctx) => givenName(attendingPractitioner(ctx), 1),
  'provider.lastName': (ctx) => familyName(attendingPractitioner(ctx)),
  'provider.fullName': (ctx) => joinedName(attendingPractitioner(ctx)),
  // Credentials live in the name's suffix — "MD", "DO", "NP" — which is what a form asking for a
  // "name and degree" is after.
  'provider.credentials': (ctx) => attendingPractitioner(ctx)?.name?.[0]?.suffix?.join(' ') || undefined,
  'provider.npi': (ctx) =>
    attendingPractitioner(ctx)?.identifier?.find((id) => id.system === 'http://hl7.org/fhir/sid/us-npi')?.value,

  // ── Facility ──────────────────────────────────────────────────────────────
  'facility.name': (ctx) => ctx.appointmentPackage?.location?.name,
  'facility.addressLine1': (ctx) => ctx.appointmentPackage?.location?.address?.line?.[0],
  'facility.city': (ctx) => ctx.appointmentPackage?.location?.address?.city,
  'facility.state': (ctx) => ctx.appointmentPackage?.location?.address?.state,
  'facility.postalCode': (ctx) => ctx.appointmentPackage?.location?.address?.postalCode,
  'facility.phone': (ctx) => contact(ctx.appointmentPackage?.location?.telecom, 'phone'),

  // ── Insurance ─────────────────────────────────────────────────────────────
  // Which coverage is primary and which is secondary comes from the appointment, not from the Coverage
  // resources, so both are resolved into the context rather than read off the note input's single one.
  'insurance.primaryPayerName': (ctx) =>
    ctx.insurance?.primary?.payerName ?? ctx.appointmentPackage?.insurancePlan?.name,
  'insurance.primaryMemberId': (ctx) =>
    ctx.insurance?.primary?.coverage?.subscriberId ?? ctx.appointmentPackage?.coverage?.subscriberId,
  'insurance.secondaryPayerName': (ctx) => ctx.insurance?.secondary?.payerName,
  'insurance.secondaryMemberId': (ctx) => ctx.insurance?.secondary?.coverage?.subscriberId,

  // ── Vitals ────────────────────────────────────────────────────────────────
  // Each unit is its own token rather than one token following the clinic's display preference, so a
  // form mapped in inches keeps producing inches no matter how that preference is later changed.
  'vitals.heightCm': (ctx) => latestHeight(ctx)?.getCm(),
  'vitals.heightInches': (ctx) => latestHeight(ctx)?.getInches(),
  'vitals.heightFeet': (ctx) => latestHeight(ctx)?.getFeet(),
  'vitals.heightInchesRemainder': (ctx) => latestHeight(ctx)?.getInchRemainder(),
  'vitals.weightKg': (ctx) => latestWeightKg(ctx),
  'vitals.weightLbs': (ctx) => {
    const kg = latestWeightKg(ctx);
    return kg === undefined ? undefined : kgToLbs(kg);
  },
  // Temperature is always stored in Celsius, so Fahrenheit is a conversion rather than a second reading.
  'vitals.temperatureC': (ctx) => latestVital(ctx, isTemperatureVitalObservation)?.value,
  'vitals.temperatureF': (ctx) => {
    const celsius = latestVital(ctx, isTemperatureVitalObservation)?.value;
    return celsius === undefined ? undefined : celsiusToFahrenheit(celsius);
  },
  'vitals.pulse': (ctx) => latestVital(ctx, isHeartbeatVitalObservation)?.value,
  // Blood pressure is stored as a pair rather than a single value. Forms ask for it both ways — the DOT
  // exam has separate sitting systolic and diastolic boxes — so both halves and the pair are offered.
  'vitals.bloodPressureSystolic': (ctx) => latestBloodPressure(ctx)?.systolicPressure,
  'vitals.bloodPressureDiastolic': (ctx) => latestBloodPressure(ctx)?.diastolicPressure,
  'vitals.bloodPressure': (ctx) => {
    const reading = latestBloodPressure(ctx);
    return reading ? `${reading.systolicPressure}/${reading.diastolicPressure}` : undefined;
  },
  'vitals.respirationRate': (ctx) => latestVital(ctx, isRespirationRateVitalObservation)?.value,
  'vitals.oxygenSaturation': (ctx) => latestVital(ctx, isOxygenSaturationVitalObservation)?.value,
  'vitals.bmi': (ctx) => latestVital(ctx, isBMIVitalObservation)?.value,
  // Stored as a date string that is empty rather than absent when nothing was recorded.
  'vitals.lastMenstrualPeriod': (ctx) => latestVital(ctx, isLastMenstrualPeriodVitalObservation)?.value || undefined,

  // ── Clinical ──────────────────────────────────────────────────────────────
  'diagnosis.primaryCode': (ctx) => primaryDiagnosis(ctx)?.code,
  'diagnosis.primaryDisplay': (ctx) => primaryDiagnosis(ctx)?.display,
  'diagnosis.allDisplays': (ctx) => {
    const all = diagnoses(ctx)
      .map((d) => d.display)
      .filter(Boolean);
    return all.length > 0 ? all.join(', ') : undefined;
  },
};

export const resolveToken = (key: string, ctx: FormFillContext): string | number | boolean | undefined =>
  TOKEN_RESOLVERS[key]?.(ctx);
