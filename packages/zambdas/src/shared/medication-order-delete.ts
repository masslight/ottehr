import Oystehr, { BatchInputDeleteRequest, BatchInputPatchRequest } from '@oystehr/sdk';
import { FhirResource, MedicationStatement, Procedure } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { replaceOperation } from 'utils/lib/helpers/operations';
import { deleteResourceRequest } from '../ehr/delete-chart-data/helpers';

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

export async function makeOrderCptLinesDeleteRequests(
  oystehr: Oystehr,
  medicationAdministrationId: string
): Promise<BatchInputDeleteRequest[]> {
  const lines = await getAllFhirSearchPages<Procedure>(
    {
      resourceType: 'Procedure',
      params: [
        { name: 'part-of', value: `MedicationAdministration/${medicationAdministrationId}` },
        { name: '_tag', value: 'cpt-code' },
      ],
    },
    oystehr
  );
  return lines.flatMap((line) => (line.id ? [deleteResourceRequest('Procedure', line.id)] : []));
}
