import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryOfPresentIllnessField } from 'src/features/visits/HpiField';
import { useChartSection } from 'src/features/visits/shared/hooks/useChartSection';
import { useDebounceNotesField } from 'src/features/visits/shared/hooks/useDebounceNotesField';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/features/visits/shared/hooks/useChartSection', () => ({
  useChartSection: vi.fn(),
}));

vi.mock('src/features/visits/shared/hooks/useDebounceNotesField', () => ({
  useDebounceNotesField: vi.fn(),
}));

const mockUseChartSection = vi.mocked(useChartSection);
const mockUseDebounceNotesField = vi.mocked(useDebounceNotesField);

// the HPI box reads the stored note out of the encounter-notes section cache; this stands in for that cache
const setStoredHpi = (text: string | undefined): void => {
  mockUseChartSection.mockReturnValue({
    data: text === undefined ? {} : { chiefComplaint: { text } },
    isFetched: true,
  } as any);
};

describe('HistoryOfPresentIllnessField server sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStoredHpi('');
    mockUseDebounceNotesField.mockReturnValue({
      onValueChange: vi.fn(),
      isLoading: false,
      isChartDataLoading: false,
    } as any);
  });

  it('keeps text the provider is typing when a stale stored value lands mid-edit', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<HistoryOfPresentIllnessField />);

    const input = screen.getByLabelText('History of Present Illness');
    await user.type(input, 'chest pain ');
    expect(input).toHaveValue('chest pain ');

    // the debounced save resolves and writes the stored note back into the cache; it is behind what
    // is in the box (here by the trailing space the provider just typed)
    setStoredHpi('chest pain');
    rerender(<HistoryOfPresentIllnessField />);

    expect(input).toHaveValue('chest pain ');
  });

  it('applies a stored value that changed elsewhere while the box is untouched', () => {
    const { rerender } = render(<HistoryOfPresentIllnessField />);

    expect(screen.getByLabelText('History of Present Illness')).toHaveValue('');

    // e.g. the AI suggestion panel appending to HPI
    setStoredHpi('Patient reports chest pain.');
    rerender(<HistoryOfPresentIllnessField />);

    expect(screen.getByLabelText('History of Present Illness')).toHaveValue('Patient reports chest pain.');
  });

  it('resumes applying stored values once the provider edit round-trips', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<HistoryOfPresentIllnessField />);

    const input = screen.getByLabelText('History of Present Illness');
    await user.type(input, 'cough');

    // their own text comes back from the save, putting the box back in sync
    setStoredHpi('cough');
    rerender(<HistoryOfPresentIllnessField />);
    expect(input).toHaveValue('cough');

    setStoredHpi('cough\n\nfever since Tuesday');
    rerender(<HistoryOfPresentIllnessField />);
    expect(input).toHaveValue('cough\n\nfever since Tuesday');
  });
});
