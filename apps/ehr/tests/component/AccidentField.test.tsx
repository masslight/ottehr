/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FC, ReactNode } from 'react';
import { ChartSection } from 'utils/lib/types/api/chart-data/chart-sections.types';
import { VisitNoteResponse } from 'utils/lib/types/api/chart-data/get-visit-note.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccidentField } from '../../src/features/visits/AccidentField';
import { useVisitNote } from '../../src/features/visits/shared/hooks/useVisitNote';
import { emptyVisitNote } from './helpers/emptyVisitNote';

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

import { useOystehrAPIClient } from '../../src/features/visits/shared/hooks/useOystehrAPIClient';
import {
  useDeleteChartData,
  useSaveChartData,
} from '../../src/features/visits/shared/stores/appointment/appointment.store';

type Accident = { resourceId?: string; type: string[]; date?: string; state?: string };

// The server's chart: the visit note and section reads serve it, the save and delete mocks change it.
let note: VisitNoteResponse;

const apiClient = {
  getVisitNote: vi.fn(async () => note),
  getChartSection: vi.fn(async ({ section }: { section: ChartSection }) => ({ section, data: note[section] })),
};

const encounterNotesReads = (): number =>
  apiClient.getChartSection.mock.calls.filter((call) => call[0].section === 'encounterNotes').length;

const saveMutate = vi.fn((variables: { accident: Accident }, options?: { onSuccess?: (data: unknown) => void }) => {
  const accident = { ...variables.accident, resourceId: variables.accident.resourceId ?? 'accident-1' };
  note = { ...note, encounterNotes: { ...note.encounterNotes, accident } } as VisitNoteResponse;
  options?.onSuccess?.({ chartData: { accident } });
});

const deleteMutate = vi.fn((_variables: unknown, options?: { onSuccess?: () => void }) => {
  const { accident: _removed, ...rest } = note.encounterNotes;
  note = { ...note, encounterNotes: rest } as VisitNoteResponse;
  options?.onSuccess?.();
});

/** The checkbox rendered next to a label; CheckboxInput does not associate the two. */
const checkboxFor = (label: string): HTMLInputElement => {
  const input = screen.getByText(label).parentElement?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!input) throw new Error(`no checkbox next to "${label}"`);
  return input;
};

/** Stands in for the Review & Sign summaries, which read the accident from the visit note. */
const VisitNoteAccident: FC = () => {
  const { data, isLoading } = useVisitNote();
  if (isLoading) return <span>summary loading</span>;
  return <span>summary accident: {(data?.encounterNotes.accident?.type ?? []).join(',') || 'none'}</span>;
};

const renderWithClient = (ui: ReactNode): ReturnType<typeof render> => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('AccidentField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    note = emptyVisitNote();
    vi.mocked(useOystehrAPIClient).mockReturnValue(apiClient as never);
    vi.mocked(useSaveChartData).mockReturnValue({ mutate: saveMutate, isPending: false } as never);
    vi.mocked(useDeleteChartData).mockReturnValue({ mutate: deleteMutate, isPending: false } as never);
  });

  it('a saved accident shows in the visit-note summary without another chart read', async () => {
    renderWithClient(
      <>
        <VisitNoteAccident />
        <AccidentField readOnly={false} />
      </>
    );

    await screen.findByText('summary accident: none');
    const autoAccident = checkboxFor('Auto Accident');
    await waitFor(() => expect(autoAccident).toBeEnabled());
    const readsBeforeSave = encounterNotesReads();
    fireEvent.click(autoAccident);

    await screen.findByText('summary accident: AA');
    expect(encounterNotesReads()).toBe(readsBeforeSave);
    expect(saveMutate).toHaveBeenCalledWith(
      { accident: expect.objectContaining({ type: ['AA'] }) },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(apiClient.getVisitNote).toHaveBeenCalledTimes(1);
  });

  it('a cleared accident disappears from the visit-note summary without another chart read', async () => {
    note = {
      ...note,
      encounterNotes: {
        ...note.encounterNotes,
        accident: { resourceId: 'accident-1', type: ['OA'], date: '2026-01-02' },
      },
    } as VisitNoteResponse;

    renderWithClient(
      <>
        <VisitNoteAccident />
        <AccidentField readOnly={false} />
      </>
    );

    await screen.findByText('summary accident: OA');
    const otherAccident = checkboxFor('Other Accident');
    await waitFor(() => expect(otherAccident).toBeChecked());
    const readsBeforeDelete = encounterNotesReads();

    fireEvent.click(otherAccident);

    await screen.findByText('summary accident: none');
    expect(encounterNotesReads()).toBe(readsBeforeDelete);
    expect(deleteMutate).toHaveBeenCalledWith(
      { accident: expect.objectContaining({ resourceId: 'accident-1' }) },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
    expect(apiClient.getVisitNote).toHaveBeenCalledTimes(1);
  });
});
