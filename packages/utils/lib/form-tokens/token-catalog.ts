import { FormTokenDescriptor } from '../types/api/form-token.types';

/**
 * Every piece of encounter context a form template can be mapped to.
 *
 * Plain data, imported directly by the EHR to build the mapping UI — no zambda serves it, because an
 * administrator authoring a mapping has no patient and no encounter in scope. The matching resolvers
 * live server-side in the zambdas and are joined to these descriptors by `key`.
 *
 * The starter set was chosen by inventorying the fields of real forms rather than by guessing. Across a
 * sample of medical release, prior-authorisation, workers-comp and DOT examination forms, the concepts
 * that recurred in every single one were address parts, dates, patient name and phone — which is why
 * those are decomposed to the finest useful grain here. Roughly half the fields on a typical form ask
 * for form-specific clinical content that no chart token will ever supply; that is expected, and a
 * partially mapped form is still a large saving over an empty one.
 *
 * Labels are deliberately bare — `Name`, `City` — because every surface that shows one also shows its
 * group. A label that repeats its own group reads as "Facility - Facility city".
 *
 * Growing this list is safe and expected. Removing from it is not — see `FormTokenDescriptor.key`.
 */
export const TOKEN_CATALOG: readonly FormTokenDescriptor[] = Object.freeze([
  // ── Patient ───────────────────────────────────────────────────────────────
  { key: 'patient.firstName', label: 'First name', group: 'Patient', type: 'string' },
  { key: 'patient.middleName', label: 'Middle name', group: 'Patient', type: 'string' },
  { key: 'patient.lastName', label: 'Last name', group: 'Patient', type: 'string' },
  {
    key: 'patient.fullName',
    label: 'Full name',
    group: 'Patient',
    type: 'string',
    description: 'First and last name together, for forms with a single name field.',
  },
  { key: 'patient.dateOfBirth', label: 'Date of birth', group: 'Patient', type: 'date' },
  { key: 'patient.sex', label: 'Sex', group: 'Patient', type: 'string' },
  { key: 'patient.addressLine1', label: 'Street address', group: 'Patient', type: 'string' },
  { key: 'patient.addressLine2', label: 'Street address line 2', group: 'Patient', type: 'string' },
  { key: 'patient.city', label: 'City', group: 'Patient', type: 'string' },
  { key: 'patient.state', label: 'State', group: 'Patient', type: 'string' },
  { key: 'patient.postalCode', label: 'ZIP code', group: 'Patient', type: 'string' },
  { key: 'patient.phone', label: 'Phone number', group: 'Patient', type: 'string' },
  { key: 'patient.email', label: 'Email address', group: 'Patient', type: 'string' },
  {
    key: 'patient.recordNumber',
    label: 'Medical record number',
    group: 'Patient',
    type: 'string',
    description: 'The patient identifier used in this system.',
  },

  // ── Visit ─────────────────────────────────────────────────────────────────
  {
    key: 'visit.date',
    label: 'Date of service',
    group: 'Visit',
    type: 'date',
    description: 'The date of the appointment this form is being filled out for.',
  },
  { key: 'visit.reasonForVisit', label: 'Reason for visit', group: 'Visit', type: 'string' },
  { key: 'visit.chiefComplaint', label: 'Chief complaint', group: 'Visit', type: 'string' },

  // ── Provider ──────────────────────────────────────────────────────────────
  // Decomposed for the same reason the patient's name is: forms routinely give first and last their own
  // boxes, and splitting a joined string back apart is guesswork we should not be doing.
  { key: 'provider.firstName', label: 'First name', group: 'Provider', type: 'string' },
  { key: 'provider.middleName', label: 'Middle name', group: 'Provider', type: 'string' },
  { key: 'provider.lastName', label: 'Last name', group: 'Provider', type: 'string' },
  {
    key: 'provider.fullName',
    label: 'Full name',
    group: 'Provider',
    type: 'string',
    description: 'First and last name together, for forms with a single name field.',
  },
  {
    key: 'provider.credentials',
    label: 'Credentials',
    group: 'Provider',
    type: 'string',
    description: 'Letters following the name, such as MD or NP.',
  },
  { key: 'provider.npi', label: 'NPI', group: 'Provider', type: 'string' },

  // ── Facility ──────────────────────────────────────────────────────────────
  { key: 'facility.name', label: 'Name', group: 'Facility', type: 'string' },
  { key: 'facility.addressLine1', label: 'Street address', group: 'Facility', type: 'string' },
  { key: 'facility.city', label: 'City', group: 'Facility', type: 'string' },
  { key: 'facility.state', label: 'State', group: 'Facility', type: 'string' },
  { key: 'facility.postalCode', label: 'ZIP code', group: 'Facility', type: 'string' },
  { key: 'facility.phone', label: 'Phone number', group: 'Facility', type: 'string' },

  // ── Insurance ─────────────────────────────────────────────────────────────
  // Primary and secondary are separate tokens because forms ask for them in separate boxes — the CA
  // prior-authorisation form has "Primary Insurance Name" and "Secondary Insurance Name" with a patient
  // ID apiece — and a single "insurance" token cannot say which one it means.
  { key: 'insurance.primaryPayerName', label: 'Primary company', group: 'Insurance', type: 'string' },
  { key: 'insurance.primaryMemberId', label: 'Primary member ID', group: 'Insurance', type: 'string' },
  { key: 'insurance.secondaryPayerName', label: 'Secondary company', group: 'Insurance', type: 'string' },
  { key: 'insurance.secondaryMemberId', label: 'Secondary member ID', group: 'Insurance', type: 'string' },

  // ── Vitals ────────────────────────────────────────────────────────────────
  // Units are explicit rather than following the clinic's display preference. A mapping authored today
  // would otherwise change meaning if that preference were ever flipped, silently altering every number
  // these forms carry. Both are stored canonically — weight in kg, height in cm — and converted here.
  //
  // The feet/inches split exists because forms ask for it that way: the DOT medical examination has
  // separate boxes for "height in feet (rounded down)" and "additional height in inches".
  { key: 'vitals.heightCm', label: 'Height (cm)', group: 'Vitals', type: 'number' },
  { key: 'vitals.heightInches', label: 'Height (inches)', group: 'Vitals', type: 'number' },
  { key: 'vitals.heightFeet', label: 'Height (whole feet)', group: 'Vitals', type: 'number' },
  {
    key: 'vitals.heightInchesRemainder',
    label: 'Height (inches after feet)',
    group: 'Vitals',
    type: 'number',
    description: 'The inches part of a feet-and-inches height, for forms that split the two.',
  },
  { key: 'vitals.weightKg', label: 'Weight (kg)', group: 'Vitals', type: 'number' },
  { key: 'vitals.weightLbs', label: 'Weight (lbs)', group: 'Vitals', type: 'number' },
  { key: 'vitals.temperatureC', label: 'Temperature (°C)', group: 'Vitals', type: 'number' },
  { key: 'vitals.temperatureF', label: 'Temperature (°F)', group: 'Vitals', type: 'number' },
  { key: 'vitals.pulse', label: 'Pulse', group: 'Vitals', type: 'number' },
  { key: 'vitals.bloodPressureSystolic', label: 'Blood pressure — systolic', group: 'Vitals', type: 'number' },
  { key: 'vitals.bloodPressureDiastolic', label: 'Blood pressure — diastolic', group: 'Vitals', type: 'number' },
  {
    key: 'vitals.bloodPressure',
    label: 'Blood pressure',
    group: 'Vitals',
    type: 'string',
    description: 'Both readings in one field, written as 120/80.',
  },
  { key: 'vitals.respirationRate', label: 'Respiration rate', group: 'Vitals', type: 'number' },
  { key: 'vitals.oxygenSaturation', label: 'Oxygen saturation (%)', group: 'Vitals', type: 'number' },
  { key: 'vitals.bmi', label: 'BMI', group: 'Vitals', type: 'number' },
  { key: 'vitals.lastMenstrualPeriod', label: 'Last menstrual period', group: 'Vitals', type: 'date' },

  // ── Clinical ──────────────────────────────────────────────────────────────
  { key: 'diagnosis.primaryCode', label: 'Primary diagnosis code', group: 'Clinical', type: 'string' },
  { key: 'diagnosis.primaryDisplay', label: 'Primary diagnosis', group: 'Clinical', type: 'string' },
  {
    key: 'diagnosis.allDisplays',
    label: 'All diagnoses',
    group: 'Clinical',
    type: 'string',
    description: 'Every diagnosis on the visit, comma separated.',
  },
]);

export type FormTokenKey = (typeof TOKEN_CATALOG)[number]['key'];

export const findToken = (key: string): FormTokenDescriptor | undefined =>
  TOKEN_CATALOG.find((token) => token.key === key);
