import { ServiceRequest } from 'fhir/r4b';

interface HasStatus {
  status?: string;
}

interface MedicationOrder extends HasStatus {
  id?: string;
}

export function isDeletedServiceRequest(serviceRequest: ServiceRequest): boolean {
  return serviceRequest.status === 'entered-in-error' || serviceRequest.status === 'revoked';
}

export function isDeletedMedicationOrder(order: MedicationOrder): boolean {
  return order.status === 'cancelled';
}

export function filterNotDeletedServiceRequests<T extends ServiceRequest>(serviceRequests: T[]): T[] {
  return serviceRequests.filter((sr) => !isDeletedServiceRequest(sr));
}

export function isDeletedOrder(item: { status?: string }): boolean {
  if (!item.status) return false;
  return item.status === 'cancelled' || item.status === 'entered-in-error' || item.status === 'revoked';
}
