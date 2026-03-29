import { ServiceRequest } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  filterNotDeletedServiceRequests,
  isDeletedMedicationOrder,
  isDeletedOrder,
  isDeletedServiceRequest,
} from './order-status.helper';

describe('order-status.helper', () => {
  describe('isDeletedServiceRequest', () => {
    it('should return true for entered-in-error status', () => {
      expect(isDeletedServiceRequest({ status: 'entered-in-error' } as ServiceRequest)).toBe(true);
    });

    it('should return true for revoked status', () => {
      expect(isDeletedServiceRequest({ status: 'revoked' } as ServiceRequest)).toBe(true);
    });

    it.each(['active', 'completed', 'draft', 'on-hold', 'unknown'])('should return false for "%s" status', (status) => {
      expect(isDeletedServiceRequest({ status } as ServiceRequest)).toBe(false);
    });
  });

  describe('isDeletedMedicationOrder', () => {
    it('should return true for cancelled status', () => {
      expect(isDeletedMedicationOrder({ status: 'cancelled' })).toBe(true);
    });

    it('should return false for other statuses', () => {
      expect(isDeletedMedicationOrder({ status: 'active' })).toBe(false);
      expect(isDeletedMedicationOrder({ status: 'completed' })).toBe(false);
      expect(isDeletedMedicationOrder({})).toBe(false);
    });
  });

  describe('filterNotDeletedServiceRequests', () => {
    it('should filter out deleted service requests', () => {
      const requests = [
        { status: 'active' },
        { status: 'entered-in-error' },
        { status: 'completed' },
        { status: 'revoked' },
      ] as ServiceRequest[];

      const result = filterNotDeletedServiceRequests(requests);
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('active');
      expect(result[1].status).toBe('completed');
    });

    it('should return empty array when all are deleted', () => {
      const requests = [{ status: 'entered-in-error' }, { status: 'revoked' }] as ServiceRequest[];
      expect(filterNotDeletedServiceRequests(requests)).toHaveLength(0);
    });

    it('should return all when none are deleted', () => {
      const requests = [{ status: 'active' }, { status: 'completed' }] as ServiceRequest[];
      expect(filterNotDeletedServiceRequests(requests)).toHaveLength(2);
    });

    it('should return empty array for empty input', () => {
      expect(filterNotDeletedServiceRequests([])).toHaveLength(0);
    });
  });

  describe('isDeletedOrder', () => {
    it.each(['cancelled', 'entered-in-error', 'revoked'])('should return true for "%s"', (status) => {
      expect(isDeletedOrder({ status })).toBe(true);
    });

    it.each(['active', 'completed', 'draft'])('should return false for "%s"', (status) => {
      expect(isDeletedOrder({ status })).toBe(false);
    });

    it('should return false when status is undefined', () => {
      expect(isDeletedOrder({})).toBe(false);
    });
  });
});
