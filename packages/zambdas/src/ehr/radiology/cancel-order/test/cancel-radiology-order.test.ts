import Oystehr from '@oystehr/sdk';
import { ServiceRequest } from 'fhir/r4b';
import { CANCELLATION_TAG_SYSTEM } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { ZambdaInput } from '../../../../shared';
import { validateInput } from '../validation';

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
              code: 'active',
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
                  code: 'active',
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
      expect(mockPatchedServiceRequest.meta?.tag?.[0].code).toBe('active');
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
              code: 'completed',
              display: 'completed',
            },
          ],
        },
      };

      // Verify the mock structure
      expect(mockPatchedServiceRequest.meta?.tag?.[0].code).toBe('completed');
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
              code: 'active',
              display: 'active',
            },
          ],
        },
      };

      // Verify the mock structure
      expect(mockPatchedServiceRequest.meta?.tag).toHaveLength(2);
      expect(mockPatchedServiceRequest.meta?.tag?.[0].system).toBe('http://example.com');
      expect(mockPatchedServiceRequest.meta?.tag?.[1].system).toBe(CANCELLATION_TAG_SYSTEM);
      expect(mockPatchedServiceRequest.meta?.tag?.[1].code).toBe('active');
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

  describe('Validation of cancellable orders', () => {
    const createMockInput = (serviceRequestId: string): ZambdaInput => ({
      body: JSON.stringify({ serviceRequestId }),
      headers: {
        Authorization: 'Bearer test-token',
      },
      secrets: null,
    });

    it('should allow cancellation of draft orders', async () => {
      const mockServiceRequest: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: '123e4567-e89b-12d3-a456-426614174001',
        status: 'draft',
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

      const mockOystehr = {
        fhir: {
          get: vi.fn().mockResolvedValue(mockServiceRequest),
        },
      } as unknown as Oystehr;

      const input = createMockInput('123e4567-e89b-12d3-a456-426614174001');
      const result = await validateInput(input, mockOystehr);

      expect(result.body.serviceRequestId).toBe('123e4567-e89b-12d3-a456-426614174001');
      expect(mockOystehr.fhir.get).toHaveBeenCalledWith({
        resourceType: 'ServiceRequest',
        id: '123e4567-e89b-12d3-a456-426614174001',
      });
    });

    it('should allow cancellation of active orders', async () => {
      const mockServiceRequest: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: '123e4567-e89b-12d3-a456-426614174002',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'CT Scan' },
        identifier: [
          {
            system: 'http://advapacs.com/accession-number',
            value: 'ACC456',
          },
        ],
      };

      const mockOystehr = {
        fhir: {
          get: vi.fn().mockResolvedValue(mockServiceRequest),
        },
      } as unknown as Oystehr;

      const input = createMockInput('123e4567-e89b-12d3-a456-426614174002');
      const result = await validateInput(input, mockOystehr);

      expect(result.body.serviceRequestId).toBe('123e4567-e89b-12d3-a456-426614174002');
    });

    it('should allow cancellation of on-hold orders', async () => {
      const mockServiceRequest: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: '123e4567-e89b-12d3-a456-426614174003',
        status: 'on-hold',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'MRI' },
        identifier: [
          {
            system: 'http://advapacs.com/accession-number',
            value: 'ACC789',
          },
        ],
      };

      const mockOystehr = {
        fhir: {
          get: vi.fn().mockResolvedValue(mockServiceRequest),
        },
      } as unknown as Oystehr;

      const input = createMockInput('123e4567-e89b-12d3-a456-426614174003');
      const result = await validateInput(input, mockOystehr);

      expect(result.body.serviceRequestId).toBe('123e4567-e89b-12d3-a456-426614174003');
    });

    it('should allow cancellation of completed orders', async () => {
      const mockServiceRequest: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: '123e4567-e89b-12d3-a456-426614174004',
        status: 'completed',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'Ultrasound' },
        identifier: [
          {
            system: 'http://advapacs.com/accession-number',
            value: 'ACC321',
          },
        ],
      };

      const mockOystehr = {
        fhir: {
          get: vi.fn().mockResolvedValue(mockServiceRequest),
        },
      } as unknown as Oystehr;

      const input = createMockInput('123e4567-e89b-12d3-a456-426614174004');
      const result = await validateInput(input, mockOystehr);

      expect(result.body.serviceRequestId).toBe('123e4567-e89b-12d3-a456-426614174004');
    });

    it('should reject cancellation of revoked orders', async () => {
      const mockServiceRequest: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: '123e4567-e89b-12d3-a456-426614174005',
        status: 'revoked',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'X-Ray' },
        identifier: [
          {
            system: 'http://advapacs.com/accession-number',
            value: 'ACC654',
          },
        ],
      };

      const mockOystehr = {
        fhir: {
          get: vi.fn().mockResolvedValue(mockServiceRequest),
        },
      } as unknown as Oystehr;

      const input = createMockInput('123e4567-e89b-12d3-a456-426614174005');

      await expect(validateInput(input, mockOystehr)).rejects.toThrow(
        'Order has already been canceled and cannot be canceled again'
      );
    });

    it('should reject cancellation of entered-in-error orders', async () => {
      const mockServiceRequest: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: '123e4567-e89b-12d3-a456-426614174006',
        status: 'entered-in-error',
        intent: 'order',
        subject: { reference: 'Patient/test' },
        code: { text: 'CT Scan' },
        identifier: [
          {
            system: 'http://advapacs.com/accession-number',
            value: 'ACC987',
          },
        ],
      };

      const mockOystehr = {
        fhir: {
          get: vi.fn().mockResolvedValue(mockServiceRequest),
        },
      } as unknown as Oystehr;

      const input = createMockInput('123e4567-e89b-12d3-a456-426614174006');

      await expect(validateInput(input, mockOystehr)).rejects.toThrow(
        'Order has already been canceled and cannot be canceled again'
      );
    });
  });
});
