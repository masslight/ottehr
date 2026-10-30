import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { Patient } from 'fhir/r4b';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFhirSearch = vi.fn<(...args: any[]) => Promise<any>>();

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: { fhir: { search: (...args: any[]) => mockFhirSearch(...args) } } as any,
    oystehrZambda: {} as any,
  }),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: { fhir: { search: (...args: any[]) => mockFhirSearch(...args) } } as any,
    oystehrZambda: {} as any,
  }),
}));

import { useGetPatient } from '../../src/hooks/useGetPatient';

const PATIENT_ID = '0e9d3d0c-2d5f-4b5b-8c3a-2a1e6c9f7b10';
const patient: Patient = {
  resourceType: 'Patient',
  id: PATIENT_ID,
  name: [{ given: ['Pat'], family: 'Doe' }],
  birthDate: '2001-01-01',
};

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    {children}
  </QueryClientProvider>
);

describe('useGetPatient', () => {
  beforeEach(() => {
    mockFhirSearch.mockReset();
  });

  it('still returns the patient when the duplicate-name search fails', async () => {
    mockFhirSearch.mockImplementation(async ({ params }: { params: { name: string }[] }) => {
      if (params.some((p) => p.name === '_id')) return { unbundle: () => [patient] };
      throw new Error('duplicate search failed');
    });

    const { result } = renderHook(() => useGetPatient(PATIENT_ID), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.patient?.id).toBe(PATIENT_ID);
    expect(result.current.duplicatePatients).toEqual([]);
  });
});
