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
  {
    key: 'provider.fullName',
    label: 'Name',
    group: 'Provider',
    type: 'string',
    description: 'The practitioner attending this visit.',
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
  { key: 'insurance.payerName', label: 'Company', group: 'Insurance', type: 'string' },
  { key: 'insurance.memberId', label: 'Member ID', group: 'Insurance', type: 'string' },

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
