import Oystehr from '@oystehr/sdk';
import {
  Appointment,
  Encounter,
  FhirResource,
  Medication,
  MedicationAdministration,
  Observation,
  Patient,
  Practitioner,
  QuestionnaireResponse,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getEncounterLocationId } from 'utils/lib/fhir/encounter';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getMedicationFromMA, getMedicationName, mapFhirToOrderStatus } from 'utils/lib/fhir/medication-administration';
import { getOrderCatalogMedicationId, parseInventoryLot } from 'utils/lib/fhir/medication-inventory';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { selectIntakeQuestionnaireResponse } from 'utils/lib/fhir/questionnaires';
import {
  getVaccineDoseFunding,
  isVfcEligibilityObservation,
  makeVfcBorrowingObservation,
  makeVfcEligibilityObservation,
  parseVfcBorrowingObservation,
  parseVfcEligibilityObservation,
  VFC_BORROWING_CATEGORY,
  VFC_BORROWING_CODE_SYSTEM,
  VFC_ELIGIBILITY_LOINC,
  VfcBorrowing,
} from 'utils/lib/fhir/vfc';
import { SELF_PAY_OPTION } from 'utils/lib/ottehr-config/value-sets';
import { VfcBorrowingRow } from 'utils/lib/types/api/config/in-house-medications';
import { ConfirmedVfcEligibility } from 'utils/lib/types/api/vfc-eligibility';
import { PATIENT_HAS_MEDICAID_URL } from 'utils/lib/types/constants';
import {
  DerivedVfcEligibility,
  deriveVfcEligibility,
  isVfcBorrowing,
  VFC_MAX_AGE_YEARS,
  VfcEligibilityCode,
  wantedFundingSource,
} from 'utils/lib/types/data/immunization/vfc';
import { getAgeInYears } from 'utils/lib/validation/helper';
import { findInventoryLotsByNumber } from './medication-inventory';

// VFC reads and writes shared by the eligibility zambda, the immunization order zambdas and the inventory
// screen. The FHIR shapes live in utils/lib/fhir/vfc.ts; this module owns the searches.

const LOINC_PARAM = `http://loinc.org|${VFC_ELIGIBILITY_LOINC}`;

/** The visit with what eligibility is worked out from: its patient and its intake paperwork. */
export interface VfcVisit {
  encounter: Encounter;
  patient: Patient;
  questionnaireResponse?: QuestionnaireResponse;
}

export async function getVfcVisit(oystehr: Oystehr, encounterId: string): Promise<VfcVisit | undefined> {
  const resources = (
    await oystehr.fhir.search<Encounter | Patient | Appointment | QuestionnaireResponse>({
      resourceType: 'Encounter',
      params: [
        { name: '_id', value: encounterId },
        { name: '_include', value: 'Encounter:patient' },
        { name: '_revinclude', value: 'QuestionnaireResponse:encounter' },
      ],
    })
  ).unbundle();
  const encounter = resources.find((resource): resource is Encounter => resource.resourceType === 'Encounter');
  const patient = resources.find((resource): resource is Patient => resource.resourceType === 'Patient');
  if (!encounter || !patient) return undefined;
  return { encounter, patient, questionnaireResponse: selectIntakeQuestionnaireResponse(resources) };
}

const paperworkAnswer = (qr: QuestionnaireResponse | undefined, page: string, linkId: string): unknown => {
  const item = qr?.item?.find((candidate) => candidate.linkId === page)?.item?.find((sub) => sub.linkId === linkId);
  const answer = item?.answer?.[0];
  return answer?.valueString ?? answer?.valueBoolean;
};

/** VFC only applies through age 18; without a birth date nothing is assumed. */
export const vfcApplies = (patient: Patient): boolean =>
  !!patient.birthDate && getAgeInYears(patient.birthDate) <= VFC_MAX_AGE_YEARS;

/** What today's paperwork says, as `deriveVfcEligibility` reads it. */
export async function deriveVisitVfcEligibility(
  oystehr: Oystehr,
  visit: VfcVisit
): Promise<DerivedVfcEligibility | undefined> {
  const qr = visit.questionnaireResponse;
  const hasMedicaid =
    visit.patient.extension?.find((extension) => extension.url === PATIENT_HAS_MEDICAID_URL)?.valueBoolean === true ||
    paperworkAnswer(qr, 'payment-option-page', 'patient-has-medicaid') === true;
  const selfPay = paperworkAnswer(qr, 'payment-option-page', 'payment-option') === SELF_PAY_OPTION;
  const coverages = (
    await oystehr.fhir.search<FhirResource>({
      resourceType: 'Coverage',
      params: [
        { name: 'patient', value: `Patient/${visit.patient.id}` },
        { name: 'status', value: 'active' },
        { name: '_count', value: '1' },
        { name: '_elements', value: 'id' },
      ],
    })
  ).unbundle();
  return deriveVfcEligibility({ hasMedicaid, selfPay, hasCoverage: coverages.length > 0 });
}

