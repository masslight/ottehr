import { BatchInputDeleteRequest, BatchInputPutRequest } from '@oystehr/sdk';
import { FhirResource } from 'fhir/r4b';

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
