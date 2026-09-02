import Oystehr from '@oystehr/sdk';
import {
  ActivityDefinition,
  Appointment,
  DiagnosticReport,
  Encounter,
  FhirResource,
  MedicationAdministration,
  MedicationRequest,
  Observation,
  Practitioner,
  Provenance,
  Resource,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import { chunkThings } from 'utils/lib/fhir/chat';
import { ERX_MEDICATION_META_TAG_CODE, FHIR_EXTENSION, PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { getExtension } from 'utils/lib/fhir/helpers';
import { ORDER_TYPE_CODE_SYSTEM } from 'utils/lib/fhir/radiology';
import { isDeletedMedicationOrder } from 'utils/lib/helpers/order-status.helper';
import { emptyOrdersForTrackingBoardTable } from 'utils/lib/helpers/tracking-board';
import { convertVitalsListToMap, getAbnormalVitals } from 'utils/lib/helpers/vitals/utils';
import { GetVitalsForListOfEncountersResponseData } from 'utils/lib/types/api/chart-data/get-vitals.types';
import { GetAppointmentsZambdaOutput } from 'utils/lib/types/api/get-appointments.types';
import { MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE } from 'utils/lib/types/api/medication-administration.constants';
import { IN_HOUSE_TEST_CODE_SYSTEM } from 'utils/lib/types/data/in-house/in-house.constants';
import { OYSTEHR_LAB_OI_CODE_SYSTEM } from 'utils/lib/types/data/labs/labs.constants';
import { OrdersForTrackingBoardTable } from 'utils/lib/types/data/orders/types';
import {
  chartDataResourceHasMetaTagByCode,
  makePrescribedMedicationDTO,
  makeProceduresDTOFromFhirResources,
} from '../../shared/chart-data';
import { sendErrors } from '../../shared/errors';
import { SortedAppointmentQueues } from '../../shared/queueingUtils';
import {
  parseVitalsObservationsToDTOs,
  VITALS_ENCOUNTER_CHUNK_SIZE,
  vitalsObservationSearchParams,
} from '../../shared/vitals/parse-vitals-observations';
import { buildOrderPackage, mapMedicalAdministrationToDTO } from '../get-medication-orders';
import { mapResourcesNursingOrderDTOs } from '../get-nursing-orders/helpers';
import { mapMedicationAdministrationToImmunizationOrder } from '../immunization/get-orders';
import {
  fetchFinalAndPrelimAndCorrectedTasks,
  filterFinalAndPrelimAndCorrectedTasks,
  isTaskPST,
  mapResourcesToLabOrderDTOs,
} from '../lab/external/get-lab-orders/helpers';
import { mapResourcesToInHouseOrderDTOs } from '../lab/in-house/get-in-house-orders/helpers';
import { parseResultsToOrder } from '../radiology/order-list';
import { buildSearchUrl, executeBatchSearches, MAX_ENTRIES_PER_BATCH } from './batch-search';
import { isResponseSizeExceededError } from './helpers';

/**
 * Tracking board consolidation, Step B and Step C.
 *
 * Step A (the appointment search in index.ts) knows every encounter on the board. Everything the order icons and
 * abnormal-vitals badges need is keyed on those encounter ids, so it is fetched as one FHIR batch Bundle of GET
 * searches and mapped with the same DTO mappers the per-order-type zambdas use. The result is the exact shape
 * `AppointmentTable` reads, grouped by appointment or encounter, so the page needs no per-type requests.
 */

export type TrackingBoardExtras = Pick<GetAppointmentsZambdaOutput, 'orders' | 'vitals' | 'ordersAndVitalsIncomplete'>;

/** The response shape with nothing on the board, for empty days and for a failed fetch. */
export const emptyTrackingBoardExtras = (): TrackingBoardExtras => ({
  orders: emptyOrdersForTrackingBoardTable(),
  vitals: {},
});

/**
 * Encounters whose rows can carry order icons or vitals badges: every in-office row and every discharged row.
 * This is the same set the page requested per order type before the consolidation.
 */
export const selectTrackingBoardEncounterIds = (
  queues: SortedAppointmentQueues,
  apptRefToEncounterMap: Record<string, Encounter>
): string[] => {
  const appointments: Appointment[] = [
    ...queues.inOffice.waitingRoom.arrived,
    ...queues.inOffice.waitingRoom.ready,
    ...queues.inOffice.inExam.intake,
    ...queues.inOffice.inExam['ready for provider'],
    ...queues.inOffice.inExam.provider,
    ...queues.checkedOut,
  ];
  const encounterIds = new Set<string>();
  appointments.forEach((appointment) => {
    const encounterId = apptRefToEncounterMap[`Appointment/${appointment.id}`]?.id;
    if (encounterId) encounterIds.add(encounterId);
  });
  return Array.from(encounterIds);
};

// Encounter references per batch entry. Oystehr's search URL limit is 10 KB and a batch entry's URL is inline, so
// the comma list stays well under it; the aggregate response is what actually bounds these, and a size error
// halves them (see fetchTrackingBoardResources).
export const ORDER_ENCOUNTER_CHUNK_SIZE = 50;
const ORDER_SEARCH_PAGE_SIZE = 500;
const MIN_ENCOUNTER_CHUNK_SIZE = 5;
const MAX_SIZE_RETRIES = 3;

const IMMUNIZATION_TAG_CODE = 'immunization';
const NURSING_ORDER_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/order-type-tag`;
const NURSING_ORDER_TAG_CODE = 'nursing order';
const RADIOLOGY_ORDER_TAG_CODE = 'radiology';

export interface TrackingBoardChunkSizes {
  orders: number;
  vitals: number;
}

/**
 * One GET search per encounter chunk per resource family. Compared with the per-type zambdas, the ServiceRequest
 * entry drops every context include (Encounter, Appointment, Slot, Schedule, Patient, Coverage, result
 * Observations): appointment ids, timezones and attending providers come from Step A. It keeps what the status
 * mappers read: Tasks and DiagnosticReports (and, via `:iterate`, the review Tasks that hang off the reports),
 * Provenances, in-house ActivityDefinitions and requesting Practitioners.
 */
export const buildTrackingBoardSearchUrls = (
  encounterIds: string[],
  chunkSizes: TrackingBoardChunkSizes = { orders: ORDER_ENCOUNTER_CHUNK_SIZE, vitals: VITALS_ENCOUNTER_CHUNK_SIZE }
): string[] => {
  const urls: string[] = [];

  chunkThings(encounterIds, chunkSizes.orders).forEach((chunk) => {
    const encounterRefs = chunk.map((id) => `Encounter/${id}`).join(',');
    urls.push(
      buildSearchUrl('ServiceRequest', [
        { name: 'encounter', value: encounterRefs },
        // "revoked" orders are soft-deleted across every order type.
        { name: 'status:not', value: 'revoked' },
        { name: '_count', value: ORDER_SEARCH_PAGE_SIZE },
        { name: '_revinclude', value: 'Task:based-on' },
        { name: '_revinclude', value: 'DiagnosticReport:based-on' },
        { name: '_revinclude:iterate', value: 'Task:based-on' },
        { name: '_revinclude', value: 'Provenance:target' },
        { name: '_include', value: 'ServiceRequest:instantiates-canonical' },
        { name: '_include', value: 'ServiceRequest:requester' },
      ])
    );
    urls.push(
      buildSearchUrl('MedicationAdministration', [
        { name: 'context', value: encounterRefs },
        { name: '_tag', value: `${MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE},${IMMUNIZATION_TAG_CODE}` },
        { name: '_count', value: ORDER_SEARCH_PAGE_SIZE },
        // The in-house medication mapper requires the patient and the ordering practitioner to be present.
        { name: '_include', value: 'MedicationAdministration:subject' },
        { name: '_include', value: 'MedicationAdministration:performer' },
      ])
    );
    urls.push(
      buildSearchUrl('MedicationRequest', [
        { name: 'encounter', value: encounterRefs },
        { name: '_tag', value: ERX_MEDICATION_META_TAG_CODE },
        { name: '_count', value: ORDER_SEARCH_PAGE_SIZE },
      ])
    );
  });

  chunkThings(encounterIds, chunkSizes.vitals).forEach((chunk) => {
    urls.push(buildSearchUrl('Observation', vitalsObservationSearchParams(chunk)));
  });

  return urls;
};

export interface TrackingBoardResources {
  resources: FhirResource[];
  failedUrls: string[];
}

const hasDiagnosticReportBasedOn = (task: Task): boolean =>
  !!task.basedOn?.some((ref) => ref.reference?.startsWith('DiagnosticReport/'));

const referencesAny = (references: { reference?: string }[] | undefined, targets: Set<string>): boolean =>
  references?.some((ref) => !!ref.reference && targets.has(ref.reference)) ?? false;

/**
 * External lab statuses need the review Tasks based on each DiagnosticReport. The batch asks for them with
 * `_revinclude:iterate`; if a server did not iterate over the revincluded reports, fall back to the search
 * get-lab-orders runs, so a status is never computed from missing Tasks. Only reports based on an external lab
 * order count: in-house lab and radiology reports never carry report-based Tasks, so their presence alone must not
 * cost the board a third hop on every tick.
 */
const withLabResultTasks = async (
  oystehr: Oystehr,
  fetched: TrackingBoardResources
): Promise<TrackingBoardResources> => {
  const externalLabOrderRefs = new Set(
    fetched.resources
      .filter((resource): resource is ServiceRequest => resource.resourceType === 'ServiceRequest')
      .filter((serviceRequest) => classifyServiceRequest(serviceRequest) === 'externalLab')
      .map((serviceRequest) => `ServiceRequest/${serviceRequest.id}`)
  );
  const externalLabReports = fetched.resources.filter(
    (resource): resource is DiagnosticReport =>
      resource.resourceType === 'DiagnosticReport' && referencesAny(resource.basedOn, externalLabOrderRefs)
  );
  if (externalLabReports.length === 0) return fetched;

  const externalLabReportRefs = new Set(externalLabReports.map((report) => `DiagnosticReport/${report.id}`));
  const hasReportTasks = fetched.resources.some(
    (resource) => resource.resourceType === 'Task' && referencesAny((resource as Task).basedOn, externalLabReportRefs)
  );
  if (hasReportTasks) return fetched;

  console.log('no result-review Tasks came back with the external lab DiagnosticReports; fetching them directly');
  const tasks = await fetchFinalAndPrelimAndCorrectedTasks(oystehr, externalLabReports);
  return { ...fetched, resources: [...fetched.resources, ...tasks] };
};

/**
 * Runs Step B: the batch of searches for the given encounters. Retries with smaller encounter chunks and fewer
 * entries per bundle when a response exceeds Oystehr's size cap. Throws only when even the smallest split fails; the
 * caller then renders the board without icons rather than failing the page.
 */
export const fetchTrackingBoardResources = async ({
  oystehr,
  encounterIds,
  fhirApiUrl,
}: {
  oystehr: Oystehr;
  encounterIds: string[];
  fhirApiUrl?: string;
}): Promise<TrackingBoardResources> => {
  if (encounterIds.length === 0) {
    return { resources: [], failedUrls: [] };
  }

  let chunkSizes: TrackingBoardChunkSizes = { orders: ORDER_ENCOUNTER_CHUNK_SIZE, vitals: VITALS_ENCOUNTER_CHUNK_SIZE };
  let maxEntriesPerBatch = MAX_ENTRIES_PER_BATCH;
  for (let attempt = 0; ; attempt++) {
    const urls = buildTrackingBoardSearchUrls(encounterIds, chunkSizes);
    const startedAt = Date.now();
    try {
      const fetched = await executeBatchSearches(oystehr, urls, { fhirApiUrl, maxEntriesPerBatch });
      console.log(
        `tracking board batch: ${urls.length} entries for ${encounterIds.length} encounters in ${
          Date.now() - startedAt
        } ms`
      );
      return await withLabResultTasks(oystehr, fetched);
    } catch (error) {
      const canShrink =
        chunkSizes.orders > MIN_ENCOUNTER_CHUNK_SIZE ||
        chunkSizes.vitals > MIN_ENCOUNTER_CHUNK_SIZE ||
        maxEntriesPerBatch > 1;
      if (!isResponseSizeExceededError(error) || !canShrink || attempt >= MAX_SIZE_RETRIES) {
        throw error;
      }
      // The cap is on a whole batch response, so smaller encounter chunks alone only help once the extra entries
      // spill into another bundle. Halve the entries per bundle too, so each retry roughly quarters the bytes any
      // one response carries.
      chunkSizes = {
        orders: Math.max(MIN_ENCOUNTER_CHUNK_SIZE, Math.ceil(chunkSizes.orders / 2)),
        vitals: Math.max(MIN_ENCOUNTER_CHUNK_SIZE, Math.ceil(chunkSizes.vitals / 2)),
      };
      maxEntriesPerBatch = Math.max(1, Math.ceil(maxEntriesPerBatch / 2));
      console.warn('tracking board batch exceeded the response size cap; retrying with a smaller split', {
        ...chunkSizes,
        maxEntriesPerBatch,
      });
    }
  }
};

export interface TrackingBoardResourcePools {
  serviceRequests: ServiceRequest[];
  tasks: Task[];
  diagnosticReports: DiagnosticReport[];
  provenances: Provenance[];
  activityDefinitions: ActivityDefinition[];
  practitioners: Practitioner[];
  medicationAdministrations: MedicationAdministration[];
  medicationRequests: MedicationRequest[];
  observations: Observation[];
  /** Every deduplicated resource, for mappers that look related resources up by id. */
  all: FhirResource[];
}

const dedupeById = <T extends Resource>(resources: T[]): T[] => {
  const seen = new Set<string>();
  return resources.filter((resource) => {
    if (!resource.id) return true;
    const key = `${resource.resourceType}/${resource.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Sorts batch results into typed pools. Entries overlap on shared resources (a requester across chunks), so dedupe. */
export const poolTrackingBoardResources = (resources: FhirResource[]): TrackingBoardResourcePools => {
  const all = dedupeById(resources);
  const ofType = <T extends FhirResource>(resourceType: T['resourceType']): T[] =>
    all.filter((resource): resource is T => resource.resourceType === resourceType);
  return {
    serviceRequests: ofType<ServiceRequest>('ServiceRequest'),
    tasks: ofType<Task>('Task'),
    diagnosticReports: ofType<DiagnosticReport>('DiagnosticReport'),
    provenances: ofType<Provenance>('Provenance'),
    activityDefinitions: ofType<ActivityDefinition>('ActivityDefinition'),
    practitioners: ofType<Practitioner>('Practitioner'),
    medicationAdministrations: ofType<MedicationAdministration>('MedicationAdministration'),
    medicationRequests: ofType<MedicationRequest>('MedicationRequest'),
    observations: ofType<Observation>('Observation'),
    all,
  };
};

export type ServiceRequestOrderType = 'externalLab' | 'inHouseLab' | 'nursing' | 'radiology' | 'procedure';

const hasMetaTag = (resource: Resource, system: string, code: string): boolean =>
  resource.meta?.tag?.some((tag) => tag.system === system && tag.code === code) ?? false;

const hasMetaTagCode = (resource: Resource, code: string): boolean =>
  resource.meta?.tag?.some((tag) => tag.code === code) ?? false;

const hasCodeInSystem = (serviceRequest: ServiceRequest, system: string): boolean =>
  serviceRequest.code?.coding?.some((coding) => coding.system === system) ?? false;

/**
 * Which order type a ServiceRequest belongs to, by the same code system or tag each per-type search filtered on.
 * Anything else (disposition follow-ups and the like) is not an order the board shows.
 */
export const classifyServiceRequest = (serviceRequest: ServiceRequest): ServiceRequestOrderType | undefined => {
  if (hasCodeInSystem(serviceRequest, OYSTEHR_LAB_OI_CODE_SYSTEM)) return 'externalLab';
  if (hasCodeInSystem(serviceRequest, IN_HOUSE_TEST_CODE_SYSTEM)) return 'inHouseLab';
  if (hasMetaTag(serviceRequest, NURSING_ORDER_TAG_SYSTEM, NURSING_ORDER_TAG_CODE)) return 'nursing';
  if (hasMetaTag(serviceRequest, ORDER_TYPE_CODE_SYSTEM, RADIOLOGY_ORDER_TAG_CODE)) return 'radiology';
  if (chartDataResourceHasMetaTagByCode(serviceRequest, 'procedure')) return 'procedure';
  return undefined;
};

const byLastUpdatedDesc = (a: Resource, b: Resource): number =>
  (b.meta?.lastUpdated ?? '').localeCompare(a.meta?.lastUpdated ?? '');

export const partitionServiceRequests = (
  serviceRequests: ServiceRequest[]
): Record<ServiceRequestOrderType, ServiceRequest[]> => {
  const partitions: Record<ServiceRequestOrderType, ServiceRequest[]> = {
    externalLab: [],
    inHouseLab: [],
    nursing: [],
    radiology: [],
    procedure: [],
  };
  serviceRequests.forEach((serviceRequest) => {
    const type = classifyServiceRequest(serviceRequest);
    if (type) partitions[type].push(serviceRequest);
  });
  // The per-type searches sorted by -_lastUpdated, which is the order the tooltips list orders in.
  (Object.keys(partitions) as ServiceRequestOrderType[]).forEach((type) => partitions[type].sort(byLastUpdatedDesc));
  return partitions;
};

const isExternalRadiologyOrder = (serviceRequest: ServiceRequest): boolean =>
  !!getExtension(serviceRequest, FHIR_EXTENSION.ServiceRequest.externalRadiologyOrder.url)?.valueBoolean;

export const groupBy = <T>(items: T[], key: (item: T) => string | undefined): Record<string, T[]> =>
  items.reduce<Record<string, T[]>>((acc, item) => {
    const groupKey = key(item) ?? '';
    (acc[groupKey] ??= []).push(item);
    return acc;
  }, {});

/** Maps one order, logging and dropping it on failure so a malformed order never blanks the board. */
const mapOrderSafely = <T>(label: string, environment: string, map: () => T): T | undefined => {
  try {
    return map();
  } catch (error) {
    console.error(`tracking board: skipping ${label}`, error);
    void sendErrors(error, environment, { zambda: 'get-appointments', trackingBoardOrder: label });
    return undefined;
  }
};

export interface BuildOrdersInput {
  encounterIds: string[];
  pools: TrackingBoardResourcePools;
  encounters: Encounter[];
  appointments: Appointment[];
  /** Step A's practitioners (encounter participants); requesters and performers from the batch are merged in. */
  practitioners: Practitioner[];
  environment: string;
}

/** Step C for orders: partition the ServiceRequests and medications, map with the existing DTO mappers, group. */
export const buildOrdersForTrackingBoard = ({
  encounterIds,
  pools,
  encounters,
  appointments,
  practitioners,
  environment,
}: BuildOrdersInput): OrdersForTrackingBoardTable => {
  const table = emptyOrdersForTrackingBoardTable();
  const searchBy = { searchBy: { field: 'encounterIds' as const, value: encounterIds } };
  const allPractitioners = dedupeById([...practitioners, ...pools.practitioners]);
  const partitions = partitionServiceRequests(pools.serviceRequests);

  // The legacy zambdas only saw Provenances targeting their own order type; some mappers pick "the" create-order
  // Provenance out of whatever they are handed, so scope the pool the same way.
  const provenancesFor = (serviceRequests: ServiceRequest[]): Provenance[] => {
    const refs = new Set(serviceRequests.map((serviceRequest) => `ServiceRequest/${serviceRequest.id}`));
    return pools.provenances.filter(
      (provenance) => provenance.target?.some((target) => target.reference && refs.has(target.reference))
    );
  };

  if (partitions.externalLab.length > 0) {
    // get-lab-orders hands its mapper the pre-submission Tasks based on the orders plus the filtered
    // result-review Tasks based on the reports.
    const reportTasks = filterFinalAndPrelimAndCorrectedTasks(pools.tasks.filter(hasDiagnosticReportBasedOn));
    const labTasks = dedupeById([...pools.tasks.filter(isTaskPST), ...reportTasks]);
    const externalLabOrders = mapResourcesToLabOrderDTOs(
      searchBy,
      partitions.externalLab,
      labTasks,
      pools.diagnosticReports,
      allPractitioners,
      encounters,
      [],
      appointments,
      provenancesFor(partitions.externalLab),
      [],
      [],
      undefined,
      [],
      {},
      undefined,
      [],
      environment
    );
    table.externalLabOrdersByAppointmentId = groupBy(externalLabOrders, (order) => order.appointmentId);
  }

  if (partitions.inHouseLab.length > 0) {
    const inHouseLabOrders = mapResourcesToInHouseOrderDTOs(
      searchBy,
      partitions.inHouseLab,
      pools.tasks,
      allPractitioners,
      encounters,
      appointments,
      provenancesFor(partitions.inHouseLab),
      pools.activityDefinitions,
      [],
      [],
      [],
      [],
      environment,
      {}
    );
    table.inHouseLabOrdersByAppointmentId = groupBy(inHouseLabOrders, (order) => order.appointmentId);
  }

  // The nursing mapper throws on the first order without a create-order Provenance, so map one order at a time.
  const nursingProvenances = provenancesFor(partitions.nursing);
  const nursingOrders = partitions.nursing.flatMap(
    (serviceRequest) =>
      mapOrderSafely(`nursing order ${serviceRequest.id}`, environment, () =>
        mapResourcesNursingOrderDTOs([serviceRequest], pools.tasks, allPractitioners, nursingProvenances, encounters, {
          field: 'encounterIds',
          value: encounterIds,
        })
      ) ?? []
  );
  table.nursingOrdersByAppointmentId = groupBy(nursingOrders, (order) => order.appointmentId);

  // External (print-only) radiology orders were filtered out of the board by the old hook; keep that, which also
  // means their result DocumentReferences never need fetching here.
  const radiologyOrders = partitions.radiology
    .filter((serviceRequest) => !isExternalRadiologyOrder(serviceRequest))
    .flatMap((serviceRequest) => {
      const order = mapOrderSafely(`radiology order ${serviceRequest.id}`, environment, () =>
        parseResultsToOrder(
          serviceRequest,
          pools.tasks,
          pools.diagnosticReports,
          allPractitioners,
          encounters,
          [],
          undefined
        )
      );
      return order ? [order] : [];
    });
  table.radiologyOrdersByAppointmentId = groupBy(radiologyOrders, (order) => order.appointmentId);

  // get-chart-data searched procedures with status=completed; the DTO builder wants the encounter for diagnoses.
  const proceduresByEncounter = groupBy(
    partitions.procedure.filter((serviceRequest) => serviceRequest.status === 'completed'),
    (serviceRequest) => serviceRequest.encounter?.reference?.replace('Encounter/', '')
  );
  Object.entries(proceduresByEncounter).forEach(([encounterId, serviceRequests]) => {
    const encounter = encounters.find((candidate) => candidate.id === encounterId);
    if (!encounter) return;
    const procedures = mapOrderSafely(`procedures for encounter ${encounterId}`, environment, () =>
      makeProceduresDTOFromFhirResources(encounter, serviceRequests)
    );
    if (procedures?.length) table.proceduresByEncounterId[encounterId] = procedures;
  });

  const inHouseMedications = pools.medicationAdministrations
    .filter((medicationAdministration) =>
      hasMetaTagCode(medicationAdministration, MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE)
    )
    .flatMap((medicationAdministration) => {
      const order = mapOrderSafely(`medication order ${medicationAdministration.id}`, environment, () =>
        mapMedicalAdministrationToDTO(buildOrderPackage(medicationAdministration, pools.all))
      );
      return order ? [order] : [];
    })
    // get-medication-orders returns cancelled orders in a separate list the board never read.
    .filter((order) => !isDeletedMedicationOrder(order));
  table.inHouseMedicationsByEncounterId = groupBy(inHouseMedications, (order) => order.encounterId);

  const immunizationOrders = pools.medicationAdministrations
    .filter((medicationAdministration) => hasMetaTagCode(medicationAdministration, IMMUNIZATION_TAG_CODE))
    .flatMap((medicationAdministration) => {
      const order = mapOrderSafely(`immunization order ${medicationAdministration.id}`, environment, () =>
        mapMedicationAdministrationToImmunizationOrder(medicationAdministration)
      );
      return order ? [order] : [];
    });
  table.immunizationOrdersByEncounterId = groupBy(immunizationOrders, (order) => order.encounterId);

  table.erxOrdersByEncounterId = groupBy(
    pools.medicationRequests.map(makePrescribedMedicationDTO),
    (order) => order.encounterId
  );

  return table;
};

/** Step C for vitals: only encounters with at least one abnormal reading, which is all the badge renders. */
export const buildVitalsForTrackingBoard = (
  pools: Pick<TrackingBoardResourcePools, 'observations' | 'practitioners'>
): GetVitalsForListOfEncountersResponseData => {
  const observationsByEncounter = groupBy(
    pools.observations,
    (observation) => observation.encounter?.reference?.replace('Encounter/', '')
  );
  const vitals: GetVitalsForListOfEncountersResponseData = {};
  Object.entries(observationsByEncounter).forEach(([encounterId, observations]) => {
    if (!encounterId) return;
    const abnormal = getAbnormalVitals(
      convertVitalsListToMap(parseVitalsObservationsToDTOs(observations, pools.practitioners))
    );
    if (Object.keys(abnormal).length > 0) vitals[encounterId] = abnormal;
  });
  return vitals;
};

export interface BuildTrackingBoardExtrasInput extends Omit<BuildOrdersInput, 'pools'> {
  fetched: TrackingBoardResources;
}

/** Turns Step B's raw resources into the `orders` and `vitals` fields of the response. */
export const buildTrackingBoardExtras = ({
  fetched,
  ...ordersInput
}: BuildTrackingBoardExtrasInput): TrackingBoardExtras => {
  const incomplete = fetched.failedUrls.length > 0;
  if (incomplete) {
    console.error(`tracking board: ${fetched.failedUrls.length} batch entries failed; icons may be incomplete`);
  }
  const pools = poolTrackingBoardResources(fetched.resources);
  return {
    orders: buildOrdersForTrackingBoard({ ...ordersInput, pools }),
    vitals: buildVitalsForTrackingBoard(pools),
    ...(incomplete ? { ordersAndVitalsIncomplete: true } : {}),
  };
};
