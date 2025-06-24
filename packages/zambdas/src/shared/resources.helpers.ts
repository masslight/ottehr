import { BatchInputPostRequest, BatchInputPutRequest } from '@oystehr/sdk';
import { Bundle, FhirResource } from 'fhir/r4b';

export function saveOrUpdateResourceRequest<F extends FhirResource>(
  resource: F
): BatchInputPutRequest<F> | BatchInputPostRequest<F> {
  return resource.id === undefined ? saveResourceRequest(resource) : updateResourceRequest(resource);
}

export function saveResourceRequest<F extends FhirResource>(resource: F): BatchInputPostRequest<F> {
  return {
    method: 'POST',
    url: `/${resource.resourceType}`,
    resource: resource,
  };
}

export function updateResourceRequest<F extends FhirResource>(resource: F): BatchInputPutRequest<F> {
  return {
    method: 'PUT',
    url: `/${resource.resourceType}/${resource.id}`,
    resource: resource,
  };
}

export function parseCreatedResourcesBundle(bundle: Bundle): FhirResource[] {
  const entries = bundle.entry ?? [];
  return entries.filter((entry) => entry.resource !== undefined).map((entry) => entry.resource) as FhirResource[];
}
