import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { FhirResource, MedicationAdministration, MedicationStatement, Procedure } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getCptCodesFromMA, isImmunizationOrder } from 'utils/lib/fhir/medication-administration';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { replaceOperation } from 'utils/lib/helpers/operations';
import { deleteResourceRequest } from '../ehr/delete-chart-data/helpers';
import { mapMedicationAdministrationToImmunizationOrder } from '../ehr/immunization/get-orders';

const ADMINISTERED_STATUSES: MedicationAdministration['status'][] = ['completed', 'on-hold'];

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

export async function makeOrderDeleteRequests(
  oystehr: Oystehr,
  medicationAdministration: MedicationAdministration
): Promise<{ requests: BatchInputRequest<FhirResource>[]; retainedCptCodes: string[] }> {
  const orderId = medicationAdministration.id!;
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

  const deletedLines = selectOrderCptLinesToDelete({
    orderId,
    ownLines,
    visitLines,
    visitOrders,
  });

  const cptLineRequests = deletedLines.flatMap((line) =>
    line.id ? [deleteResourceRequest('Procedure', line.id)] : []
  );

  const orderCodes = isImmunizationOrder(medicationAdministration)
    ? (
        mapMedicationAdministrationToImmunizationOrder(medicationAdministration).administrationDetails?.cptCodes ?? []
      ).map((cptCode) => cptCode.code)
    : (getCptCodesFromMA(medicationAdministration) ?? []).map((cptCode) => cptCode.code);

  return {
    requests: [...statementRequests, ...cptLineRequests],
    retainedCptCodes: selectRetainedCptCodes({
      orderCodes,
      wasAdministered: statements.length > 0,
      visitLines,
      deletedLines,
    }),
  };
}
