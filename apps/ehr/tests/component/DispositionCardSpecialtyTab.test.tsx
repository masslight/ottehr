import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DispositionDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const chart = vi.hoisted(() => ({ saved: undefined as DispositionDTO | undefined }));
const mutate = vi.hoisted(() => vi.fn());

// The chart section as the card sees it: loaded once, then replaced by whatever each save returns.
vi.mock('src/features/visits/shared/hooks/useChartSection', async () => {
  const React = await import('react');
  return {
    useChartSection: (_section: string, options?: { onSuccess?: (data: { disposition?: DispositionDTO }) => void }) => {
      const [data, setData] = React.useState({ disposition: chart.saved });
      React.useEffect(() => {
        options?.onSuccess?.({ disposition: chart.saved });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return {
        data,
        isLoading: false,
        setSectionData: (next: { disposition: DispositionDTO }) => setData((current) => ({ ...current, ...next })),
      };
    },
  };
});
vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useSaveChartData: () => ({ mutate, isPending: false }),
}));
vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));
vi.mock('src/shared/hooks/useDebounce', () => ({
  useDebounce: () => ({ debounce: (save: () => void) => save(), clear: vi.fn() }),
}));
vi.mock('src/hooks/useProgressNoteConfig', () => ({ useProgressNoteConfig: () => ({ data: undefined }) }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

import { DispositionCard } from '../../src/features/visits/shared/components/DispositionCard';

const specialtyTab = (): HTMLElement | null =>
  screen.queryByTestId(dataTestIds.telemedEhrFlow.planTabDispositionToggleButton('specialty'));

describe('DispositionCard Specialty Transfer tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutate.mockImplementation(
      (
        { disposition }: { disposition: DispositionDTO },
        { onSuccess }: { onSuccess: (data: { chartData: { disposition: DispositionDTO } }) => void }
      ) => onSuccess({ chartData: { disposition } })
    );
  });

  it('keeps the tab of a visit saved as Specialty Transfer after switching away, so the switch can be undone', async () => {
    const user = userEvent.setup();
    chart.saved = { type: 'specialty', note: 'Seen by ortho', specialty: 'Orthopedics' } as DispositionDTO;
    render(<DispositionCard />);
    expect(specialtyTab()).toBeInTheDocument();

    await user.click(screen.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionToggleButton('ed')));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(mutate.mock.lastCall![0].disposition.type).toBe('ed');
    expect(specialtyTab()).toBeInTheDocument();

    await user.click(specialtyTab()!);
    await waitFor(() => expect(mutate.mock.lastCall![0].disposition.type).toBe('specialty'));
  });

  it('never offers the retired tab on a visit not saved as Specialty Transfer', async () => {
    const user = userEvent.setup();
    chart.saved = { type: 'pcp-no-type', note: '' } as DispositionDTO;
    render(<DispositionCard />);

    await user.click(screen.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionToggleButton('ed')));
    await waitFor(() => expect(mutate).toHaveBeenCalled());

    expect(specialtyTab()).toBeNull();
  });
});
