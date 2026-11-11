import { Extension, MedicationAdministration, Observation } from 'fhir/r4b';
import {
  VACCINE_FUNDING_SOURCES,
  VaccineFundingSource,
  VFC_ELIGIBILITY_CODES,
  VfcEligibilityCode,
} from '../types/data/immunization/vfc';
import { getExtension } from './helpers';
import { ottehrCodeSystemUrl, ottehrExtensionUrl } from './systemUrls';

// FHIR shapes for VFC. Eligibility is one Observation per visit (LOINC 64994-7 "Vaccine funding program
// eligibility category", the code IIS registries take in OBX-3), valued with the HL7 v2 table 0064 code. The
// stock a dose came from and the eligibility on that day are extensions on the dose's MedicationAdministration
// (and map onto Immunization.fundingSource / programEligibility when an Immunization record is written).

export const LOINC_SYSTEM = 'http://loinc.org';
export const VFC_ELIGIBILITY_LOINC = '64994-7';
export const VFC_ELIGIBILITY_CODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0064';
export const VACCINE_FUNDING_SOURCE_SYSTEM = ottehrCodeSystemUrl('vaccine-funding-source');
const OBSERVATION_CATEGORY_SYSTEM = ottehrCodeSystemUrl('observation-category');
export const VFC_ELIGIBILITY_CATEGORY = 'vfc-eligibility';

const isEligibilityCode = (code: string | undefined): code is VfcEligibilityCode =>
  VFC_ELIGIBILITY_CODES.includes(code as VfcEligibilityCode);
const isFundingSource = (code: string | undefined): code is VaccineFundingSource =>
  VACCINE_FUNDING_SOURCES.includes(code as VaccineFundingSource);

export interface VfcEligibilityObservationInput {
  encounterId: string;
  patientId: string;
  code: VfcEligibilityCode;
  /** `Practitioner/{id}` of whoever confirmed. */
  performerReference: string;
  effectiveDateTime: string;
}

export const makeVfcEligibilityObservation = (input: VfcEligibilityObservationInput): Observation => ({
  resourceType: 'Observation',
  status: 'final',
  category: [{ coding: [{ system: OBSERVATION_CATEGORY_SYSTEM, code: VFC_ELIGIBILITY_CATEGORY }] }],
  code: {
    coding: [{ system: LOINC_SYSTEM, code: VFC_ELIGIBILITY_LOINC, display: 'Vaccine funding program eligibility category' }],
  },
  subject: { reference: `Patient/${input.patientId}` },
  encounter: { reference: `Encounter/${input.encounterId}` },
  effectiveDateTime: input.effectiveDateTime,
  performer: [{ reference: input.performerReference }],
  valueCodeableConcept: { coding: [{ system: VFC_ELIGIBILITY_CODE_SYSTEM, code: input.code }] },
});

export const isVfcEligibilityObservation = (observation: Observation): boolean =>
  observation.code?.coding?.some((coding) => coding.system === LOINC_SYSTEM && coding.code === VFC_ELIGIBILITY_LOINC) ??
  false;

export const parseVfcEligibilityObservation = (
  observation: Observation
): { code: VfcEligibilityCode; confirmedAt: string; performerReference?: string } | undefined => {
  const code = observation.valueCodeableConcept?.coding?.find(
    (coding) => coding.system === VFC_ELIGIBILITY_CODE_SYSTEM
  )?.code;
  if (!isVfcEligibilityObservation(observation) || !isEligibilityCode(code) || !observation.effectiveDateTime) {
    return undefined;
  }
  return { code, confirmedAt: observation.effectiveDateTime, performerReference: observation.performer?.[0]?.reference };
};

// ─── The dose: what stock it came from, and the eligibility that day ──────────

export const VACCINE_DOSE_FUNDING_EXTENSION_URL = ottehrExtensionUrl('vaccine-dose-funding');
const FUNDING_SOURCE = 'funding-source';
const ELIGIBILITY = 'vfc-eligibility';
const BORROWING_REASON = 'borrowing-reason';

export interface VaccineDoseFunding {
  fundingSource?: VaccineFundingSource;
  vfcEligibility?: VfcEligibilityCode;
  /** Set when the dose was borrowed from the other stock (see `isVfcBorrowing`). */
  borrowingReason?: string;
}

