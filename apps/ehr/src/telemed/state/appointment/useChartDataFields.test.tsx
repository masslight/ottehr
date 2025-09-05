/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { ExamObservationDTO, ObservationDTO, VitalsObservationDTO } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChartFields } from './useChartDataFields';

vi.mock('react-router-dom', () => ({
  useParams: vi.fn().mockReturnValue({ id: 'appointment-123' }),
}));

vi.mock('src/hooks/useEvolveUser', () => ({
  default: vi.fn().mockReturnValue({ id: 'user-123' }),
}));

vi.mock('../../../telemed/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: vi.fn(),
}));

vi.mock('../../hooks', () => ({
  useGetAppointmentAccessibility: vi.fn().mockReturnValue({ isAppointmentReadOnly: false }),
}));

vi.mock('./appointment.store', () => ({
  useAppointmentData: vi.fn().mockReturnValue({
    encounter: { id: 'encounter-123' },
  }),
}));

vi.mock('utils', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    useSuccessQuery: vi.fn(),
    useErrorQuery: vi.fn(),
  };
});

// Helper functions to create valid mock data
const createMockObservationDTO = (resourceId: string, field: string, value: string): ObservationDTO =>
  ({
    resourceId,
    field,
    value,
  }) as any;

const createMockExamObservationDTO = (resourceId: string, field: string, value?: boolean): ExamObservationDTO =>
  ({
    resourceId,
    field,
    value,
  }) as any;

const createMockVitalsObservationDTO = (
  resourceId: string,
  field: 'vital-weight',
  value: number
): VitalsObservationDTO =>
  ({
    resourceId,
    field,
    value,
  }) as any;

// Test data
const mockChartData = {
  patientId: 'patient-123',
  observations: [
    createMockObservationDTO('1', 'temperature', 'test-value'),
    createMockObservationDTO('2', 'blood_pressure', 'test-value-2'),
  ],
  examObservations: [createMockExamObservationDTO('3', 'heart_rate', true)],
  vitalsObservations: [createMockVitalsObservationDTO('4', 'vital-weight', 70)],
};

const mockApiClient = {
  getChartData: vi.fn(),
} as any;

