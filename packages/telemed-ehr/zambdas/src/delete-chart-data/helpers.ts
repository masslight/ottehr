import { BatchInputDeleteRequest } from '@zapehr/sdk';

export function deleteResourceRequest(resourceType: string, resourceId: string): BatchInputDeleteRequest {
  return { method: 'DELETE', url: `/${resourceType}/${resourceId}` };
}
