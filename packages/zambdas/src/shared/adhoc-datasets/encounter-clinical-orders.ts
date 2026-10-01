// Radiology, in-house medication, eRx and vaccine records of the ad-hoc Encounters dataset. The FHIR →
// order mapping is the app's own — the radiology orders page (parseResultsToOrder / makeRadiologyDTO /
// buildHistory), the medication orders page (buildOrderPackage / mapMedicalAdministrationToDTO), the chart's
// eRx DTO (makePrescribedMedicationDTO) and the immunization orders page
// (mapMedicationAdministrationToImmunizationOrder). This file only flattens those DTOs into dataset records.
import {
  Condition,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  FhirResource,
  MedicationAdministration,
  MedicationRequest,
  Practitioner,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import {
  getAllCptCodesFromInHouseMedication,
  getAllHcpcsCodesFromInHouseMedication,
  getMedicationFromMA,
} from 'utils/lib/fhir/medication-administration';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { MEDICATION_DISPENSABLE_DRUG_ID } from 'utils/lib/types/api/medication-administration.constants';
import { MedicationOrderStatusesType } from 'utils/lib/types/api/medication-administration.types';
import { RadiologyDTO, RadiologyOrderHistoryRow, RadiologyOrderStatus } from 'utils/lib/types/api/radiology';
import { buildOrderPackage, mapMedicalAdministrationToDTO } from '../../ehr/get-medication-orders';
import { mapMedicationAdministrationToImmunizationOrder } from '../../ehr/immunization/get-orders';
import { buildHistory, parseResultsToOrder } from '../../ehr/radiology/order-list';
import { makePrescribedMedicationDTO } from '../chart-data';
import {
  makeRadiologyDTO,
  resolveOrderingProvider,
  takeMostRecentPreliminaryReport,
  takeTheBestFinalDiagnosticReport,
} from '../radiology';

type RadiologyStudyRecord = NonNullable<AdHocEncounterRow['imagingStudies']>[number];
type DrugRecord = NonNullable<AdHocEncounterRow['drugs']>[number];
type VaccineRecord = NonNullable<AdHocEncounterRow['vaccines']>[number];
type VaccineNotGivenRecord = NonNullable<AdHocEncounterRow['vaccinesNotGiven']>[number];

// Maps one order, logging and dropping it on failure (as the tracking board does), so one malformed order
// never fails the whole report.
const mapSafely = <T>(label: string, map: () => T): T | undefined => {
  try {
    return map();
  } catch (error) {
    console.error(`[adhoc] skipping ${label}`, error);
    return undefined;
  }
};

const orNull = (value: string | undefined): string | null => value || null;

// Medication.batch.expirationDate is a FHIR dateTime and the app writes a full instant with the entry
// device's offset. An expiry is a calendar date, so take the date AS WRITTEN — converting the zone would
// move "2026-07-29T00:00:00.000+04:00" back to the 28th and report a wrong expiry.
const expiryDate = (value?: string): string | null => value?.slice(0, 10) ?? null;

const icdOf = (condition?: Condition): { icdCode: string | null; icdDisplay: string | null } => {
  const codings = condition?.code?.coding ?? [];
  const coding = codings.find((c) => c.system?.toLowerCase().includes('icd-10')) ?? codings[0];
  if (!coding?.code) return { icdCode: null, icdDisplay: null };
  return { icdCode: coding.code, icdDisplay: coding.display ?? condition?.code?.text ?? coding.code };
};

// --- Radiology -------------------------------------------------------------------------------------------

// The dataset's coarse `status` (kept stable for saved reports) from the radiology page's status.
const COARSE_RADIOLOGY_STATUS: Record<RadiologyOrderStatus, RadiologyStudyRecord['status']> = {
  [RadiologyOrderStatus.pending]: 'pending',
  [RadiologyOrderStatus.ordered]: 'pending',
  [RadiologyOrderStatus.performed]: 'performed',
  [RadiologyOrderStatus.preliminary]: 'preliminary',
  [RadiologyOrderStatus.pendingFinal]: 'preliminary',
  [RadiologyOrderStatus.final]: 'final',
  [RadiologyOrderStatus.reviewed]: 'final',
};

const historyAt = (history: RadiologyOrderHistoryRow[], status: RadiologyOrderStatus): string | null =>
  history.filter((row) => row.status === status).at(-1)?.date || null;

const radiologyRecord = (
  name: string,
  serviceRequest: ServiceRequest,
  dto: RadiologyDTO,
  history: RadiologyOrderHistoryRow[],
  detail: Pick<RadiologyStudyRecord, 'status' | 'orderStatus' | 'orderedBy' | 'stat' | 'consentObtained'>
): RadiologyStudyRecord => ({
  name,
  ...detail,
  orderedAt:
    historyAt(history, RadiologyOrderStatus.pending) ??
    historyAt(history, RadiologyOrderStatus.ordered) ??
    serviceRequest.authoredOn ??
    null,
  performedAt: historyAt(history, RadiologyOrderStatus.performed),
  preliminaryAt: historyAt(history, RadiologyOrderStatus.preliminary),
  pendingFinalAt: historyAt(history, RadiologyOrderStatus.pendingFinal),
  finalAt: historyAt(history, RadiologyOrderStatus.final),
  reviewedAt: historyAt(history, RadiologyOrderStatus.reviewed),
  cptCode: dto.cptCode ?? '',
  laterality: dto.laterality ?? null,
  external: !!dto.external,
  icdCodes: (dto.diagnoses ?? []).map((dx) => dx.code).filter(Boolean),
  performedBy: dto.performedBy?.name ?? '',
  performingOrganization: dto.performingOrganization?.name ?? '',
  safetyFlags: dto.safetyFlags ?? [],
});

/**
 * One record per radiology order of a visit. Live orders go through the radiology page's own mapper; cancelled
 * (revoked) ones, which that page no longer lists, keep their DTO and timeline from the same helpers.
 */
export const radiologyStudyRecords = ({
  serviceRequests,
  tasks,
  diagnosticReports,
  documentReferences,
  practitioners,
  encounters,
  nameOf,
}: {
  serviceRequests: ServiceRequest[];
  tasks: Task[];
  diagnosticReports: DiagnosticReport[];
  documentReferences: DocumentReference[];
  practitioners: Practitioner[];
  encounters: Encounter[];
  /** The study name as the dataset's imagingOrders list writes it, so the two stay comparable. */
  nameOf: (serviceRequest: ServiceRequest) => string;
}): RadiologyStudyRecord[] =>
  serviceRequests
    .filter((sr) => sr.status !== 'entered-in-error')
    .flatMap((serviceRequest) => {
      const name = nameOf(serviceRequest);

      if (!name) return [];

      if (serviceRequest.status !== 'revoked') {
        const order = mapSafely(`radiology order ${serviceRequest.id}`, () =>
          parseResultsToOrder(
            serviceRequest,
            tasks,
            diagnosticReports,
            practitioners,
            encounters,
            documentReferences,
            undefined
          )
        );

        if (order) {
          return [
            radiologyRecord(name, serviceRequest, order, order.history ?? [], {
              status: COARSE_RADIOLOGY_STATUS[order.status],
              orderStatus: order.status,
              orderedBy: order.providerName,
              stat: order.isStat,
              consentObtained: order.consentObtained,
            }),
          ];
        }
      }

      // Cancelled order (or one the page cannot map): the same DTO builder and timeline, no page status.
      const reports = diagnosticReports.filter(
        (dr) => dr.basedOn?.some((ref) => ref.reference === `ServiceRequest/${serviceRequest.id}`)
      );

      const preliminary = takeMostRecentPreliminaryReport(reports);
      const final = takeTheBestFinalDiagnosticReport(reports);
      const dto = makeRadiologyDTO(serviceRequest, preliminary, final);
      const encounter = encounters.find((e) => `Encounter/${e.id}` === serviceRequest.encounter?.reference);
      const orderingProvider = resolveOrderingProvider(serviceRequest, encounter, practitioners);
      const orderedBy = orderingProvider ? getFullestAvailableName(orderingProvider) ?? '' : '';
      const history = buildHistory(serviceRequest, final, preliminary, orderedBy, dto.performedBy?.name);
      const latest = history.at(-1)?.status;

      return [
        radiologyRecord(name, serviceRequest, dto, history, {
          status:
            serviceRequest.status === 'revoked' ? 'cancelled' : latest ? COARSE_RADIOLOGY_STATUS[latest] : 'pending',
          orderStatus: null,
          orderedBy,
          stat: null,
          consentObtained: null,
        }),
      ];
    });

// --- Medications -----------------------------------------------------------------------------------------

const IN_HOUSE_DRUG_STATUS: Record<MedicationOrderStatusesType, DrugRecord['status']> = {
  pending: 'pending',
  administered: 'administered',
  'administered-partly': 'partially-administered',
  'administered-not': 'not-administered',
  cancelled: 'cancelled',
};

const EMPTY_ERX_DETAIL = {
  dose: null,
  units: null,
  route: null,
  ndc: null,
  lotNumber: null,
  expirationDate: null,
  manufacturer: null,
  administeredAt: null,
  administeredBy: null,
  cptCodes: [] as string[],
  icdCode: null,
  icdDisplay: null,
  orderedAt: null,
  notGivenReason: null,
  notGivenReasonOther: null,
  administrationSite: null,
  drugInteractionSeverities: [] as DrugRecord['drugInteractionSeverities'],
  allergyInteractionCount: 0,
  interactionOverridden: false,
};

/** eRx prescription → drug record, via the chart's eRx DTO. `code` is the Medispan dispensable-drug id. */
export const erxDrugRecord = (
  request: MedicationRequest,
  practitionerById: Map<string, Practitioner>
): { record: DrugRecord; code: string | undefined } | undefined => {
  const dto = makePrescribedMedicationDTO(request);
  const name = dto.name || request.medicationCodeableConcept?.text || '';

  if (!name) return undefined;

  const prescriber = dto.provider ? practitionerById.get(dto.provider) : undefined;
  const status = dto.status && dto.status !== 'loading' ? dto.status : null;

  return {
    code: request.medicationCodeableConcept?.coding?.find((c) => c.system === MEDICATION_DISPENSABLE_DRUG_ID)?.code,
    record: {
      name,
      source: 'eRx',
      status: 'prescribed',
      orderedBy: prescriber ? getFullestAvailableName(prescriber) ?? null : null,
      instructions: orNull(dto.instructions),
      erxStatus: status,
      isRenewal: dto.isRenewal ?? false,
      ...EMPTY_ERX_DETAIL,
    },
  };
};

/**
 * In-house medication order → drug record, via the medication orders page's DTO. `resources` must hold what
 * buildOrderPackage looks up: the patient, the practitioners on the order, its MedicationRequest and the
 * administration MedicationStatement.
 */
export const inHouseDrugRecord = (
  ma: MedicationAdministration,
  resources: FhirResource[],
  conditionById: Map<string, Condition>
): DrugRecord | undefined => {
  const dto = mapSafely(`medication order ${ma.id}`, () =>
    mapMedicalAdministrationToDTO(buildOrderPackage(ma, resources))
  );

  if (!dto) return undefined;

  const name =
    dto.medicationName ||
    ma.medicationCodeableConcept?.coding?.[0]?.display ||
    ma.medicationCodeableConcept?.text ||
    '';

  if (!name) return undefined;

  const status = IN_HOUSE_DRUG_STATUS[dto.status];
  const given = status === 'administered' || status === 'partially-administered';
  // Orders written before CPT codes were stored on the order carry them only on the catalog Medication.
  const medication = getMedicationFromMA(ma);
  const orderCpts = dto.cptCodes?.map((c) => c.code);

  const catalogCpts = medication
    ? [...getAllCptCodesFromInHouseMedication(medication), ...getAllHcpcsCodesFromInHouseMedication(medication)]
    : [];

  const interactions = dto.interactions;
  const legacyGivenAt = dto.dateGiven && dto.timeGiven ? `${dto.dateGiven}T${dto.timeGiven}` : undefined;

  return {
    name,
    source: 'in-house',
    status,
    dose: dto.dose >= 0 ? dto.dose : null,
    units: orNull(dto.units),
    route: orNull(dto.route),
    ndc: orNull(dto.ndc),
    // Vial data (lot, expiry) is tied to the patient only when something was given; the contained copy may
    // still carry a stale batch after an order is flipped to not-administered.
    lotNumber: given ? orNull(dto.lotNumber) : null,
    expirationDate: given ? expiryDate(dto.expDate) : null,
    manufacturer: orNull(dto.manufacturer),
    administeredAt: given ? dto.effectiveDateTime ?? legacyGivenAt ?? null : null,
    administeredBy: given ? orNull(dto.administeredProvider) : null,
    orderedBy: dto.orderedByProvider || dto.providerCreatedTheOrder || null,
    cptCodes: Array.from(new Set((orderCpts ?? catalogCpts).filter((c): c is string => Boolean(c)))),
    ...icdOf(dto.associatedDx ? conditionById.get(dto.associatedDx) : undefined),
    instructions: orNull(dto.instructions),
    orderedAt: orNull(dto.dateTimeCreated),
    notGivenReason: orNull(dto.reason),
    notGivenReasonOther: orNull(dto.otherReason),
    administrationSite: orNull(dto.location?.name),
    drugInteractionSeverities: (interactions?.drugInteractions ?? [])
      .map((interaction) => interaction.severity)
      .filter((severity): severity is NonNullable<typeof severity> => !!severity),
    allergyInteractionCount: interactions?.allergyInteractions.length ?? 0,
    interactionOverridden: [
      ...(interactions?.drugInteractions ?? []),
      ...(interactions?.allergyInteractions ?? []),
    ].some((interaction) => !!interaction.overrideReason),
    erxStatus: null,
    isRenewal: null,
  };
};

// --- Immunizations ---------------------------------------------------------------------------------------

/** Vaccine order → a given-vaccine record or a not-given record, via the immunization orders page's DTO. */
export const vaccineOrderRecord = (
  ma: MedicationAdministration
): { given: VaccineRecord } | { notGiven: VaccineNotGivenRecord } | undefined => {
  const order = mapSafely(`vaccine order ${ma.id}`, () => mapMedicationAdministrationToImmunizationOrder(ma));

  if (!order) return undefined;

  const name =
    order.details.medication.name ||
    ma.medicationCodeableConcept?.coding?.[0]?.display ||
    ma.medicationCodeableConcept?.text ||
    '';

  if (!name) return undefined;

  const orderedAt = orNull(order.details.orderedDateTime);
  const orderedBy = orNull(order.details.orderedProvider.name);

  if (order.status === 'pending' || order.status === 'administered-not' || order.status === 'cancelled') {
    return {
      notGiven: {
        name,
        status: order.status === 'administered-not' ? 'not-administered' : order.status,
        reason: orNull(order.reason),
        orderedAt,
        orderedBy,
      },
    };
  }

  if (order.status !== 'administered' && order.status !== 'administered-partly') return undefined;

  const administration = order.administrationDetails;
  const dose = Number(order.details.dose);

  return {
    given: {
      name,
      status: order.status === 'administered' ? 'administered' : 'partially-administered',
      visDate: administration?.visGivenDate ?? null,
      lotNumber: orNull(administration?.lot),
      expirationDate: expiryDate(administration?.expDate || undefined),
      ndc: orNull(administration?.ndc),
      cvx: orNull(administration?.cvx),
      mvx: orNull(administration?.mvx),
      manufacturer: order.details.manufacturer ?? getMedicationFromMA(ma)?.manufacturer?.display ?? null,
      dose: order.details.dose !== '' && Number.isFinite(dose) ? dose : null,
      units: orNull(order.details.units),
      route: orNull(order.details.route),
      bodySite: orNull(order.details.location?.name),
      instructions: orNull(order.details.instructions),
      administeredAt: orNull(administration?.administeredDateTime),
      administeredBy: orNull(administration?.administeredProvider.name),
      orderedAt,
      orderedBy,
      cptCodes: (administration?.cptCodes ?? []).map((c) => c.code),
    },
  };
};
