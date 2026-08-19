import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

const mocks = vi.hoisted(() => ({
  isAppointmentReadOnly: false,
  featureFlags: { INLINE_PROGRESS_NOTE_EDITING_ENABLED: true },
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({
    isAppointmentReadOnly: mocks.isAppointmentReadOnly,
  }),
}));

vi.mock('../../src/constants/feature-flags', () => ({
  FEATURE_FLAGS: mocks.featureFlags,
}));

import { InlineEditSection } from 'src/features/visits/in-person/components/progress-note/InlineEditSection';

// ============================================================================
// HELPERS
// ============================================================================

const EditContent = (): JSX.Element => {
  editContentMountCount += 1;
  return <div data-testid="edit-content">edit form</div>;
};
let editContentMountCount = 0;

const renderSection = (props?: { disabled?: boolean }): ReturnType<typeof render> =>
  render(
    <InlineEditSection
      sectionName="allergies"
      editLabel="Edit allergies"
      editContent={<EditContent />}
      disabled={props?.disabled}
    >
      <div data-testid="summary-content">No known allergies</div>
    </InlineEditSection>
  );

// ============================================================================
// TESTS
// ============================================================================

describe('InlineEditSection', () => {
  beforeEach(() => {
    mocks.isAppointmentReadOnly = false;
    mocks.featureFlags.INLINE_PROGRESS_NOTE_EDITING_ENABLED = true;
    editContentMountCount = 0;
  });

  it('renders the summary with an edit affordance and lazy-mounts the editor', () => {
    renderSection();

    expect(screen.getByTestId('summary-content')).toBeVisible();
    expect(screen.getByTestId('inline-edit-button-allergies')).toBeVisible();
    expect(screen.queryByTestId('edit-content')).toBeNull();
    expect(editContentMountCount).toBe(0);
  });

  it('opens the editor when the summary is clicked and closes it via Done', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByTestId('summary-content'));
    expect(screen.getByTestId('edit-content')).toBeVisible();
    // the editor shows the same information in more detail, so the read-only summary
    // is replaced while editing; the edit label stands in as the section heading
    expect(screen.queryByTestId('summary-content')).toBeNull();
    expect(screen.getByText('Edit allergies')).toBeVisible();
    expect(screen.queryByTestId('inline-edit-button-allergies')).toBeNull();

    await user.click(screen.getByTestId('inline-edit-done-button-allergies'));
    expect(screen.queryByTestId('edit-content')).toBeNull();
    expect(screen.getByTestId('summary-content')).toBeVisible();
    expect(screen.getByTestId('inline-edit-button-allergies')).toBeVisible();
  });

  it('renders plain children on read-only appointments', () => {
    mocks.isAppointmentReadOnly = true;
    renderSection();

    expect(screen.getByTestId('summary-content')).toBeVisible();
    expect(screen.queryByTestId('inline-edit-section-allergies')).toBeNull();
    expect(screen.queryByTestId('inline-edit-button-allergies')).toBeNull();
  });

  it('renders plain children when the feature flag is off', () => {
    mocks.featureFlags.INLINE_PROGRESS_NOTE_EDITING_ENABLED = false;
    renderSection();

    expect(screen.getByTestId('summary-content')).toBeVisible();
    expect(screen.queryByTestId('inline-edit-section-allergies')).toBeNull();
  });

  it('renders plain children when disabled', () => {
    renderSection({ disabled: true });

    expect(screen.getByTestId('summary-content')).toBeVisible();
    expect(screen.queryByTestId('inline-edit-section-allergies')).toBeNull();
  });
});
