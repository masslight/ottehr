import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { VfcEligibilityResponse } from 'utils/lib/types/api/vfc-eligibility';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { confirm, eligibility } = vi.hoisted(() => ({
  confirm: vi.fn(),
  eligibility: { data: undefined as VfcEligibilityResponse | undefined, isLoading: false },
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/features/immunization/hooks/useVaccineInventory', () => ({
  useVfcEligibility: () => eligibility,
  useConfirmVfcEligibility: () => ({ mutateAsync: confirm, isPending: false }),
  useVaccineLotsOnHand: () => ({ data: [] }),
}));

import { dataTestIds } from '../../src/constants/data-test-ids';
import { ADMINISTERED } from '../../src/features/immunization/common';
import { AdministrationConfirmationDialog } from '../../src/features/immunization/components/AdministrationConfirmationDialog';
import { VfcEligibilityBox } from '../../src/features/immunization/components/VfcEligibilityBox';

const setData = (data: VfcEligibilityResponse | undefined): void => {
  eligibility.data = data;
};

const pick = (label: string): void => {
  fireEvent.click(screen.getByTestId(dataTestIds.vfcEligibility.blank));
  fireEvent.click(within(screen.getByRole('listbox', { name: 'VFC eligibility' })).getByText(label));
};

describe('VfcEligibilityBox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirm.mockResolvedValue({ applies: true });
  });

  it('is hidden for a patient 19 or older', () => {
    setData({ applies: false });
    render(<VfcEligibilityBox encounterId="enc-1" />);
    expect(screen.queryByTestId(dataTestIds.vfcEligibility.box)).not.toBeInTheDocument();
  });

  it('is pre-filled with what the paperwork says and confirmed with one click', async () => {
    setData({ applies: true, derived: { code: 'V02' } });
    render(<VfcEligibilityBox encounterId="enc-1" />);

    // the full stop is joined to the blank by a word joiner
    expect(screen.getByTestId(dataTestIds.vfcEligibility.box)).toHaveTextContent(
      /^VFC eligibility confirmation Eligible: Medicaid⁠\.Confirm$/
    );
    fireEvent.click(screen.getByTestId(dataTestIds.vfcEligibility.confirmButton));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith('V02'));
  });

  it('confirms a picked category without a separate Confirm, even when it is the pre-filled one', async () => {
    setData({ applies: true, derived: { code: 'V01' } });
    render(<VfcEligibilityBox encounterId="enc-1" />);

    pick('Eligible: American Indian or Alaska Native');
    await waitFor(() => expect(confirm).toHaveBeenCalledWith('V04'));

    pick('Not eligible (private insurance or separate CHIP)');
    await waitFor(() => expect(confirm).toHaveBeenLastCalledWith('V01'));
  });

  it('leaves the category empty, with no Confirm, when the paperwork says nothing', () => {
    setData({ applies: true });
    render(<VfcEligibilityBox encounterId="enc-1" />);
    expect(screen.getByTestId(dataTestIds.vfcEligibility.blank)).toHaveTextContent('category');
    expect(screen.getByTestId(dataTestIds.vfcEligibility.blank)).toHaveAttribute('data-needed', 'true');
    expect(screen.queryByTestId(dataTestIds.vfcEligibility.confirmButton)).not.toBeInTheDocument();
  });

  it('shows when and by whom once confirmed, and picking again re-confirms', async () => {
    const confirmedAt = '2026-11-11T14:05:00.000Z';
    setData({
      applies: true,
      derived: { code: 'V02' },
      confirmed: { code: 'V03', confirmedAt, confirmedBy: 'J. Ortiz' },
    });
    render(<VfcEligibilityBox encounterId="enc-1" />);

    expect(screen.getByTestId(dataTestIds.vfcEligibility.blank)).toHaveTextContent('Eligible: Uninsured');
    expect(screen.getByTestId(dataTestIds.vfcEligibility.confirmed)).toHaveTextContent(
      `Confirmed ${DateTime.fromISO(confirmedAt).toLocal().toFormat('MM/dd/yyyy hh:mm a')} · J. Ortiz`
    );
    expect(screen.queryByTestId(dataTestIds.vfcEligibility.confirmButton)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();

    pick('Eligible: Medicaid');
    await waitFor(() => expect(confirm).toHaveBeenCalledWith('V02'));
  });

  it('is read-only on a closed visit', () => {
    setData({ applies: true, derived: { code: 'V03' } });
    render(<VfcEligibilityBox encounterId="enc-1" readOnly />);
    expect(screen.getByTestId(dataTestIds.vfcEligibility.blank)).toHaveTextContent('Eligible: Uninsured');
    expect(screen.getByTestId(dataTestIds.vfcEligibility.blank)).not.toHaveAttribute('role', 'button');
    expect(screen.queryByTestId(dataTestIds.vfcEligibility.confirmButton)).not.toBeInTheDocument();
  });
});

