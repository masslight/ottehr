/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FC, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccidentField } from '../../src/features/visits/AccidentField';
import { useProgressNoteChartFields } from '../../src/features/visits/shared/hooks/useProgressNoteChartFields';

vi.mock('react-router-dom', () => ({
  useParams: vi.fn().mockReturnValue({ id: 'appointment-123' }),
  useLocation: () => ({ pathname: '/in-person/appointment-123/review-and-sign' }),
}));

vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: vi.fn().mockReturnValue({ id: 'user-123' }),
}));

vi.mock('../../src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: vi.fn().mockReturnValue({ isAppointmentReadOnly: false }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: vi.fn(() => ({ encounter: { id: 'encounter-123' } })),
  useSaveChartData: vi.fn(),
  useDeleteChartData: vi.fn(),
}));

vi.mock('utils/lib/frontend', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useSuccessQuery: vi.fn(), useErrorQuery: vi.fn() };
});

import { useOystehrAPIClient } from '../../src/features/visits/shared/hooks/useOystehrAPIClient';
import {
  useDeleteChartData,
  useSaveChartData,
} from '../../src/features/visits/shared/stores/appointment/appointment.store';

type Accident = { resourceId?: string; type: string[]; date?: string; state?: string };

const getChartData = vi.fn();
// The save response echoes the accident that was sent, with a resource id like the server would add.
const saveMutate = vi.fn((variables: { accident: Accident }, options?: { onSuccess?: (data: unknown) => void }) => {
  options?.onSuccess?.({
    chartData: { accident: { ...variables.accident, resourceId: variables.accident.resourceId ?? 'accident-1' } },
  });
});
const deleteMutate = vi.fn((_variables: unknown, options?: { onSuccess?: () => void }) => {
  options?.onSuccess?.();
});

/** The checkbox rendered next to a label; CheckboxInput does not associate the two. */
const checkboxFor = (label: string): HTMLInputElement => {
  const input = screen.getByText(label).parentElement?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!input) throw new Error(`no checkbox next to "${label}"`);
  return input;
};

/** Stands in for the Review & Sign summaries, which read the accident from the progress-note query. */
const ProgressNoteAccident: FC = () => {
  const { data, isLoading } = useProgressNoteChartFields();
  if (isLoading) return <span>summary loading</span>;
  return <span>summary accident: {(data?.accident?.type ?? []).join(',') || 'none'}</span>;
};

const renderWithClient = (ui: ReactNode): ReturnType<typeof render> => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('AccidentField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOystehrAPIClient).mockReturnValue({ getChartData } as never);
    vi.mocked(useSaveChartData).mockReturnValue({ mutate: saveMutate, isPending: false } as never);
    vi.mocked(useDeleteChartData).mockReturnValue({ mutate: deleteMutate, isPending: false } as never);
  });

  it('a saved accident shows in the progress-note summary without another chart read', async () => {
    getChartData.mockResolvedValue({ patientId: 'patient-123' });

    renderWithClient(
      <>
        <ProgressNoteAccident />
        <AccidentField readOnly={false} />
      </>
    );

    await screen.findByText('summary accident: none');
    const autoAccident = checkboxFor('Auto Accident');
    await waitFor(() => expect(autoAccident).toBeEnabled());
    const readsBeforeSave = getChartData.mock.calls.length;

    fireEvent.click(autoAccident);

    await screen.findByText('summary accident: AA');
    expect(saveMutate).toHaveBeenCalledWith(
      { accident: expect.objectContaining({ type: ['AA'] }) },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(getChartData).toHaveBeenCalledTimes(readsBeforeSave);
  });

  it('a cleared accident disappears from the progress-note summary without another chart read', async () => {
    getChartData.mockResolvedValue({
      patientId: 'patient-123',
      accident: { resourceId: 'accident-1', type: ['OA'], date: '2026-01-02' },
    });

    renderWithClient(
      <>
        <ProgressNoteAccident />
        <AccidentField readOnly={false} />
      </>
    );

    await screen.findByText('summary accident: OA');
    const otherAccident = checkboxFor('Other Accident');
    await waitFor(() => expect(otherAccident).toBeChecked());
    const readsBeforeDelete = getChartData.mock.calls.length;

    fireEvent.click(otherAccident);

    await screen.findByText('summary accident: none');
    expect(deleteMutate).toHaveBeenCalledWith(
      { accident: expect.objectContaining({ resourceId: 'accident-1' }) },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(getChartData).toHaveBeenCalledTimes(readsBeforeDelete);
  });
});
