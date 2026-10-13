import Oystehr, { BatchInputDeleteRequest, BatchInputPutRequest } from '@oystehr/sdk';
import { Appointment, DocumentReference, Encounter, FhirResource, Patient, ServiceRequest } from 'fhir/r4b';
import { getEncounterAndRelatedResources as getEncounterWithProcedureDependencies } from '../../shared/chart-data/encounter-resources';

export function deleteResourceRequest(resourceType: string, resourceId: string): BatchInputDeleteRequest {
  return { method: 'DELETE', url: `/${resourceType}/${resourceId}` };
}

export function updateResourceRequest<F extends FhirResource>(resource: F): BatchInputPutRequest<F> {
  if (!resource.id) throw new Error('A resource must have an ID in order to be updated');
  return {
    method: 'PUT',
    url: `/${resource.resourceType}/${resource.id}`,
    resource: resource,
  };
}

export async function getEncounterAndRelatedResources(
  oystehr: Oystehr,
  encounterId?: string,
  includeProcedureDependencies = false
): Promise<FhirResource[]> {
  if (includeProcedureDependencies) return getEncounterWithProcedureDependencies(oystehr, encounterId, true);
  if (!encounterId) {
    throw new Error('Encounter ID is required');
  }
  return (
    await oystehr.fhir.search<Encounter | DocumentReference | Patient | ServiceRequest | Appointment>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:subject',
        },
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_revinclude:iterate',
          value: 'ServiceRequest:encounter',
        },
        {
          name: '_revinclude:iterate',
          value: 'DocumentReference:encounter',
        },
      ],
    })
  ).unbundle();
}