const performerName = (resources: FhirResource[], reference: string | undefined): string | undefined => {
  const id = reference?.replace('Practitioner/', '');
  const practitioner = resources.find(
    (resource): resource is Practitioner => resource.resourceType === 'Practitioner' && resource.id === id
  );
  return practitioner ? getFullestAvailableName(practitioner) : undefined;
};

/** The eligibility recorded for the visit, newest first when there are several. */
export async function getConfirmedVfcEligibility(
  oystehr: Oystehr,
  encounterId: string
): Promise<ConfirmedVfcEligibility | undefined> {
  const resources = (
    await oystehr.fhir.search<Observation | Practitioner>({
      resourceType: 'Observation',
      params: [
        { name: 'encounter', value: `Encounter/${encounterId}` },
        { name: 'code', value: LOINC_PARAM },
        { name: 'status', value: 'final' },
        { name: '_sort', value: '-date' },
        { name: '_count', value: '1' },
        { name: '_include', value: 'Observation:performer' },
      ],
    })
  ).unbundle();
  const observation = resources.find(
    (resource): resource is Observation =>
      resource.resourceType === 'Observation' && isVfcEligibilityObservation(resource)
  );
  const parsed = observation ? parseVfcEligibilityObservation(observation) : undefined;
  if (!parsed) return undefined;
  const confirmedBy = performerName(resources, parsed.performerReference);
  return { code: parsed.code, confirmedAt: parsed.confirmedAt, ...(confirmedBy ? { confirmedBy } : {}) };
}

/** Records the visit's eligibility. Earlier confirmations for the visit are superseded (status entered-in-error). */
export async function confirmVfcEligibility(
  oystehr: Oystehr,
  visit: VfcVisit,
  code: VfcEligibilityCode,
  performerReference: string
): Promise<Observation> {
  const earlier = (
    await oystehr.fhir.search<Observation>({
      resourceType: 'Observation',
      params: [
        { name: 'encounter', value: `Encounter/${visit.encounter.id}` },
        { name: 'code', value: LOINC_PARAM },
        { name: 'status', value: 'final' },
      ],
    })
  ).unbundle();
  const created = await oystehr.fhir.create<Observation>(
    makeVfcEligibilityObservation({
      encounterId: visit.encounter.id!,
      patientId: visit.patient.id!,
      code,
      performerReference,
      effectiveDateTime: DateTime.now().toUTC().toISO(),
    })
  );
  for (const observation of earlier.filter(isVfcEligibilityObservation)) {
    await oystehr.fhir.patch<Observation>({
      resourceType: 'Observation',
      id: observation.id!,
      operations: [{ op: 'replace', path: '/status', value: 'entered-in-error' }],
    });
  }
  return created;
}

// ─── Borrowing ────────────────────────────────────────────────────────────────

/**
 * Keeps the borrowing log in step with an administration. A dose given from the other stock is logged once, with
 * the lot it came from; re-administered, its row takes the new lot, stock, eligibility and reason; cancelled, or
 * given from the right stock after all, its row is entered in error. Nothing is written when the dose's lot isn't
 * an inventory lot of the vaccine at the visit's location.
 */
export async function recordVfcBorrowing(
  oystehr: Oystehr,
  medicationAdministration: MedicationAdministration,
  performerReference: string
): Promise<void> {
  const medicationAdministrationId = medicationAdministration.id;
  if (!medicationAdministrationId) return;
  const existing = (
    await oystehr.fhir.search<Observation>({
      resourceType: 'Observation',
      params: [
        { name: 'part-of', value: `MedicationAdministration/${medicationAdministrationId}` },
        { name: 'code', value: `${VFC_BORROWING_CODE_SYSTEM}|${VFC_BORROWING_CATEGORY}` },
        { name: 'status', value: 'final' },
      ],
    })
  ).unbundle();

  const status = mapFhirToOrderStatus(medicationAdministration);
  const given = status === 'administered' || status === 'administered-partly';
  const { fundingSource, vfcEligibility, borrowingReason } = getVaccineDoseFunding(medicationAdministration);
  if (!given || !fundingSource || !vfcEligibility || !isVfcBorrowing(fundingSource, vfcEligibility)) {
    for (const observation of existing) {
      if (!observation.id) continue;
      await oystehr.fhir.patch<Observation>({
        resourceType: 'Observation',
        id: observation.id,
        operations: [{ op: 'replace', path: '/status', value: 'entered-in-error' }],
      });
    }
    return;
  }
  const patientId = medicationAdministration.subject?.reference?.replace('Patient/', '');
  const encounterId = medicationAdministration.context?.reference?.replace('Encounter/', '');
  const contained = getMedicationFromMA(medicationAdministration);
  const catalogMedicationId = getOrderCatalogMedicationId(contained);
  const lotNumber = contained?.batch?.lotNumber?.trim();
  if (!patientId || !encounterId || !catalogMedicationId || !lotNumber) return;

  const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
  const locationId = getEncounterLocationId(encounter);
  if (!locationId) return;
  const lots = await findInventoryLotsByNumber(oystehr, { catalogMedicationId, locationId, lotNumber });
  const expirationDate = contained?.batch?.expirationDate?.slice(0, 10);
  const lot =
    lots.length === 1 ? lots[0] : lots.find((candidate) => candidate.batch?.expirationDate === expirationDate);
  if (!lot?.id) return;

  const row = makeVfcBorrowingObservation({
    patientId,
    lotId: lot.id,
    locationId,
    medicationAdministrationId,
    fundingSource,
    vfcEligibility,
    reason: borrowingReason ?? '',
    performerReference,
    effectiveDateTime: DateTime.now().toUTC().toISO(),
  });
  const [current] = existing;
  if (!current) {
    await oystehr.fhir.create<Observation>(row);
    return;
  }
  const was = parseVfcBorrowingObservation(current);
  const now = parseVfcBorrowingObservation({ ...row, id: current.id });
  if (
    was &&
    now &&
    was.lotId === now.lotId &&
    was.fundingSource === now.fundingSource &&
    was.vfcEligibility === now.vfcEligibility &&
    was.reason === now.reason
  ) {
    return;
  }
  // re-administered from another lot, stock or for another reason: the row follows, keeping its date and id
  await oystehr.fhir.update<Observation>({
    ...current,
    focus: row.focus,
    performer: row.performer,
    valueCodeableConcept: row.valueCodeableConcept,
    component: row.component,
    note: row.note,
  });
}

