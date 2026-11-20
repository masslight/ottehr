import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AllergiesContainer } from '../../src/features/visits/shared/components/review-tab/components/AllergiesContainer';
import { MedicationsContainer } from '../../src/features/visits/shared/components/review-tab/components/MedicationsContainer';

const note = vi.hoisted(() => ({ value: {} as { data?: unknown; isLoading?: boolean; error?: Error } }));
vi.mock('../../src/features/visits/shared/hooks/useVisitNote', () => ({ useVisitNote: () => note.value }));
vi.mock('../../src/features/visits/shared/components/scribe-recommendations/aiAddedMarks', () => ({
  useAiAddedRecommendations: () => [],
  findAiAddedFor: () => undefined,
}));
vi.mock('src/features/visits/shared/components/NoteSectionHeading', () => ({
  SectionHeading: ({ children }: { children: string }) => <div>{children}</div>,
  useNoteSectionTitleInCardHeader: () => false,
}));

describe('Allergies and Medications, before and after the note loads', () => {
  beforeEach(() => {
    note.value = {};
  });

  it('say "Loading…" while the note loads, never "No known allergies"', () => {
    note.value = { isLoading: true };
    render(
      <>
        <AllergiesContainer />
        <MedicationsContainer />
      </>
    );
    expect(screen.getAllByText('Loading…')).toHaveLength(2);
    expect(screen.queryByText('No known allergies')).not.toBeInTheDocument();
    expect(screen.queryByText('No current medications')).not.toBeInTheDocument();
  });

  it('say they couldn’t load after a failure', () => {
    note.value = { error: new Error('failed') };
    render(
      <>
        <AllergiesContainer />
        <MedicationsContainer />
      </>
    );
    expect(screen.getByText("Couldn't load allergies")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load medications")).toBeInTheDocument();
  });

  it('still say none when the note has none', () => {
    note.value = { data: { history: { allergies: [], medications: [] } } };
    render(
      <>
        <AllergiesContainer />
        <MedicationsContainer />
      </>
    );
    expect(screen.getByText('No known allergies')).toBeInTheDocument();
    expect(screen.getByText('No current medications')).toBeInTheDocument();
  });
});
