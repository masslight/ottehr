import Oystehr, { BatchInputDeleteRequest, BatchInputPatchRequest } from '@oystehr/sdk';
import { FhirResource, MedicationAdministration, MedicationStatement, Procedure } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { isImmunizationOrder } from 'utils/lib/fhir/medication-administration';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { replaceOperation } from 'utils/lib/helpers/operations';
import { deleteResourceRequest } from '../ehr/delete-chart-data/helpers';
import { mapMedicationAdministrationToImmunizationOrder } from '../ehr/immunization/get-orders';

const ADMINISTERED_STATUSES: MedicationAdministration['status'][] = ['completed', 'on-hold'];

export async function makeOrderStatementsEnteredInErrorRequests(
  oystehr: Oystehr,
  medicationAdministrationId: string
): Promise<BatchInputPatchRequest<FhirResource>[]> {
  const statements = await getAllFhirSearchPages<MedicationStatement>(
    {
      resourceType: 'MedicationStatement',
      params: [{ name: 'part-of', value: `MedicationAdministration/${medicationAdministrationId}` }],
    },
    oystehr
  );
  return statements.flatMap((statement) =>
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
}

const codeOf = (line: Procedure): string | undefined => line.code?.coding?.[0]?.code;

const isPartOf = (line: Procedure, orderId: string | undefined): boolean =>
  line.partOf?.some((part) => part.reference === `MedicationAdministration/${orderId}`) ?? false;

export function selectOrderCptLinesToDelete({
  orderId,
  ownLines,
  visitLines,
  visitOrders,
}: {
  orderId: string;
  ownLines: Procedure[];
  visitLines: Procedure[];
  visitOrders: MedicationAdministration[];
}): Procedure[] {
  const ownLineIds = new Set(ownLines.map((line) => line.id));
  const codesReliedOnByOtherVaccines = new Set(
    visitOrders
      .filter(
        (order) => order.id !== orderId && isImmunizationOrder(order) && ADMINISTERED_STATUSES.includes(order.status)
      )
      .flatMap((vaccine) =>
        (mapMedicationAdministrationToImmunizationOrder(vaccine).administrationDetails?.cptCodes ?? [])
          .map((cptCode) => cptCode.code)
          .filter((code) => !visitLines.some((line) => isPartOf(line, vaccine.id) && codeOf(line) === code))
      )
  );
  return ownLines.filter((line) => {
    const code = codeOf(line);
    if (!code || !codesReliedOnByOtherVaccines.has(code)) return true;
    const anotherLineHasCode = visitLines.some((other) => !ownLineIds.has(other.id) && codeOf(other) === code);
    return anotherLineHasCode || line !== ownLines.find((own) => codeOf(own) === code);
  });
}

const searchCptLines = (oystehr: Oystehr, param: { name: string; value: string }): Promise<Procedure[]> =>
  getAllFhirSearchPages<Procedure>(
    { resourceType: 'Procedure', params: [param, { name: '_tag', value: 'cpt-code' }] },
    oystehr
  );

export async function makeOrderCptLinesDeleteRequests(
  oystehr: Oystehr,
  medicationAdministration: MedicationAdministration
): Promise<BatchInputDeleteRequest[]> {
  const orderId = medicationAdministration.id!;
  const encounterReference = medicationAdministration.context?.reference;
  const [ownLines, visitLines, visitOrders] = await Promise.all([
    searchCptLines(oystehr, { name: 'part-of', value: `MedicationAdministration/${orderId}` }),
    encounterReference ? searchCptLines(oystehr, { name: 'encounter', value: encounterReference }) : [],
    encounterReference
      ? getAllFhirSearchPages<MedicationAdministration>(
          { resourceType: 'MedicationAdministration', params: [{ name: 'context', value: encounterReference }] },
          oystehr
        )
      : [],
  ]);
  return selectOrderCptLinesToDelete({ orderId, ownLines, visitLines, visitOrders }).flatMap((line) =>
    line.id ? [deleteResourceRequest('Procedure', line.id)] : []
  );
}