export const makeVaccineDoseFundingExtension = (funding: VaccineDoseFunding): Extension | undefined => {
  const details: Extension[] = [
    ...(funding.fundingSource
      ? [{ url: FUNDING_SOURCE, valueCoding: { system: VACCINE_FUNDING_SOURCE_SYSTEM, code: funding.fundingSource } }]
      : []),
    ...(funding.vfcEligibility
      ? [{ url: ELIGIBILITY, valueCoding: { system: VFC_ELIGIBILITY_CODE_SYSTEM, code: funding.vfcEligibility } }]
      : []),
    ...(funding.borrowingReason ? [{ url: BORROWING_REASON, valueString: funding.borrowingReason }] : []),
  ];
  return details.length ? { url: VACCINE_DOSE_FUNDING_EXTENSION_URL, extension: details } : undefined;
};

/** The administration with its funding details replaced (removed when `funding` has none). */
export const withVaccineDoseFunding = <T extends MedicationAdministration>(
  medicationAdministration: T,
  funding: VaccineDoseFunding
): T => {
  const extension = makeVaccineDoseFundingExtension(funding);
  const others = (medicationAdministration.extension ?? []).filter(
    (candidate) => candidate.url !== VACCINE_DOSE_FUNDING_EXTENSION_URL
  );
  const extensions = extension ? [...others, extension] : others;
  return { ...medicationAdministration, ...(extensions.length ? { extension: extensions } : { extension: undefined }) };
};

export const getVaccineDoseFunding = (medicationAdministration: MedicationAdministration): VaccineDoseFunding => {
  const root = getExtension(medicationAdministration, VACCINE_DOSE_FUNDING_EXTENSION_URL);
  if (!root) return {};
  const fundingSource = getExtension(root, FUNDING_SOURCE)?.valueCoding?.code;
  const vfcEligibility = getExtension(root, ELIGIBILITY)?.valueCoding?.code;
  const borrowingReason = getExtension(root, BORROWING_REASON)?.valueString;
  return {
    ...(isFundingSource(fundingSource) ? { fundingSource } : {}),
    ...(isEligibilityCode(vfcEligibility) ? { vfcEligibility } : {}),
    ...(borrowingReason ? { borrowingReason } : {}),
  };
};

/**
 * The same facts on a FHIR Immunization record: `programEligibility` takes the v2-0064 code and
 * `fundingSource` the FHIR value set (private, or public for VFC and state stock).
 */
export const immunizationFundingFields = (
  funding: VaccineDoseFunding
): { programEligibility?: { coding: { system: string; code: string }[] }[]; fundingSource?: { coding: { system: string; code: string }[] } } => ({
  ...(funding.vfcEligibility
    ? { programEligibility: [{ coding: [{ system: VFC_ELIGIBILITY_CODE_SYSTEM, code: funding.vfcEligibility }] }] }
    : {}),
  ...(funding.fundingSource
    ? {
        fundingSource: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/immunization-funding-source',
              code: funding.fundingSource === 'private' ? 'private' : 'public',
            },
          ],
        },
      }
    : {}),
});

// ─── Borrowing log ────────────────────────────────────────────────────────────
//
// One Observation per borrowed dose: subject is the patient, focus the lot and the location, partOf the
// administration; the value is the stock used and a component holds the eligibility. "Replaced" is an
// extension added later, so the row is never rewritten.

export const VFC_BORROWING_CATEGORY = 'vfc-borrowing';
export const VFC_BORROWING_CODE_SYSTEM = ottehrCodeSystemUrl('vfc-borrowing');
const VFC_BORROWING_REPLACED_EXTENSION_URL = ottehrExtensionUrl('vfc-borrowing-replaced');
const REPLACED_DATE = 'date';
const REPLACED_BY = 'by';

export interface VfcBorrowingInput {
  patientId: string;
  lotId: string;
  locationId: string;
  medicationAdministrationId: string;
  fundingSource: VaccineFundingSource;
  vfcEligibility: VfcEligibilityCode;
  reason: string;
  performerReference: string;
  effectiveDateTime: string;
}

