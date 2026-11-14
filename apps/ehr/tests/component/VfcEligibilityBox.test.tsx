import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DateTime } from 'luxon';
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
import { VfcEligibilityBox, VfcUnconfirmedDialog } from '../../src/features/immunization/components/VfcEligibilityBox';

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

describe('VfcUnconfirmedDialog', () => {
  const onContinue = vi.fn();
  const renderDialog = (): void => {
    render(
      <VfcUnconfirmedDialog
        open
        encounterId="enc-1"
        patientFirstName="Nora"
        onClose={vi.fn()}
        onContinue={onContinue}
      />
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    confirm.mockResolvedValue({ applies: true });
  });

  it('confirms the pre-filled category, then continues', async () => {
    setData({ applies: true, derived: { code: 'V02' } });
    renderDialog();

    expect(screen.getByText("VFC eligibility isn't confirmed")).toBeInTheDocument();
    expect(
      screen.getByText("Nora is getting VFC stock, but VFC eligibility hasn't been confirmed for this visit.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and continue' }));
    await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledWith('V02');
  });

  it('continues without confirming', () => {
    setData({ applies: true, derived: { code: 'V02' } });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does not continue when the confirmation fails', async () => {
    confirm.mockRejectedValue(new Error('nope'));
    setData({ applies: true, derived: { code: 'V02' } });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and continue' }));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('asks for a category at the top when nothing is pre-filled', () => {
    setData({ applies: true });
    renderDialog();
    expect(screen.getByText(/Pick a category at the top\.$/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm and continue' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });
});
