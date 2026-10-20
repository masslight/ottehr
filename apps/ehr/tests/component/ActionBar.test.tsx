import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { ActionBar } from '../../src/features/visits/shared/components/patient/ActionBar';

// ============================================================================
// HARNESS
// ============================================================================

const renderActionBar = (
  overrides: Partial<ComponentProps<typeof ActionBar>> = {}
): { handleSave: ReturnType<typeof vi.fn> } => {
  const handleSave = vi.fn().mockResolvedValue(undefined);
  render(
    <ActionBar handleDiscard={vi.fn()} handleSave={handleSave} loading={false} submitDisabled={false} {...overrides} />
  );
  return { handleSave };
};

const saveButton = (): HTMLElement => screen.getByTestId(dataTestIds.patientInformationPage.saveChangesButton);

// ============================================================================
// TESTS
// ============================================================================

describe('ActionBar', () => {
  it('saves when the form has unsaved changes', async () => {
    const { handleSave } = renderActionBar();

    expect(saveButton()).toBeEnabled();
    await userEvent.click(saveButton());
    expect(handleSave).toHaveBeenCalledOnce();
  });

  // An unsigned consent no longer blocks the save - the visit page raises a reminder dialog around
  // it instead - so "nothing to save" is the only thing left that disables the button.
  it('disables Save All when the form has nothing to save', () => {
    renderActionBar({ submitDisabled: true });

    expect(saveButton()).toBeDisabled();
  });
});
