import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HealthcareService } from 'fhir/r4b';
import { ReactNode } from 'react';
import {
  BOOKING_CONFIG,
  getReasonForVisitOptionsForServiceCategory,
  SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
  SERVICE_CATEGORY_SYSTEM,
  SERVICE_CATEGORY_TAG,
} from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReasonForVisitOptions } from '../../src/features/visits/shared/hooks/useReasonForVisitOptions';

// Single mocked fhir.search callable; each test arranges its return value.
const mockFhirSearch = vi.fn<(...args: any[]) => Promise<{ unbundle: () => HealthcareService[] }>>();

const oystehrMock = {
  fhir: {
    search: (...args: any[]) => mockFhirSearch(...args),
  },
} as any;

// Both relative and `src/` import paths can land here depending on which file
// imports the hook (component vs. hook) — useSyncERXPatient.test mocks both
// shapes the same way; copy that pattern.
vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: oystehrMock, oystehrZambda: {} as any }),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: oystehrMock, oystehrZambda: {} as any }),
}));

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

// Pick a BOOKING_CONFIG code that's guaranteed to have RFV options configured;
// using the first non-empty entry keeps the test resilient to BOOKING_CONFIG
// reorderings (the test is about the resolution path, not a specific code).
const firstBookingConfigCodeWithReasons = BOOKING_CONFIG.serviceCategories.find(
  (sc) => getReasonForVisitOptionsForServiceCategory(sc.category.code).length > 0
)?.category.code;

describe('useReasonForVisitOptions', () => {
  beforeEach(() => {
    mockFhirSearch.mockReset();
  });

  it('returns BOOKING_CONFIG options for a compiled-in category without hitting FHIR', async () => {
    // Guard: if BOOKING_CONFIG has no categories with RFV the test is moot.
    expect(firstBookingConfigCodeWithReasons).toBeTruthy();
    const code = firstBookingConfigCodeWithReasons!;
    const { result } = renderHook(() => useReasonForVisitOptions(code), { wrapper });
    expect(result.current).toEqual(getReasonForVisitOptionsForServiceCategory(code));
    // React Query is `enabled: false` on this path; no FHIR query should fire.
    expect(mockFhirSearch).not.toHaveBeenCalled();
  });

  it('returns FHIR-backed RFV for an admin-managed category', async () => {
    const adminCode = 'admin-acne-facial';
    const adminRfv = [
      { value: 'cystic-acne', label: 'Cystic acne' },
      { value: 'breakout', label: 'Mild breakout' },
    ];
    const adminHs: HealthcareService = {
      resourceType: 'HealthcareService',
      id: 'hs-admin-1',
      name: 'Acne Facial',
      meta: { tag: [SERVICE_CATEGORY_TAG] },
      type: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code: adminCode, display: 'Acne Facial' }] }],
      extension: [
        {
          url: SERVICE_CATEGORY_CONFIG_EXTENSION_URL,
          valueString: JSON.stringify({ reasonsForVisit: adminRfv }),
        },
      ],
    };
    mockFhirSearch.mockResolvedValueOnce({ unbundle: () => [adminHs] });

    const { result } = renderHook(() => useReasonForVisitOptions(adminCode), { wrapper });
    // First render the FHIR query is in flight → empty list. After resolution
    // it's the configured RFV.
    await waitFor(() => expect(result.current).toEqual(adminRfv));
    expect(mockFhirSearch).toHaveBeenCalledTimes(1);
    // The hook narrows to category-tagged, active HSes only.
    expect(mockFhirSearch.mock.calls[0][0]).toMatchObject({
      resourceType: 'HealthcareService',
      params: expect.arrayContaining([
        expect.objectContaining({ name: '_tag', value: SERVICE_CATEGORY_TAG.code }),
        expect.objectContaining({ name: 'active', value: 'true' }),
      ]),
    });
  });

  it('returns [] when no FHIR HealthcareService matches the requested code', async () => {
    mockFhirSearch.mockResolvedValueOnce({ unbundle: () => [] });
    const { result } = renderHook(() => useReasonForVisitOptions('nonexistent-code'), { wrapper });
    // Wait for the query to settle then assert []. (renderHook's initial value
    // is also [], so waitFor needs something else to converge on — assert the
    // FHIR call happened, which gates the post-resolution branch.)
    await waitFor(() => expect(mockFhirSearch).toHaveBeenCalledTimes(1));
    expect(result.current).toEqual([]);
  });

  it('returns [] for an undefined category code (no query fires)', () => {
    const { result } = renderHook(() => useReasonForVisitOptions(undefined), { wrapper });
    expect(result.current).toEqual([]);
    expect(mockFhirSearch).not.toHaveBeenCalled();
  });
});
