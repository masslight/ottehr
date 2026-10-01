import Oystehr from '@oystehr/sdk';
import {
  ActivityDefinition,
  DiagnosticReport,
  Encounter,
  FhirResource,
  Observation,
  Practitioner,
  Provenance,
  ServiceRequest,
  Specimen,
  Task,
} from 'fhir/r4b';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { DataEntryTestItem, InHouseOrderListPageItemDTO } from 'utils/lib/types/data/in-house/in-house.types';
import { LabOrderHistoryRow, LabOrderListPageDTO } from 'utils/lib/types/data/labs/labs.types';
import { NursingOrder } from 'utils/lib/types/data/orders/types';
import { partitionServiceRequests, poolTrackingBoardResources } from '../../ehr/get-appointments/tracking-board';
import { mapResourcesNursingOrderDTOs } from '../../ehr/get-nursing-orders/helpers';
import {
  filterFinalAndPrelimAndCorrectedTasks,
  mapResourcesToLabOrderDTOs,
  parseLabOrdersHistory,
} from '../../ehr/lab/external/get-lab-orders/helpers';
import { mapResourcesToInHouseOrderDTOs } from '../../ehr/lab/in-house/get-in-house-orders/helpers';
import {
  buildOrderHistory,
  getInHouseLabTestUrlAndVersionForADFromServiceRequest,
} from '../../ehr/lab/shared/in-house-labs';
import { isTaskPST, nonNonNormalTagsContained } from '../../ehr/lab/shared/labs';
import { fetchScopedResources } from '../adhoc-report';

type LabTestRecord = NonNullable<AdHocEncounterRow['labTests']>[number];
type NursingOrderRecord = NonNullable<AdHocEncounterRow['nursingOrderDetails']>[number];

export interface EncounterOrderRecords {
  labTests: LabTestRecord[];
  nursingOrders: NursingOrderRecord[];
}

const IN_HOUSE_LAB_NAME = 'In-house';

const encounterIdOf = (serviceRequest: ServiceRequest): string | undefined =>
  serviceRequest.encounter?.reference?.replace('Encounter/', '');

const refersTo = (references: { reference?: string }[] | undefined, reference: string): boolean =>
  references?.some((ref) => ref.reference === reference) ?? false;