/** Every borrowing on the log, newest first, with the names the screen shows. */
export async function listVfcBorrowings(oystehr: Oystehr): Promise<VfcBorrowingRow[]> {
  const resources = await getAllFhirSearchPages<FhirResource>(
    {
      resourceType: 'Observation',
      params: [
        { name: 'code', value: `${VFC_BORROWING_CODE_SYSTEM}|${VFC_BORROWING_CATEGORY}` },
        { name: 'status', value: 'final' },
        { name: '_sort', value: '-date' },
        { name: '_include', value: 'Observation:subject' },
        { name: '_include', value: 'Observation:focus' },
        { name: '_include', value: 'Observation:performer' },
        { name: '_include', value: 'Observation:part-of' },
        { name: '_include:iterate', value: 'MedicationAdministration:context' },
      ],
    },
    oystehr
  );
  const byRef = new Map<string, FhirResource>();
  for (const resource of resources) if (resource.id) byRef.set(`${resource.resourceType}/${resource.id}`, resource);
  return resources
    .flatMap((resource) =>
      resource.resourceType === 'Observation' ? parseVfcBorrowingObservation(resource) ?? [] : []
    )
    .map((borrowing) => toBorrowingRow(borrowing, resources, byRef));
}

export const toBorrowingRow = (
  borrowing: VfcBorrowing,
  resources: FhirResource[],
  byRef: Map<string, FhirResource>
): VfcBorrowingRow => {
  const patient = byRef.get(`Patient/${borrowing.patientId}`) as Patient | undefined;
  const lot = byRef.get(`Medication/${borrowing.lotId}`) as Medication | undefined;
  const administration = byRef.get(`MedicationAdministration/${borrowing.medicationAdministrationId}`) as
    | MedicationAdministration
    | undefined;
  const encounter = byRef.get(administration?.context?.reference ?? '') as Encounter | undefined;
  const appointmentId = encounter?.appointment?.[0]?.reference?.replace('Appointment/', '');
  const parsedLot = lot ? parseInventoryLot(lot) : undefined;
  const vaccineName =
    getMedicationName(getMedicationFromMA(administration ?? ({} as MedicationAdministration))) ??
    (lot ? getMedicationName(lot) : undefined);
  const patientName = patient ? getFullestAvailableName(patient) : undefined;
  const by = performerName(resources, borrowing.performerReference);
  const replacedBy = performerName(resources, borrowing.replaced?.performerReference);
  return {
    id: borrowing.id,
    date: borrowing.effectiveDateTime,
    ...(patientName ? { patientName } : {}),
    ...(appointmentId ? { appointmentId } : {}),
    ...(vaccineName ? { vaccineName } : {}),
    ...(parsedLot?.lotNumber ? { lotNumber: parsedLot.lotNumber } : {}),
    fundingSource: borrowing.fundingSource,
    owedTo: wantedFundingSource(borrowing.vfcEligibility),
    ...(borrowing.vfcEligibility ? { vfcEligibility: borrowing.vfcEligibility } : {}),
    reason: borrowing.reason,
    ...(by ? { performerName: by } : {}),
    ...(borrowing.replaced
      ? { replaced: { date: borrowing.replaced.date, ...(replacedBy ? { performerName: replacedBy } : {}) } }
      : {}),
  };
};
