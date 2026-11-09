import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import {
  Encounter,
  FhirResource,
  MedicationAdministration,
  MedicationStatement,
  Procedure,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getCptCodesFromMA, isImmunizationOrder } from 'utils/lib/fhir/medication-administration';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { replaceOperation } from 'utils/lib/helpers/operations';
import { findBillingClaimForEncounter } from '../billing/payments';
import { deleteResourceRequest } from '../ehr/delete-chart-data/helpers';
import { mapMedicationAdministrationToImmunizationOrder } from '../ehr/immunization/get-orders';
import { getCandidEncounterIdFromEncounter } from './candid';
import { makeNursingOrderStatusChangeRequests } from './nursing-orders';

const ADMINISTERED_STATUSES: MedicationAdministration['status'][] = ['completed', 'on-hold'];

const codeOf = (line: Procedure): string | undefined => line.code?.coding?.[0]?.code;

const declaredVaccineCptCodes = (vaccine: MedicationAdministration): string[] =>
  (mapMedicationAdministrationToImmunizationOrder(vaccine).administrationDetails?.cptCodes ?? []).map(
    (cptCode) => cptCode.code
  );

const byAdministrationTime = (a: MedicationAdministration, b: MedicationAdministration): number =>
  (a.effectiveDateTime ?? '').localeCompare(b.effectiveDateTime ?? '') || (a.id ?? '').localeCompare(b.id ?? '');

export interface CptLineHandoff {
  line: Procedure;
  newOwnerId: string;
}

export function selectOrderCptLineChanges({
  order,
  ownLines,
  visitLines,
  visitOrders,
}: {
  order: MedicationAdministration;
  ownLines: Procedure[];
  visitLines: Procedure[];
  visitOrders: MedicationAdministration[];
}): { linesToDelete: Procedure[]; lineHandoffs: CptLineHandoff[] } {
  const ownLineIds = new Set(ownLines.map((line) => line.id));
  const activeVaccines = visitOrders
    .filter(
      (other) => other.id !== order.id && isImmunizationOrder(other) && ADMINISTERED_STATUSES.includes(other.status)
    )
    .sort(byAdministrationTime);
  const linesToDelete: Procedure[] = [];
  const lineHandoffs: CptLineHandoff[] = [];
  for (const line of ownLines) {
    const code = codeOf(line);
    const newOwner = code
      ? activeVaccines.find((vaccine) => declaredVaccineCptCodes(vaccine).includes(code))
      : undefined;
    const coveredByAnotherLine = visitLines.some((other) => !ownLineIds.has(other.id) && codeOf(other) === code);
    const firstOwnLineForCode = line === ownLines.find((own) => codeOf(own) === code);
    if (!newOwner?.id || coveredByAnotherLine || !firstOwnLineForCode) {
      linesToDelete.push(line);
    } else if (isImmunizationOrder(order)) {
      lineHandoffs.push({ line, newOwnerId: newOwner.id });
    }
  }
  return { linesToDelete, lineHandoffs };
}

export function selectRetainedCptCodes({
  orderCodes,
  wasAdministered,
  visitLines,
  deletedLines,
}: {
  orderCodes: string[];
  wasAdministered: boolean;
  visitLines: Procedure[];
  deletedLines: Procedure[];
}): string[] {
  if (!wasAdministered) return [];

  const orderCodeSet = new Set(orderCodes);
  const deletedLineIds = new Set(deletedLines.map((line) => line.id));

  const unattributedCodes = visitLines
    .filter(
      (line) =>
        !deletedLineIds.has(line.id) &&
        !line.partOf?.some((part) => part.reference?.startsWith('MedicationAdministration/'))
    )
    .map(codeOf)
    .filter((code): code is string => code !== undefined && orderCodeSet.has(code));

  return [...new Set(unattributedCodes)].sort();
}

const searchCptLines = (oystehr: Oystehr, param: { name: string; value: string }): Promise<Procedure[]> =>
  getAllFhirSearchPages<Procedure>(
    { resourceType: 'Procedure', params: [param, { name: '_tag', value: 'cpt-code' }] },
    oystehr
  );

export async function hasEncounterBillingRecord(
  oystehr: Oystehr,
  billingOystehr: Oystehr,
  encounterId: string
): Promise<boolean> {
  const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
  if (getCandidEncounterIdFromEncounter(encounter) !== undefined) return true;
  return (await findBillingClaimForEncounter(billingOystehr, encounterId)) !== undefined;
}