// Helper to create wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });

  queryClient.clear();

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useChartDataField', () => {
  let mockUseOystehrAPIClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { useOystehrAPIClient } = await import('../../../telemed/hooks/useOystehrAPIClient');
    mockUseOystehrAPIClient = vi.mocked(useOystehrAPIClient);
    mockUseOystehrAPIClient.mockReturnValue(mockApiClient);
    mockApiClient.getChartData.mockResolvedValue(mockChartData);
  });

  describe('Basic functionality', () => {
    it('should fetch data with requested fields', async () => {
      const requestedFields = {
        observations: { _sort: 'date', _count: 10 },
        vitalsObservations: { _include: 'Patient' },
      };

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChartFields({ requestedFields: requestedFields }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockApiClient.getChartData).toHaveBeenCalledWith({
        encounterId: 'encounter-123',
        requestedFields,
      });

      expect(result.current.data).toEqual({
        observations: mockChartData.observations,
        vitalsObservations: mockChartData.vitalsObservations,
      });
    });

    it('should return only requested fields from response', async () => {
      const requestedFields = {
        observations: { _sort: 'date' },
      };

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChartFields({ requestedFields: requestedFields }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual({
        observations: mockChartData.observations,
      });
      expect(result.current.data).not.toHaveProperty('vitalsObservations');
      expect(result.current.data).not.toHaveProperty('examObservations');
    });

    it('should handle empty requested fields', async () => {
      const requestedFields = {};

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChartFields({ requestedFields: requestedFields }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual({});
    });
  });

  describe('Query key generation', () => {
    it('should generate stable query keys for same parameters', () => {
      const requestedFields = {
        observations: { _sort: 'date', _count: 10 },
        vitalsObservations: { _include: 'Patient' },
      };

      const wrapper = createWrapper();
      renderHook(() => useChartFields({ requestedFields: requestedFields }), { wrapper });
      renderHook(() => useChartFields({ requestedFields: requestedFields }), { wrapper });

      // Should use same query (same cache)
      expect(mockApiClient.getChartData).toHaveBeenCalledTimes(1);
    });

    it('should generate different query keys for different search params', () => {
      const requestedFields1 = {
        observations: { _sort: 'date', _count: 10 },
      };

      const requestedFields2 = {
        observations: { _sort: 'name', _count: 5 }, // Different params
      };

      const wrapper = createWrapper();
      renderHook(() => useChartFields({ requestedFields: requestedFields1 }), { wrapper });
      renderHook(() => useChartFields({ requestedFields: requestedFields2 }), { wrapper });

      expect(mockApiClient.getChartData).toHaveBeenCalledTimes(2);
    });

    it('should handle parameter order independence', () => {
      const requestedFields1 = {
        observations: { _sort: 'date', _count: 10 },
        vitalsObservations: { _include: 'Patient' },
      };

      const requestedFields2 = {
        vitalsObservations: { _include: 'Patient' },
        observations: { _count: 10, _sort: 'date' },
      };

      const wrapper = createWrapper();
      renderHook(() => useChartFields({ requestedFields: requestedFields1 }), { wrapper });
      renderHook(() => useChartFields({ requestedFields: requestedFields2 }), { wrapper });

      // Should use same cache (parameters are equivalent)
      expect(mockApiClient.getChartData).toHaveBeenCalledTimes(1);
    });
  });

  describe('setQueryCache functionality', () => {
    it('should update cache with exact search params match', async () => {
      const requestedFields = {
        observations: { _sort: 'date', _count: 10 },
      };

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChartFields({ requestedFields: requestedFields }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const newObservations = [createMockObservationDTO('5', 'new_field', 'new_value')];

      act(() => {
        result.current.setQueryCache({ observations: newObservations });
      });

      await waitFor(() => {
        expect(result.current.data?.observations).toEqual(newObservations);
      });
    });

    it('should update cache using function updater', async () => {
      const requestedFields = {
        observations: { _sort: 'date' },
      };

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChartFields({ requestedFields: requestedFields }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const newObservation = createMockObservationDTO('5', 'new_field', 'new_value');

      act(() => {
        result.current.setQueryCache((currentData) => ({
          observations: [...(currentData.observations || []), newObservation],
        }));
      });

      await waitFor(() => {
        expect(result.current.data?.observations).toHaveLength(3);
        expect(result.current.data?.observations).toContain(newObservation);
      });
    });

    it('should invalidate caches with different search params for same field', async () => {
      const requestedFields1 = {
        observations: { _sort: 'date', _count: 10 },
      };

      const requestedFields2 = {
        observations: { _sort: 'name', _count: 5 },
      };

      const wrapper = createWrapper();

      const { result: result1 } = renderHook(() => useChartFields({ requestedFields: requestedFields1 }), {
        wrapper,
      });

      const { result: result2 } = renderHook(() => useChartFields({ requestedFields: requestedFields2 }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
        expect(result2.current.isLoading).toBe(false);
      });

      mockApiClient.getChartData.mockClear();

      const newObservations = [createMockObservationDTO('5', 'updated', 'updated_value')];

      act(() => {
        result1.current.setQueryCache({ observations: newObservations });
      });

      // result1 should be updated immediately
      await waitFor(() => {
        expect(result1.current.data?.observations).toEqual(newObservations);
      });

      // result2 should be invalidated and refetch on next access
      await waitFor(() => {
        expect(mockApiClient.getChartData).toHaveBeenCalledWith({
          encounterId: 'encounter-123',
          requestedFields: requestedFields2,
        });
      });
    });

    it('should handle multiple field updates correctly', async () => {
      const requestedFields = {
        observations: { _sort: 'date' },
        vitalsObservations: { _include: 'Patient' },
      };

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChartFields({ requestedFields: requestedFields }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const updates = {
        observations: [createMockObservationDTO('5', 'new_obs', 'new_value')],
        vitalsObservations: [createMockVitalsObservationDTO('6', 'vital-weight', 75)],
      };

      act(() => {
        result.current.setQueryCache(updates);
      });

      await waitFor(() => {
        expect(result.current.data?.observations).toEqual(updates.observations);
        expect(result.current.data?.vitalsObservations).toEqual(updates.vitalsObservations);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      const requestedFields = {
        observations: { _sort: 'date' },
      };

      mockApiClient.getChartData.mockRejectedValue(new Error('API Error'));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChartFields({ requestedFields: requestedFields }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it('should handle missing apiClient', async () => {
      mockUseOystehrAPIClient.mockReturnValue(null);

      const requestedFields = {
        observations: { _sort: 'date' },
      };

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChartFields({ requestedFields: requestedFields }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // When apiClient is null, the query is disabled, so no error is thrown
      expect(result.current.error).toBe(null);
      expect(result.current.data).toBeUndefined();
      expect(mockApiClient.getChartData).not.toHaveBeenCalled();

      // Restore for other tests
      mockUseOystehrAPIClient.mockReturnValue(mockApiClient);
    });

    it('should handle missing encounterId', async () => {
      const { useAppointmentData } = await import('./appointment.store');
      const mockUseAppointmentData = vi.mocked(useAppointmentData);

      // Mock encounter without id
      mockUseAppointmentData.mockReturnValueOnce({ encounter: {} } as any);

      const requestedFields = {
        observations: { _sort: 'date' },
      };

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChartFields({ requestedFields: requestedFields }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // When encounterId is missing, the query is disabled
      expect(result.current.error).toBe(null);
      expect(result.current.data).toBeUndefined();
      expect(mockApiClient.getChartData).not.toHaveBeenCalled();

      // Restore for other tests
      mockUseAppointmentData.mockReturnValue({
        encounter: { id: 'encounter-123' },
      } as any);
    });

    it('should handle malformed cache data in setQueryCache', async () => {
      const requestedFields = {
        observations: { _sort: 'date' },
      };

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChartFields({ requestedFields: requestedFields }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeTruthy();
      });

      // Should not throw error when trying to update cache
      act(() => {
        result.current.setQueryCache({ observations: [] });
      });

      await waitFor(() => {
        expect(result.current.data?.observations).toEqual([]);
      });
    });
  });

  describe('Edge cases', () => {
    it('should be disabled when enabled=false', () => {
      const requestedFields = {
        observations: { _sort: 'date' },
      };

      const wrapper = createWrapper();
      renderHook(() => useChartFields({ requestedFields: requestedFields, enabled: false }), {
        wrapper,
      });

      expect(mockApiClient.getChartData).not.toHaveBeenCalled();
    });

    it('should handle fields not present in API response', async () => {
      const requestedFields = {
        observations: { _sort: 'date' },
        nonExistentField: { _sort: 'date' },
      };

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChartFields({ requestedFields: requestedFields }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeTruthy();
      });

      expect(result.current.data).toEqual({
        observations: mockChartData.observations,
      });
      expect(result.current.data).not.toHaveProperty('nonExistentField');
    });

    it('should handle read-only mode in query key', async () => {
      const { useGetAppointmentAccessibility } = await import('../../hooks');
      const mockUseGetAppointmentAccessibility = vi.mocked(useGetAppointmentAccessibility);

      mockUseGetAppointmentAccessibility.mockReturnValueOnce({
        isAppointmentReadOnly: true,
        isPractitionerLicensedInState: true,
        isEncounterAssignedToCurrentPractitioner: true,
        isStatusEditable: false,
        isCurrentUserHasAccessToAppointment: true,
      });

      const requestedFields = {
        observations: { _sort: 'date' },
      };

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChartFields({ requestedFields: requestedFields }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockApiClient.getChartData).toHaveBeenCalledWith({
        encounterId: 'encounter-123',
        requestedFields,
      });

      // Restore for other tests
      mockUseGetAppointmentAccessibility.mockReturnValue({
        isAppointmentReadOnly: false,
        isPractitionerLicensedInState: true,
        isEncounterAssignedToCurrentPractitioner: true,
        isStatusEditable: true,
        isCurrentUserHasAccessToAppointment: true,
      });
    });

    it('should handle complex nested search parameters', async () => {
      const requestedFields = {
        observations: {
          _sort: 'date',
          _count: 10,
          _include: ['Patient', 'Encounter'],
          customParam: { nested: { deep: 'value' } },
        },
      };

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChartFields({ requestedFields: requestedFields }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toBeTruthy();
      });

      expect(mockApiClient.getChartData).toHaveBeenCalledWith({
        encounterId: 'encounter-123',
        requestedFields,
      });
    });

    it('should handle empty updates in setQueryCache', async () => {
      const requestedFields = {
        observations: { _sort: 'date' },
      };

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChartFields({ requestedFields: requestedFields }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const originalData = result.current.data;

      act(() => {
        result.current.setQueryCache({});
      });

      expect(result.current.data).toEqual(originalData);
    });

    it('should handle function updater returning empty object', async () => {
      const requestedFields = {
        observations: { _sort: 'date' },
      };

      const wrapper = createWrapper();
      const { result } = renderHook(() => useChartFields({ requestedFields: requestedFields }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const originalData = result.current.data;

      act(() => {
        result.current.setQueryCache(() => ({}));
      });

      expect(result.current.data).toEqual(originalData);
    });
  });

  describe('createSearchParamsKey helper', () => {
    it('should create consistent keys for equivalent objects', async () => {
      mockApiClient.getChartData.mockClear();

      const params1 = {
        observations: { _sort: 'date', _count: 10 },
        vitalsObservations: { _include: 'Patient' },
      };

      const params2 = {
        vitalsObservations: { _include: 'Patient' },
        observations: { _count: 10, _sort: 'date' },
      };

      const wrapper = createWrapper();
      const { result: result1 } = renderHook(() => useChartFields({ requestedFields: params1 }), { wrapper });

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      renderHook(() => useChartFields({ requestedFields: params2 }), { wrapper });

      await waitFor(() => {
        expect(mockApiClient.getChartData).toHaveBeenCalledTimes(1);
      });
    });
  });
});

describe('useChartDataField - Advanced Cache Management', () => {
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(async () => {
    const { useOystehrAPIClient } = await import('../../../telemed/hooks/useOystehrAPIClient');
    const mockUseOystehrAPIClient = vi.mocked(useOystehrAPIClient);
    mockUseOystehrAPIClient.mockReturnValue(mockApiClient);
    mockApiClient.getChartData.mockResolvedValue(mockChartData);

    wrapper = createWrapper();
  });

  describe('Cross-cache updates with exact search params match', () => {
    it('should update multiple caches when search params match exactly', async () => {
      const sharedSearchParams = { _sort: 'date', _count: 10 };

      const { result: hook1 } = renderHook(
        () =>
          useChartFields({
            requestedFields: {
              observations: sharedSearchParams,
              vitalsObservations: { _include: 'Patient' },
            },
          }),
        { wrapper }
      );

      const { result: hook2 } = renderHook(
        () =>
          useChartFields({
            requestedFields: {
              observations: sharedSearchParams,
              examObservations: { _sort: 'name' },
            },
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(hook1.current.isLoading).toBe(false);
        expect(hook2.current.isLoading).toBe(false);
        expect(hook1.current.data).toBeTruthy();
        expect(hook2.current.data).toBeTruthy();
      });

      const newObservations = [createMockObservationDTO('999', 'updated', 'new_value')];

      act(() => {
        hook1.current.setQueryCache({ observations: newObservations });
      });

      await waitFor(() => {
        expect(hook1.current.data?.observations).toEqual(newObservations);
        expect(hook2.current.data?.observations).toEqual(newObservations);
      });
    });

    it('should handle partial field updates correctly', async () => {
      const { result: hook1 } = renderHook(
        () =>
          useChartFields({
            requestedFields: {
              observations: { _sort: 'date' },
              vitalsObservations: { _count: 5 },
            },
          }),
        { wrapper }
      );

      const { result: hook2 } = renderHook(
        () =>
          useChartFields({
            requestedFields: {
              observations: { _sort: 'date' },
              examObservations: { _include: 'Patient' },
            },
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(hook1.current.isLoading).toBe(false);
        expect(hook2.current.isLoading).toBe(false);
      });

      const originalVitalsObservations = hook1.current.data?.vitalsObservations;
      const originalExamObs = hook2.current.data?.examObservations;
      const newObservations = [createMockObservationDTO('999', 'updated', 'new_value')];

      act(() => {
        hook1.current.setQueryCache({ observations: newObservations });
      });

      await waitFor(() => {
        expect(hook1.current.data?.observations).toEqual(newObservations);
        expect(hook2.current.data?.observations).toEqual(newObservations);
        expect(hook1.current.data?.vitalsObservations).toEqual(originalVitalsObservations);
        expect(hook2.current.data?.examObservations).toEqual(originalExamObs);
      });
    });
  });

  describe('Cache invalidation with different search params', () => {
    it('should invalidate caches with different search params for same field', async () => {
      const { result: hook1 } = renderHook(
        () =>
          useChartFields({
            requestedFields: {
              observations: { _sort: 'date', _count: 10 },
            },
          }),
        { wrapper }
      );

      const { result: hook2 } = renderHook(
        () =>
          useChartFields({
            requestedFields: {
              observations: { _sort: 'name', _count: 5 },
            },
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(hook1.current.isLoading).toBe(false);
        expect(hook2.current.isLoading).toBe(false);
      });

      mockApiClient.getChartData.mockClear();
      const newObservations = [createMockObservationDTO('999', 'updated', 'new_value')];

      act(() => {
        hook1.current.setQueryCache({ observations: newObservations });
      });

      await waitFor(() => {
        expect(hook1.current.data?.observations).toEqual(newObservations);
      });

      await waitFor(() => {
        expect(mockApiClient.getChartData).toHaveBeenCalledWith({
          encounterId: 'encounter-123',
          requestedFields: { observations: { _sort: 'name', _count: 5 } },
        });
      });
    });

    it('should not affect caches for completely different fields', async () => {
      const { result: hook1 } = renderHook(
        () =>
          useChartFields({
            requestedFields: {
              observations: { _sort: 'date' },
            },
          }),
        { wrapper }
      );

      const { result: hook2 } = renderHook(
        () =>
          useChartFields({
            requestedFields: {
              vitalsObservations: { _count: 5 },
            },
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(hook1.current.isLoading).toBe(false);
        expect(hook2.current.isLoading).toBe(false);
      });

      mockApiClient.getChartData.mockClear();
      const originalVitalsObservations = hook2.current.data?.vitalsObservations;
      const newObservations = [createMockObservationDTO('999', 'updated', 'new_value')];

      act(() => {
        hook1.current.setQueryCache({ observations: newObservations });
      });

      await waitFor(() => {
        expect(hook1.current.data?.observations).toEqual(newObservations);
      });

      expect(hook2.current.data?.vitalsObservations).toEqual(originalVitalsObservations);
      expect(mockApiClient.getChartData).not.toHaveBeenCalled();
    });
  });

  describe('Complex multi-field scenarios', () => {
    it('should handle mixed updates and invalidations in single setQueryCache call', async () => {
      const { result: hook1 } = renderHook(
        () =>
          useChartFields({
            requestedFields: {
              observations: { _sort: 'date' },
              vitalsObservations: { _count: 10 },
            },
          }),
        { wrapper }
      );

      const { result: hook2 } = renderHook(
        () =>
          useChartFields({
            requestedFields: {
              observations: { _sort: 'name' },
              vitalsObservations: { _count: 10 },
            },
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(hook1.current.isLoading).toBe(false);
        expect(hook2.current.isLoading).toBe(false);
      });

      mockApiClient.getChartData.mockClear();
      const newObservations = [createMockObservationDTO('999', 'obs', 'new')];
      const newVitalsObservations = [createMockVitalsObservationDTO('888', 'vital-weight', 80)];

      act(() => {
        hook1.current.setQueryCache({
          observations: newObservations,
          vitalsObservations: newVitalsObservations,
        });
      });

      await waitFor(() => {
        expect(hook1.current.data?.observations).toEqual(newObservations);
        expect(hook1.current.data?.vitalsObservations).toEqual(newVitalsObservations);
        expect(hook2.current.data?.vitalsObservations).toEqual(newVitalsObservations);
      });
    });

    it('should handle function updater with multiple fields', async () => {
      const { result: hook1 } = renderHook(
        () =>
          useChartFields({
            requestedFields: {
              observations: { _sort: 'date' },
              vitalsObservations: { _count: 10 },
            },
          }),
        { wrapper }
      );

      const { result: hook2 } = renderHook(
        () =>
          useChartFields({
            requestedFields: {
              observations: { _sort: 'date' },
              examObservations: { _include: 'Patient' },
            },
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(hook1.current.isLoading).toBe(false);
        expect(hook2.current.isLoading).toBe(false);
      });

      act(() => {
        hook1.current.setQueryCache((currentData) => ({
          observations: [...(currentData.observations || []), createMockObservationDTO('999', 'new', 'appended')],
          vitalsObservations: [createMockVitalsObservationDTO('888', 'vital-weight', 85)],
        }));
      });

      await waitFor(() => {
        expect(hook1.current.data?.observations).toHaveLength(3);
        expect(hook2.current.data?.observations).toHaveLength(3);
        expect(hook1.current.data?.observations?.[2]).toEqual(createMockObservationDTO('999', 'new', 'appended'));
        expect(hook2.current.data?.observations?.[2]).toEqual(createMockObservationDTO('999', 'new', 'appended'));
        expect(hook1.current.data?.vitalsObservations).toEqual([
          createMockVitalsObservationDTO('888', 'vital-weight', 85),
        ]);
      });
    });
  });

  describe('Edge cases in cache management', () => {
    it('should update disabled caches through setQueryCache', async () => {
      const { result: hook1 } = renderHook(
        () =>
          useChartFields({
            requestedFields: { observations: { _sort: 'date' } },
            enabled: false,
          }),
        { wrapper }
      );

      const { result: hook2 } = renderHook(
        () =>
          useChartFields({
            requestedFields: { observations: { _sort: 'date' } },
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(hook2.current.isLoading).toBe(false);
      });

      const newObservations = [createMockObservationDTO('999', 'new', 'value')];

      act(() => {
        hook2.current.setQueryCache({ observations: newObservations });
      });

      await waitFor(() => {
        expect(hook2.current.data?.observations).toEqual(newObservations);
        // hook1 should also receive data through cache update (not network request)
        expect(hook1.current.data?.observations).toEqual(newObservations);
      });
    });

    it('should handle malformed search params in existing cache', async () => {
      const { result } = renderHook(
        () =>
          useChartFields({
            requestedFields: { observations: { _sort: 'date' } },
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const { result: queryClientResult } = renderHook(() => useQueryClient(), { wrapper });
      const queryClient = queryClientResult.current;

      const corruptedKey = ['chart-data-fields', 'encounter-123', 'invalid-json{', false];
      queryClient.setQueryData(corruptedKey, { observations: [] });

      act(() => {
        result.current.setQueryCache({ observations: [] });
      });

      await waitFor(() => {
        expect(result.current.data?.observations).toEqual([]);
      });
    });

    it('should handle deep nested parameter comparison', async () => {
      const complexParams1 = {
        observations: {
          _sort: 'date',
          _include: ['Patient', 'Encounter'],
          customFilter: {
            nested: { deep: { value: 'test' } },
            array: [1, 2, 3],
          },
        },
      };

      const complexParams2 = {
        observations: {
          customFilter: {
            array: [1, 2, 3],
            nested: { deep: { value: 'test' } },
          },
          _include: ['Patient', 'Encounter'],
          _sort: 'date',
        },
      };

      const { result: hook1 } = renderHook(() => useChartFields({ requestedFields: complexParams1 }), { wrapper });

      const { result: hook2 } = renderHook(() => useChartFields({ requestedFields: complexParams2 }), { wrapper });

      await waitFor(() => {
        expect(hook1.current.isLoading).toBe(false);
        expect(hook2.current.isLoading).toBe(false);
      });

      const newObservations = [createMockObservationDTO('999', 'test', 'complex')];

      act(() => {
        hook1.current.setQueryCache({ observations: newObservations });
      });

      await waitFor(() => {
        expect(hook1.current.data?.observations).toEqual(newObservations);
        expect(hook2.current.data?.observations).toEqual(newObservations);
      });
    });
  });

  describe('Performance and optimization', () => {
    it('should only process relevant caches for the same encounterId', async () => {
      const { useAppointmentData } = await import('./appointment.store');
      vi.mocked(useAppointmentData)
        .mockReturnValueOnce({ encounter: { id: 'encounter-456' } } as any)
        .mockReturnValue({ encounter: { id: 'encounter-123' } } as any);

      const { result: hook1 } = renderHook(
        () =>
          useChartFields({
            requestedFields: { observations: { _sort: 'date' } },
          }),
        { wrapper }
      );

      const { result: hook2 } = renderHook(
        () =>
          useChartFields({
            requestedFields: { observations: { _sort: 'date' } },
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(hook1.current.isLoading).toBe(false);
        expect(hook2.current.isLoading).toBe(false);
      });

      const originalHook1Data = hook1.current.data;
      const newObservations = [createMockObservationDTO('999', 'new', 'value')];

      act(() => {
        hook2.current.setQueryCache({ observations: newObservations });
      });

      expect(hook1.current.data).toEqual(originalHook1Data);
      await waitFor(() => {
        expect(hook2.current.data?.observations).toEqual(newObservations);
      });
    });

    it('should not cause unnecessary re-renders', async () => {
      const renderSpy = vi.fn();

      const TestComponent = (): JSX.Element => {
        renderSpy();
        const { data } = useChartFields({
          requestedFields: { observations: { _sort: 'date' } },
        });
        return <div>{JSON.stringify(data)}</div>;
      };

      render(<TestComponent />, { wrapper });

      await waitFor(() => {
        expect(renderSpy).toHaveBeenCalledTimes(2);
      });

      renderSpy.mockClear();

      const { result } = renderHook(
        () =>
          useChartFields({
            requestedFields: { vitalsObservations: { _count: 5 } },
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.setQueryCache({ vitalsObservations: [] });
      });

      expect(renderSpy).not.toHaveBeenCalled();
    });
  });
});
