import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiHpiSuggestion } from 'src/features/visits/AiHpiSuggestion';
import { useChartData } from 'src/features/visits/shared/hooks/useChartData';
import { useChartSection } from 'src/features/visits/shared/hooks/useChartSection';
import { useSaveChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { AiObservationField } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/features/visits/shared/hooks/useChartData', () => ({ useChartData: vi.fn() }));
vi.mock('src/features/visits/shared/hooks/useChartSection', () => ({ useChartSection: vi.fn() }));
vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({ useSaveChartData: vi.fn() }));

// Stand-in for the suggestion panel: one "+" per suggestion, or "added" once its id is in appendedNoteIds.
vi.mock('src/features/visits/in-person/components/AiSuggestion', () => ({
  default: ({
    content,
    onAppendToNote,
    appendedNoteIds,
  }: {
    content: { resourceId: string; value: string }[];
    onAppendToNote: (text: string, resourceId?: string) => void;
    appendedNoteIds: Set<string>;
  }) => (
    <>
      {content.map((item) =>
        appendedNoteIds.has(item.resourceId) ? (
          <span key={item.resourceId}>added {item.resourceId}</span>
        ) : (
          <button key={item.resourceId} onClick={() => onAppendToNote(item.value, item.resourceId)}>
            add {item.resourceId}
          </button>
        )
      )}
    </>
  ),
}));

const SUGGESTION = 'Patient reports right ankle pain after a fall yesterday.';
const saveChartData = vi.fn();
const setSectionData = vi.fn();

const renderWithHpi = (hpi: string): void => {
  vi.mocked(useChartSection).mockReturnValue({
    data: { chiefComplaint: { resourceId: 'cc-1', text: hpi } },
    setSectionData,
  } as any);
  render(<AiHpiSuggestion />);
};

describe('AiHpiSuggestion "+"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useChartData).mockReturnValue({
      chartData: {
        observations: [{ field: AiObservationField.HistoryOfPresentIllness, resourceId: 'obs-1', value: SUGGESTION }],
      },
    } as any);
    vi.mocked(useSaveChartData).mockReturnValue({ mutate: saveChartData } as any);
  });

  it('adds a suggestion that is not in the HPI yet', async () => {
    renderWithHpi('Seen for ankle injury.');
    await userEvent.click(screen.getByRole('button', { name: 'add obs-1' }));
    expect(saveChartData).toHaveBeenCalledWith(
      { chiefComplaint: { resourceId: 'cc-1', text: `Seen for ankle injury.\n\n${SUGGESTION}` } },
      expect.anything()
    );
  });

  it('shows a suggestion as added when its text is already in the HPI, e.g. after a reload', () => {
    renderWithHpi(`Seen for ankle injury.\n\n${SUGGESTION.replace('after a', 'after  a')}`);
    expect(screen.getByText('added obs-1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'add obs-1' })).not.toBeInTheDocument();
  });
});
