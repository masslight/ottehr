import { Address, ContactPoint, Patient, Practitioner } from 'fhir/r4b';
import { ProgressNoteInput } from '../../shared/pdf/types';

/**
 * Everything a token can be resolved from.
 *
 * `ProgressNoteInput` already carries the raw `Patient` and `Encounter` resources, the full chart data,
 * and the appointment package (location, coverage, practitioners), so it is the whole context on its
 * own — there is no need to assemble a second projection of the encounter graph alongside it.
 */
export type FormFillContext = ProgressNoteInput;

/**
 * Resolves one token against a real encounter.
 *
 * Returning `undefined` is normal, not an error: chart data is routinely absent. Callers must treat it
 * as "leave the field untouched" and never write a placeholder — a form reading `undefined` in a box is
 * worse than one with a blank.
 */
export type FormTokenResolver = (ctx: FormFillContext) => string | number | boolean | undefined;

const firstName = (patient?: Patient): string | undefined => patient?.name?.[0]?.given?.[0];
const middleName = (patient?: Patient): string | undefined => patient?.name?.[0]?.given?.[1];
const lastName = (patient?: Patient): string | undefined => patient?.name?.[0]?.family;

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

const practitionerName = (practitioner?: Practitioner): string | undefined => {
  const name = practitioner?.name?.[0];
  if (!name) return undefined;
  return [name.given?.join(' '), name.family].filter(Boolean).join(' ') || undefined;
};

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
  'patient.firstName': (ctx) => firstName(ctx.patient),
  'patient.middleName': (ctx) => middleName(ctx.patient),
  'patient.lastName': (ctx) => lastName(ctx.patient),
  'patient.fullName': (ctx) => [firstName(ctx.patient), lastName(ctx.patient)].filter(Boolean).join(' ') || undefined,
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
  'provider.fullName': (ctx) => practitionerName(attendingPractitioner(ctx)),
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
  'insurance.payerName': (ctx) => ctx.appointmentPackage?.insurancePlan?.name,
  'insurance.memberId': (ctx) => ctx.appointmentPackage?.coverage?.subscriberId,

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