export async function makeOrderDeleteRequests(
  oystehr: Oystehr,
  billingOystehr: Oystehr,
  medicationAdministration: MedicationAdministration
): Promise<{
  requests: BatchInputRequest<FhirResource>[];
  retainedCptCodes: string[];
  billingReviewRequired: boolean;
}> {
  const orderReference = `MedicationAdministration/${medicationAdministration.id}`;
  const encounterReference = medicationAdministration.context?.reference;
  const [statements, ownLines, visitLines, visitOrders] = await Promise.all([
    getAllFhirSearchPages<MedicationStatement>(
      {
        resourceType: 'MedicationStatement',
        params: [{ name: 'part-of', value: orderReference }],
      },
      oystehr
    ),
    searchCptLines(oystehr, {
      name: 'part-of',
      value: orderReference,
    }),
    encounterReference
      ? searchCptLines(oystehr, {
          name: 'encounter',
          value: encounterReference,
        })
      : [],
    encounterReference
      ? getAllFhirSearchPages<MedicationAdministration>(
          {
            resourceType: 'MedicationAdministration',
            params: [{ name: 'context', value: encounterReference }],
          },
          oystehr
        )
      : [],
  ]);

  const statementRequests = statements.flatMap((statement) =>
    statement.id && statement.status !== 'entered-in-error'
      ? [
          getPatchBinary({
            resourceType: 'MedicationStatement',
            resourceId: statement.id,
            patchOperations: [replaceOperation('/status', 'entered-in-error')],
          }),
        ]
      : []
  );

  const { linesToDelete, lineHandoffs } = selectOrderCptLineChanges({
    order: medicationAdministration,
    ownLines,
    visitLines,
    visitOrders,
  });

  const cptLineRequests = [
    ...linesToDelete.flatMap((line) => (line.id ? [deleteResourceRequest('Procedure', line.id)] : [])),
    ...lineHandoffs.flatMap(({ line, newOwnerId }) =>
      line.id
        ? [
            getPatchBinary({
              resourceType: 'Procedure',
              resourceId: line.id,
              patchOperations: [replaceOperation('/partOf', [{ reference: `MedicationAdministration/${newOwnerId}` }])],
            }),
          ]
        : []
    ),
  ];

  const orderCodes = isImmunizationOrder(medicationAdministration)
    ? declaredVaccineCptCodes(medicationAdministration)
    : (getCptCodesFromMA(medicationAdministration) ?? []).map((cptCode) => cptCode.code);

  const retainedCptCodes = selectRetainedCptCodes({
    orderCodes,
    wasAdministered: statements.length > 0,
    visitLines,
    deletedLines: linesToDelete,
  });

  const encounterId = encounterReference?.replace('Encounter/', '');
  const hasPotentialBillingCptImpact = linesToDelete.length > 0 || retainedCptCodes.length > 0;
  const billingReviewRequired =
    encounterId !== undefined &&
    hasPotentialBillingCptImpact &&
    (await hasEncounterBillingRecord(oystehr, billingOystehr, encounterId));

  return {
    requests: [...statementRequests, ...cptLineRequests],
    retainedCptCodes,
    billingReviewRequired,
  };
}

export function selectPendingRecheckOrders({
  orderId,
  serviceRequests,
  tasks,
}: {
  orderId: string;
  serviceRequests: ServiceRequest[];
  tasks: Task[];
}): { serviceRequest: ServiceRequest; task: Task }[] {
  return serviceRequests
    .filter(
      (serviceRequest) =>
        serviceRequest.supportingInfo?.some((info) => info.reference === `MedicationAdministration/${orderId}`)
    )
    .flatMap((serviceRequest) => {
      const task = tasks.find(
        (candidate) => candidate.basedOn?.some((basedOn) => basedOn.reference === `ServiceRequest/${serviceRequest.id}`)
      );
      return task?.status === 'requested' ? [{ serviceRequest, task }] : [];
    });
}

export async function makePendingRecheckCancelRequests(
  oystehr: Oystehr,
  medicationAdministration: MedicationAdministration,
  practitionerId: string
): Promise<BatchInputRequest<FhirResource>[]> {
  const encounterReference = medicationAdministration.context?.reference;
  if (!encounterReference) return [];
  const nursingOrderResources = await getAllFhirSearchPages<ServiceRequest | Task>(
    {
      resourceType: 'ServiceRequest',
      params: [
        { name: 'encounter', value: encounterReference },
        { name: '_tag', value: `${PRIVATE_EXTENSION_BASE_URL}/order-type-tag|nursing order` },
        { name: '_revinclude', value: 'Task:based-on' },
      ],
    },
    oystehr
  );
  return selectPendingRecheckOrders({
    orderId: medicationAdministration.id!,
    serviceRequests: nursingOrderResources.filter(
      (resource): resource is ServiceRequest => resource.resourceType === 'ServiceRequest'
    ),
    tasks: nursingOrderResources.filter((resource): resource is Task => resource.resourceType === 'Task'),
  }).flatMap(({ serviceRequest, task }) =>
    makeNursingOrderStatusChangeRequests({ serviceRequest, task, action: 'CANCEL ORDER', practitionerId })
  );
}
