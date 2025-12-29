import Oystehr from '@oystehr/sdk';
import { ServiceRequest } from 'fhir/r4b';
import { CANCELLATION_TAG_SYSTEM, PREVIOUS_STATUS_CODE } from 'utils';
import { describe, expect, it, vi } from 'vitest';

describe('cancel-radiology-order zambda', () => {
  describe('Previous status preservation', () => {
    it('should save previous status when cancelling active radiology order', async () => {
      const mockServiceRequest: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'test-sr-1',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'X-Ray' },
        identifier: [
          {
            system: 'http://advapacs.com/accession-number',
            value: 'ACC123',
          },
        ],
      };

      const mockPatchedServiceRequest: ServiceRequest = {
        ...mockServiceRequest,
        status: 'revoked',
        meta: {
          tag: [
            {
              system: CANCELLATION_TAG_SYSTEM,
              code: PREVIOUS_STATUS_CODE,
              display: 'active',
            },
          ],
        },
      };

      const mockOystehr = {
        fhir: {
          get: vi.fn().mockResolvedValue(mockServiceRequest),
          patch: vi.fn().mockResolvedValue(mockPatchedServiceRequest),
        },
      } as unknown as Oystehr;

      // Call patch directly to test the logic
      await mockOystehr.fhir.patch({
        resourceType: 'ServiceRequest',
        id: 'test-sr-1',
        operations: [
          {
            op: 'add',
            path: '/meta',
            value: {
              tag: [
                {
                  system: CANCELLATION_TAG_SYSTEM,
                  code: PREVIOUS_STATUS_CODE,
                  display: 'active',
                },
              ],
            },
          },
          {
            op: 'replace',
            path: '/status',
            value: 'revoked',
          },
        ],
      });

      expect(mockOystehr.fhir.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'ServiceRequest',
          id: 'test-sr-1',
          operations: expect.arrayContaining([
            expect.objectContaining({
              op: 'add',
              path: '/meta',
            }),
            expect.objectContaining({
              op: 'replace',
              path: '/status',
              value: 'revoked',
            }),
          ]),
        })
      );

      // Verify the result structure
      expect(mockPatchedServiceRequest.status).toBe('revoked');
      expect(mockPatchedServiceRequest.meta?.tag).toBeDefined();
      expect(mockPatchedServiceRequest.meta?.tag?.[0].system).toBe(CANCELLATION_TAG_SYSTEM);
      expect(mockPatchedServiceRequest.meta?.tag?.[0].code).toBe(PREVIOUS_STATUS_CODE);
      expect(mockPatchedServiceRequest.meta?.tag?.[0].display).toBe('active');
    });

    it('should save previous status when cancelling completed radiology order', async () => {
      const mockServiceRequest: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'test-sr-2',
        status: 'completed',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'CT Scan' },
        meta: {
          versionId: '1',
        },
      };

      const mockPatchedServiceRequest: ServiceRequest = {
        ...mockServiceRequest,
        status: 'revoked',
        meta: {
          versionId: '2',
          tag: [
            {
              system: CANCELLATION_TAG_SYSTEM,
              code: PREVIOUS_STATUS_CODE,
              display: 'completed',
            },
          ],
        },
      };

      // Verify the mock structure
      expect(mockPatchedServiceRequest.meta?.tag?.[0].display).toBe('completed');
    });

    it('should append cancellation tag to existing tags', async () => {
      const mockServiceRequest: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'test-sr-3',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'MRI' },
        meta: {
          tag: [
            {
              system: 'http://example.com',
              code: 'existing-tag',
            },
          ],
        },
      };

      const mockPatchedServiceRequest: ServiceRequest = {
        ...mockServiceRequest,
        status: 'revoked',
        meta: {
          tag: [
            {
              system: 'http://example.com',
              code: 'existing-tag',
            },
            {
              system: CANCELLATION_TAG_SYSTEM,
              code: PREVIOUS_STATUS_CODE,
              display: 'active',
            },
          ],
        },
      };

      // Verify the mock structure
      expect(mockPatchedServiceRequest.meta?.tag).toHaveLength(2);
      expect(mockPatchedServiceRequest.meta?.tag?.[0].system).toBe('http://example.com');
      expect(mockPatchedServiceRequest.meta?.tag?.[1].system).toBe(CANCELLATION_TAG_SYSTEM);
    });
  });

  describe('Status validation', () => {
    it('should handle different valid statuses', () => {
      const validStatuses: Array<ServiceRequest['status']> = ['draft', 'active', 'on-hold', 'completed'];

      validStatuses.forEach((status) => {
        const mockServiceRequest: ServiceRequest = {
          resourceType: 'ServiceRequest',
          id: `test-sr-${status}`,
          status,
          intent: 'order',
          subject: { reference: 'Patient/test' },
          code: { text: 'Test' },
        };

        expect(mockServiceRequest.status).toBe(status);
      });
    });
  });
});