describe('AdministrationConfirmationDialog - VFC eligibility not confirmed', () => {
  const save = vi.fn();
  const Dialog = ({ vfcUnconfirmed = true }: { vfcUnconfirmed?: boolean }): React.ReactElement => {
    const methods = useForm({ defaultValues: { otherReason: '', confirmVfc: true } });
    return (
      <FormProvider {...methods}>
        <AdministrationConfirmationDialog
          administrationType={ADMINISTERED}
          patientName="Nora Diaz"
          medicationName="Tdap"
          dose="0.5"
          unit="mL"
          route="Intramuscular"
          open
          handleClose={vi.fn()}
          handleConfirm={save}
          encounterId="enc-1"
          vfcUnconfirmed={vfcUnconfirmed}
        />
      </FormProvider>
    );
  };
  const markAdministered = (): void => {
    fireEvent.click(screen.getByRole('button', { name: 'Mark as Administered' }));
  };
  const checkbox = (): HTMLInputElement =>
    within(screen.getByTestId(dataTestIds.administrationConfirmationDialog.vfcConfirmCheckbox)).getByRole(
      'checkbox'
    ) as HTMLInputElement;

  beforeEach(() => {
    vi.clearAllMocks();
    confirm.mockResolvedValue({ applies: true });
  });

  it('confirms the pre-filled category when the box is ticked, then saves', async () => {
    setData({ applies: true, derived: { code: 'V02' } });
    render(<Dialog />);

    expect(screen.getByText("VFC eligibility isn't confirmed for this visit.")).toBeInTheDocument();
    expect(screen.getByText('Confirm VFC eligibility: Eligible: Medicaid')).toBeInTheDocument();
    expect(checkbox()).toBeChecked();
    markAdministered();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledWith('V02');
    expect(confirm.mock.invocationCallOrder[0]).toBeLessThan(save.mock.invocationCallOrder[0]);
  });

  it('saves without confirming when the box is unticked', async () => {
    setData({ applies: true, derived: { code: 'V02' } });
    render(<Dialog />);
    fireEvent.click(checkbox());
    expect(checkbox()).not.toBeChecked();
    markAdministered();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does not save when the confirmation fails', async () => {
    confirm.mockRejectedValue(new Error('nope'));
    setData({ applies: true, derived: { code: 'V02' } });
    render(<Dialog />);
    markAdministered();
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith('nope', { variant: 'error' }));
    expect(save).not.toHaveBeenCalled();
  });

  it('asks for a category at the top when nothing is pre-filled, and saves without confirming', async () => {
    setData({ applies: true });
    render(<Dialog />);
    expect(screen.getByText('Pick a category at the top.')).toBeInTheDocument();
    expect(
      screen.queryByTestId(dataTestIds.administrationConfirmationDialog.vfcConfirmCheckbox)
    ).not.toBeInTheDocument();
    markAdministered();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('shows no VFC part otherwise', async () => {
    setData({ applies: true, derived: { code: 'V02' } });
    render(<Dialog vfcUnconfirmed={false} />);
    expect(screen.queryByText("VFC eligibility isn't confirmed for this visit.")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(dataTestIds.administrationConfirmationDialog.vfcConfirmCheckbox)
    ).not.toBeInTheDocument();
    markAdministered();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(confirm).not.toHaveBeenCalled();
  });
});