export const makeVfcBorrowingObservation = (input: VfcBorrowingInput): Observation => ({
  resourceType: 'Observation',
  status: 'final',
  category: [{ coding: [{ system: OBSERVATION_CATEGORY_SYSTEM, code: VFC_BORROWING_CATEGORY }] }],
  code: { coding: [{ system: VFC_BORROWING_CODE_SYSTEM, code: VFC_BORROWING_CATEGORY }] },
  subject: { reference: `Patient/${input.patientId}` },
  focus: [{ reference: `Medication/${input.lotId}` }, { reference: `Location/${input.locationId}` }],
  partOf: [{ reference: `MedicationAdministration/${input.medicationAdministrationId}` }],
  performer: [{ reference: input.performerReference }],
  effectiveDateTime: input.effectiveDateTime,
  valueCodeableConcept: { coding: [{ system: VACCINE_FUNDING_SOURCE_SYSTEM, code: input.fundingSource }] },
  component: [
    {
      code: { coding: [{ system: LOINC_SYSTEM, code: VFC_ELIGIBILITY_LOINC }] },
      valueCodeableConcept: { coding: [{ system: VFC_ELIGIBILITY_CODE_SYSTEM, code: input.vfcEligibility }] },
    },
  ],
  note: [{ text: input.reason }],
});

export const makeVfcBorrowingReplacedExtension = (date: string, performerReference: string): Extension => ({
  url: VFC_BORROWING_REPLACED_EXTENSION_URL,
  extension: [
    { url: REPLACED_DATE, valueDateTime: date },
    { url: REPLACED_BY, valueReference: { reference: performerReference } },
  ],
});

export interface VfcBorrowing {
  id: string;
  patientId?: string;
  lotId?: string;
  locationId?: string;
  medicationAdministrationId?: string;
  fundingSource: VaccineFundingSource;
  vfcEligibility?: VfcEligibilityCode;
  reason: string;
  performerReference?: string;
  effectiveDateTime: string;
  replaced?: { date: string; performerReference?: string };
}

export const isVfcBorrowingObservation = (observation: Observation): boolean =>
  observation.code?.coding?.some(
    (coding) => coding.system === VFC_BORROWING_CODE_SYSTEM && coding.code === VFC_BORROWING_CATEGORY
  ) ?? false;

export const parseVfcBorrowingObservation = (observation: Observation): VfcBorrowing | undefined => {
  const fundingSource = observation.valueCodeableConcept?.coding?.find(
    (coding) => coding.system === VACCINE_FUNDING_SOURCE_SYSTEM
  )?.code;
  if (!observation.id || !isVfcBorrowingObservation(observation) || !isFundingSource(fundingSource)) return undefined;
  if (!observation.effectiveDateTime) return undefined;
  const eligibility = observation.component?.[0]?.valueCodeableConcept?.coding?.find(
    (coding) => coding.system === VFC_ELIGIBILITY_CODE_SYSTEM
  )?.code;
  const replaced = getExtension(observation, VFC_BORROWING_REPLACED_EXTENSION_URL);
  const replacedDate = replaced ? getExtension(replaced, REPLACED_DATE)?.valueDateTime : undefined;
  const focus = (prefix: string): string | undefined =>
    observation.focus?.find((reference) => reference.reference?.startsWith(prefix))?.reference?.replace(prefix, '');
  return {
    id: observation.id,
    patientId: observation.subject?.reference?.replace('Patient/', ''),
    lotId: focus('Medication/'),
    locationId: focus('Location/'),
    medicationAdministrationId: observation.partOf?.[0]?.reference?.replace('MedicationAdministration/', ''),
    fundingSource,
    ...(isEligibilityCode(eligibility) ? { vfcEligibility: eligibility } : {}),
    reason: observation.note?.[0]?.text ?? '',
    performerReference: observation.performer?.[0]?.reference,
    effectiveDateTime: observation.effectiveDateTime,
    ...(replacedDate
      ? {
          replaced: {
            date: replacedDate,
            performerReference: replaced ? getExtension(replaced, REPLACED_BY)?.valueReference?.reference : undefined,
          },
        }
      : {}),
  };
};
