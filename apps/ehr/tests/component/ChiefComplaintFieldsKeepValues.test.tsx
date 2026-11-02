/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { ChartSection } from 'utils/lib/types/api/chart-data/chart-sections.types';
import { VisitNoteResponse } from 'utils/lib/types/api/chart-data/get-visit-note.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChiefComplaintField } from '../../src/features/visits/ChiefComplaintField';
import { ReasonForVisitField } from '../../src/features/visits/ReasonForVisitField';
import { VerifiedPatientInfo } from '../../src/features/visits/shared/components/patient-info/VerifiedPatientInfo';
import { emptyVisitNote } from './helpers/emptyVisitNote';

vi.mock('react-router-dom', () => ({
  useParams: vi.fn().mockReturnValue({ id: 'appointment-123' }),
  useLocation: () => ({ pathname: '/in-person/appointment-123/cc-and-intake-notes' }),
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

vi.mock('../../src/features/visits/shared/hooks/useReasonForVisitOptions', () => ({
  useReasonForVisitOptions: () => [
    { value: 'Cough', label: 'Cough' },
    { value: 'Fever', label: 'Fever' },
  ],
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: vi.fn(() => ({ encounter: { id: 'encounter-123' }, appointment: { id: 'appointment-123' } })),
  useSaveChartData: vi.fn(),
  useDeleteChartData: vi.fn(),
}));

import { useOystehrAPIClient } from '../../src/features/visits/shared/hooks/useOystehrAPIClient';
import {
  useDeleteChartData,
  useSaveChartData,
} from '../../src/features/visits/shared/stores/appointment/appointment.store';

type SaveOptions = { onSuccess?: (data: unknown) => void; onError?: () => void };

let note: VisitNoteResponse;

const apiClient = {
  getVisitNote: vi.fn(async () => note),
  getChartSection: vi.fn(async ({ section }: { section: ChartSection }) => ({ section, data: note[section] })),
};

// Stores each saved encounter-notes field on the server chart and returns it the way save-chart-data does:
// reasonForVisit is written to the Encounter and not echoed back.
const save = (variables: Record<string, Record<string, unknown>>): { chartData: Record<string, unknown> } => {
  const saved = Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [key, { ...value, resourceId: value.resourceId ?? `${key}-1` }])
  );
  note = { ...note, encounterNotes: { ...note.encounterNotes, ...saved } } as VisitNoteResponse;
  const { reasonForVisit: _notEchoed, ...returned } = saved;
  return { chartData: returned };
};

const saveMutate = vi.fn((variables: Record<string, Record<string, unknown>>, options?: SaveOptions) => {
  options?.onSuccess?.(save(variables));
});
const saveMutateAsync = vi.fn(async (variables: Record<string, Record<string, unknown>>) => save(variables));

const renderWithClient = (ui: ReactNode): ReturnType<typeof render> => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('Chief Complaint fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    note = emptyVisitNote();
    vi.mocked(useOystehrAPIClient).mockReturnValue(apiClient as never);
    vi.mocked(useSaveChartData).mockReturnValue({
      mutate: saveMutate,
      mutateAsync: saveMutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useDeleteChartData).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
  });

  it('keeps the verified checkbox and reason for visit after Additional Information is saved', async () => {
    renderWithClient(
      <>
        <VerifiedPatientInfo />
        <ReasonForVisitField />
        <ChiefComplaintField />
      </>
    );

    const verified = screen.getByRole('checkbox');
    await waitFor(() => expect(verified).toBeEnabled());
    fireEvent.click(verified);
    await waitFor(() => expect(saveMutateAsync).toHaveBeenCalledTimes(1));

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(within(await screen.findByRole('listbox')).getByText('Cough'));
    await waitFor(() => expect(saveMutate).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Additional Information'), { target: { value: 'Cut on arm' } });
    await waitFor(
      () =>
        expect(saveMutate).toHaveBeenCalledWith(
          expect.objectContaining({ historyOfPresentIllness: expect.anything() }),
          expect.anything()
        ),
      { timeout: 3000 }
    );

    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByRole('combobox')).toHaveTextContent('Cough');
  });
});
