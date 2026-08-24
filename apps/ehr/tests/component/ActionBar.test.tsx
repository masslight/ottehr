import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { ActionBar } from '../../src/features/visits/shared/components/patient/ActionBar';
import { SaveBlockedReasonProvider } from '../../src/features/visits/shared/components/patient/SaveBlockedReasonContext';

// ============================================================================
// HARNESS
// ============================================================================

const BLOCKED_REASON = 'Please check "I verify that patient consent has been obtained." before saving.';

const renderActionBar = (
  overrides: Partial<ComponentProps<typeof ActionBar>> = {},
  blockedReason?: string
): { handleSave: ReturnType<typeof vi.fn> } => {
  const handleSave = vi.fn().mockResolvedValue(undefined);
  render(
    <SaveBlockedReasonProvider reason={blockedReason}>
      <ActionBar
        handleDiscard={vi.fn()}
        handleSave={handleSave}
        loading={false}
        submitDisabled={false}
        {...overrides}
      />
    </SaveBlockedReasonProvider>
  );
  return { handleSave };
};

const saveButton = (): HTMLElement => screen.getByTestId(dataTestIds.patientInformationPage.saveChangesButton);

// ============================================================================
// TESTS
// ============================================================================

describe('ActionBar', () => {
  it('enables Save All when nothing blocks the submit', async () => {
    const { handleSave } = renderActionBar();

    expect(saveButton()).toBeEnabled();
    await userEvent.click(saveButton());
    expect(handleSave).toHaveBeenCalledOnce();
  });

  it('disables Save All while a blocking reason is present, even when the form is dirty', async () => {
    const { handleSave } = renderActionBar({}, BLOCKED_REASON);

    expect(saveButton()).toBeDisabled();
    // Click the wrapper: the disabled button itself swallows pointer events.
    await userEvent.click(saveButton().parentElement!);
    expect(handleSave).not.toHaveBeenCalled();
  });

  it('explains the blocked submit on hover', async () => {
    renderActionBar({}, BLOCKED_REASON);

    await userEvent.hover(saveButton().parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(BLOCKED_REASON);
  });
});