const dedupeById = <T extends FhirResource>(resources: T[]): T[] => {
  const seen = new Set<string>();
  return resources.filter((resource) => {
    const key = `${resource.resourceType}/${resource.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Maps one order, logging and dropping it on failure so one malformed order never fails the report.
const mapSafely = <T>(label: string, map: () => T): T | undefined => {
  try {
    return map();
  } catch (error) {
    console.error(`[adhoc] skipping ${label}`, error);
    return undefined;
  }
};

const nonNormalResultsFor = (
  serviceRequest: ServiceRequest,
  reports: DiagnosticReport[]
): LabTestRecord['nonNormalResults'] => {
  const flags = new Set<LabTestRecord['nonNormalResults'][number]>();
  for (const report of reports) {
    if (report.status === 'entered-in-error' || report.status === 'cancelled') continue;
    if (!refersTo(report.basedOn, `ServiceRequest/${serviceRequest.id}`)) continue;
    for (const flag of nonNonNormalTagsContained(report) ?? []) flags.add(flag);
  }
  return Array.from(flags);
};

export const inHouseResults = (
  labDetails: DataEntryTestItem | undefined
): Pick<LabTestRecord, 'resultComponents' | 'resultValues' | 'resultInterpretations'> => {
  const out: Pick<LabTestRecord, 'resultComponents' | 'resultValues' | 'resultInterpretations'> = {
    resultComponents: [],
    resultValues: [],
    resultInterpretations: [],
  };
  for (const component of labDetails?.components.components ?? []) {
    const result = component.result;
    if (!result) continue;
    const value =
      component.dataType === 'CodeableConcept'
        ? component.valueSet.find((option) => option.code === result.entry)?.display ?? result.entry
        : component.dataType === 'Quantity' && result.entry
        ? `${result.entry} ${component.unit}`.trim()
        : result.entry;
    out.resultComponents.push(component.componentName);
    out.resultValues.push(value ?? '');
    out.resultInterpretations.push(result.interpretationCode);
  }
  return out;
};

// '-' is how the lab history writes a specimen without a collection time.
const historyDate = (date: string | undefined): string | null => (date && date !== '-' ? date : null);

const externalLabRecord = (
  order: LabOrderListPageDTO,
  serviceRequest: ServiceRequest,
  reports: DiagnosticReport[],
  history: LabOrderHistoryRow[]
): LabTestRecord => {
  // The lab order page's timeline (newest first): the latest review, and the specimen collection.
  const reviewed = history.find((row) => row.action === 'reviewed');
  const performed = history.find((row) => row.action === 'performed');

  return {
    name: order.testItem,
    kind: 'external',
    lab: order.fillerLab,
    status: order.orderStatus,
    orderedAt: order.orderAddedDate || null,
    submittedAt: order.orderSubmittedDate || null,
    resultedAt: order.lastResultReceivedDate || null,
    orderedBy: order.orderingPhysician,
    isPSC: order.isPSC,
    icdCodes: order.diagnosesDTO.map((dx) => dx.code).filter(Boolean),
    nonNormalResults: nonNormalResultsFor(serviceRequest, reports),
    resultComponents: [],
    resultValues: [],
    resultInterpretations: [],
    collectedAt: historyDate(performed?.date),
    collectedBy: performed?.performer ?? '',
    reviewedAt: historyDate(reviewed?.date),
    reviewedBy: reviewed?.performer ?? '',
  };
};

const inHouseLabRecord = (
  order: InHouseOrderListPageItemDTO,
  serviceRequest: ServiceRequest,
  provenances: Provenance[],
  reports: DiagnosticReport[],
  specimen: Specimen | undefined
): LabTestRecord => {
  // The list DTO's resultReceivedDate is the latest Task's authoredOn, which is set when the sample is
  // collected — not when the result is entered. The order history (the detail page's timeline) has the
  // result-entry Provenance and the specimen collection, so both times are read from there.
  const history = buildOrderHistory(provenances, serviceRequest, specimen);
  const resultedAt = history.filter((entry) => entry.status === 'FINAL').at(-1)?.date ?? null;
  const collected = history.find((entry) => entry.status === 'COLLECTED');

  return {
    name: order.testItemName,
    kind: 'in-house',
    lab: IN_HOUSE_LAB_NAME,
    status: order.status,
    orderedAt: order.orderAddedDate || null,
    submittedAt: null,
    resultedAt,
    orderedBy: order.orderingPhysicianFullName,
    isPSC: false,
    icdCodes: order.diagnosesDTO.map((dx) => dx.code).filter(Boolean),
    nonNormalResults: nonNormalResultsFor(serviceRequest, reports),
    ...inHouseResults(order.labDetails),
    collectedAt: collected?.date ?? null,
    collectedBy: collected?.providerName ?? '',
    // In-house results are entered by staff; there is no separate review step.
    reviewedAt: null,
    reviewedBy: '',
  };
};

const nursingOrderRecord = (order: NursingOrder): NursingOrderRecord => ({
  order: order.note,
  status: order.status,
  orderedAt: order.orderAddedDate || null,
  orderedBy: order.orderingPhysician,
});

/**
 * Loads and maps the lab and nursing orders of the given encounters, keyed by encounter id. `encounters`
 * and `practitioners` are the ones the main report search already has (the in-house mapper names the
 * attending provider as the ordering physician, as the in-house orders page does).
 */
export async function fetchEncounterOrders(
  oystehr: Oystehr,
  {
    encounters,
    practitioners,
    environment,
    includeLabs,
    includeNursing,
  }: {
    encounters: Encounter[];
    practitioners: Practitioner[];
    environment: string;
    includeLabs: boolean;
    includeNursing: boolean;
  }
): Promise<Map<string, EncounterOrderRecords>> {
  const out = new Map<string, EncounterOrderRecords>();
  const encounterRefs = encounters.filter((e) => e.id).map((e) => `Encounter/${e.id}`);
  if (!encounterRefs.length || (!includeLabs && !includeNursing)) return out;

  const recordsFor = (encounterId: string): EncounterOrderRecords => {
    let records = out.get(encounterId);
    if (!records) {
      records = { labTests: [], nursingOrders: [] };
      out.set(encounterId, records);
    }
    return records;
  };

  // The tracking board's order search (buildTrackingBoardSearchUrls), as an async-bulk job.
  const fetched = await fetchScopedResources<
    ServiceRequest | Task | DiagnosticReport | Provenance | Practitioner | Specimen
  >(oystehr, 'ServiceRequest', 'encounter', encounterRefs, [
    { name: 'status:not', value: 'revoked' },
    { name: '_revinclude', value: 'Task:based-on' },
    { name: '_revinclude', value: 'DiagnosticReport:based-on' },
    { name: '_revinclude', value: 'Provenance:target' },
    { name: '_include', value: 'ServiceRequest:requester' },
    // The specimens the lab pages read for the collection time.
    { name: '_include', value: 'ServiceRequest:specimen' },
  ]);

  const pools = poolTrackingBoardResources(fetched);
  const partitions = partitionServiceRequests(pools.serviceRequests);
  let allPractitioners = dedupeById([...practitioners, ...pools.practitioners]);
  const specimens = fetched.filter((r): r is Specimen => r.resourceType === 'Specimen');

  const specimensFor = (sr: ServiceRequest): Specimen[] =>
    specimens.filter(
      (sp) =>
        sr.specimen?.some((ref) => ref.reference === `Specimen/${sp.id}`) ||
        sp.request?.some((ref) => ref.reference === `ServiceRequest/${sr.id}`)
    );

  // Practitioners named only by a Provenance agent or a specimen collector are loaded once, by id.
  const loadMissingPractitioners = async (ids: (string | undefined)[]): Promise<void> => {
    const known = new Set(allPractitioners.map((p) => p.id));
    const missing = Array.from(new Set(ids.filter((id): id is string => !!id && !known.has(id))));

    if (!missing.length) return;

    allPractitioners = dedupeById([
      ...allPractitioners,
      ...(await fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', missing, [
        { name: '_elements', value: 'id,name' },
      ])),
    ]);
  };

  const practitionerIdOf = (ref: string | undefined): string | undefined =>
    ref?.startsWith('Practitioner/') ? ref.replace('Practitioner/', '') : undefined;

  const searchBy = {
    searchBy: { field: 'encounterIds' as const, value: encounters.map((e) => e.id).filter((id): id is string => !!id) },
  };

  const provenancesFor = (serviceRequests: ServiceRequest[]): Provenance[] => {
    const refs = new Set(serviceRequests.map((sr) => `ServiceRequest/${sr.id}`));
    return pools.provenances.filter((p) => p.target?.some((t) => t.reference && refs.has(t.reference)));
  };

  const serviceRequestById = new Map(pools.serviceRequests.map((sr) => [sr.id, sr]));

  if (includeLabs && partitions.externalLab.length) {
    // get-lab-orders hands its mapper the pre-submission Tasks plus the result-review Tasks based on the
    // reports; the review Tasks hang off the DiagnosticReports, one hop further.
    const externalRefs = new Set(partitions.externalLab.map((sr) => `ServiceRequest/${sr.id}`));

    const externalReports = pools.diagnosticReports.filter(
      (dr) => dr.basedOn?.some((ref) => ref.reference && externalRefs.has(ref.reference))
    );

    const reportTasks = filterFinalAndPrelimAndCorrectedTasks(
      await fetchScopedResources<Task>(
        oystehr,
        'Task',
        'based-on',
        externalReports.filter((dr) => dr.id).map((dr) => `DiagnosticReport/${dr.id}`)
      )
    );

    // The review is a Provenance the result Task names in relevantHistory (parseReviewProvenanceForTask).
    const reviewProvenanceIds = reportTasks
      .flatMap((task) => task.relevantHistory ?? [])
      .map((ref) => ref.reference?.split('Provenance/')[1])
      .filter((id): id is string => !!id);

    const reviewProvenances = await fetchScopedResources<Provenance>(
      oystehr,
      'Provenance',
      '_id',
      Array.from(new Set(reviewProvenanceIds))
    );

    await loadMissingPractitioners([
      ...reviewProvenances.map((p) => practitionerIdOf(p.agent?.[0]?.who?.reference)),
      ...specimens.map((sp) => practitionerIdOf(sp.collection?.collector?.reference)),
    ]);

    const labTasks = dedupeById([...pools.tasks.filter(isTaskPST), ...reportTasks]);

    const orders = mapResourcesToLabOrderDTOs({
      searchBy,
      serviceRequests: partitions.externalLab,
      tasks: labTasks,
      results: pools.diagnosticReports,
      practitioners: allPractitioners,
      encounters,
      locations: [],
      appointments: [],
      provenances: provenancesFor(partitions.externalLab),
      organizations: [],
      questionnaires: [],
      labDocuments: undefined,
      specimens: [],
      appointmentScheduleMap: {},
      communications: undefined,
      coverages: [],
      environment,
    });

    for (const order of orders) {
      const serviceRequest = serviceRequestById.get(order.serviceRequestId);
      const encounterId = serviceRequest && encounterIdOf(serviceRequest);

      if (!serviceRequest || !encounterId) continue;

      const history = parseLabOrdersHistory(
        serviceRequest,
        order.orderStatus,
        labTasks,
        pools.diagnosticReports,
        allPractitioners,
        [...provenancesFor([serviceRequest]), ...reviewProvenances],
        specimensFor(serviceRequest)
      );

      recordsFor(encounterId).labTests.push(externalLabRecord(order, serviceRequest, pools.diagnosticReports, history));
    }
  }

  if (includeLabs && partitions.inHouseLab.length) {
    // The in-house mapper resolves each order's test definition (by canonical url + version) and reads the
    // entered values from the report's result Observations.
    const definitionUrls = new Set<string>();

    for (const sr of partitions.inHouseLab) {
      const canonical = mapSafely(`in-house lab ${sr.id} definition`, () =>
        getInHouseLabTestUrlAndVersionForADFromServiceRequest(sr)
      );

      if (canonical) definitionUrls.add(canonical.url);
    }

    const inHouseRefs = new Set(partitions.inHouseLab.map((sr) => `ServiceRequest/${sr.id}`));

    const resultIds = pools.diagnosticReports
      .filter((dr) => dr.basedOn?.some((ref) => ref.reference && inHouseRefs.has(ref.reference)))
      .flatMap((dr) => dr.result ?? [])
      .map((ref) => ref.reference?.replace('Observation/', ''))
      .filter((id): id is string => !!id);

    const [activityDefinitions, observations] = await Promise.all([
      fetchScopedResources<ActivityDefinition>(oystehr, 'ActivityDefinition', 'url', Array.from(definitionUrls)),
      fetchScopedResources<Observation>(oystehr, 'Observation', '_id', Array.from(new Set(resultIds))),
    ]);

    const inHouseProvenances = provenancesFor(partitions.inHouseLab);

    const orders = mapResourcesToInHouseOrderDTOs(
      searchBy,
      partitions.inHouseLab,
      pools.tasks,
      allPractitioners,
      encounters,
      [],
      inHouseProvenances,
      activityDefinitions,
      [],
      observations,
      pools.diagnosticReports,
      [],
      environment,
      {}
    );

    for (const order of orders) {
      const serviceRequest = serviceRequestById.get(order.serviceRequestId);
      const encounterId = serviceRequest && encounterIdOf(serviceRequest);

      if (!serviceRequest || !encounterId) continue;

      recordsFor(encounterId).labTests.push(
        inHouseLabRecord(
          order,
          serviceRequest,
          provenancesFor([serviceRequest]),
          pools.diagnosticReports,
          specimensFor(serviceRequest)[0]
        )
      );
    }
  }

  if (includeNursing) {
    for (const serviceRequest of partitions.nursing) {
      const encounterId = encounterIdOf(serviceRequest);

      if (!encounterId) continue;

      // The nursing mapper throws on an order without a create-order Provenance, so map one order at a
      // time, each with only its own Provenances (the mapper takes the first create-order one it finds).
      const [order] =
        mapSafely(`nursing order ${serviceRequest.id}`, () =>
          mapResourcesNursingOrderDTOs(
            [serviceRequest],
            pools.tasks,
            allPractitioners,
            provenancesFor([serviceRequest]),
            encounters
          )
        ) ?? [];
      if (order) recordsFor(encounterId).nursingOrders.push(nursingOrderRecord(order));
    }
  }

  return out;
}
