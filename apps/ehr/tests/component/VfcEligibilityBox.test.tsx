import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import { VfcEligibilityBox } from '../../src/features/immunization/components/VfcEligibilityBox';

const setData = (data: VfcEligibilityResponse | undefined): void => {
  eligibility.data = data;
};

describe('VfcEligibilityBox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirm.mockResolvedValue({ applies: true });
  });

  it('shows nothing for a patient VFC does not apply to', () => {
    setData({ applies: false });
    render(<VfcEligibilityBox encounterId="enc-1" variant="card" />);
    expect(screen.queryByTestId(dataTestIds.vfcEligibility.box)).not.toBeInTheDocument();
  });

  it('offers what the paperwork says and confirms it with one click', async () => {
    setData({
      applies: true,
      derived: { code: 'V02', why: '"I have Medicaid insurance coverage" is checked in the paperwork.' },
    });
    render(<VfcEligibilityBox encounterId="enc-1" variant="card" />);

    expect(screen.getByText('Not confirmed')).toBeInTheDocument();
    expect(screen.getByText(/From today's paperwork: "I have Medicaid insurance coverage"/)).toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.vfcEligibility.select)).toHaveValue('V02');

    fireEvent.click(screen.getByTestId(dataTestIds.vfcEligibility.confirmButton));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith('V02'));
  });

  it('lets staff pick another category (American Indian / Alaska Native, Underinsured) before confirming', async () => {
    setData({
      applies: true,
      derived: { code: 'V01', why: 'Insurance is on file and the Medicaid checkbox is not checked.' },
    });
    render(<VfcEligibilityBox encounterId="enc-1" variant="strip" />);

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'VFC eligibility' }));
    fireEvent.click(within(screen.getByRole('listbox')).getByText(/American Indian or Alaska Native/));
    expect(screen.getByText(/VFC eligible in any circumstance/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(dataTestIds.vfcEligibility.confirmButton));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith('V04'));
  });

  it('waits for a pick when the paperwork says nothing', () => {
    setData({ applies: true });
    render(<VfcEligibilityBox encounterId="enc-1" variant="strip" />);
    expect(screen.getByText(/The paperwork does not say yet/)).toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.vfcEligibility.confirmButton)).toBeDisabled();
  });

  it('shows the confirmation with who and when, and lets staff change it', () => {
    setData({
      applies: true,
      derived: { code: 'V02', why: 'Medicaid.' },
      confirmed: { code: 'V02', confirmedAt: '2026-11-11T14:05:00.000Z', confirmedBy: 'J. Ortiz' },
    });
    render(<VfcEligibilityBox encounterId="enc-1" variant="strip" />);

    expect(screen.getByTestId(dataTestIds.vfcEligibility.confirmed)).toHaveTextContent('VFC: Medicaid (V02)');
    expect(screen.getByText(/J\. Ortiz/)).toBeInTheDocument();
    expect(screen.queryByTestId(dataTestIds.vfcEligibility.confirmButton)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByTestId(dataTestIds.vfcEligibility.select)).toHaveValue('V02');
    expect(screen.getByTestId(dataTestIds.vfcEligibility.confirmButton)).toBeInTheDocument();
  });

  it('is read-only on a closed visit', () => {
    setData({ applies: true, derived: { code: 'V03', why: 'Self-pay.' } });
    render(<VfcEligibilityBox encounterId="enc-1" variant="strip" readOnly />);
    expect(screen.getByTestId(dataTestIds.vfcEligibility.confirmButton)).toBeDisabled();
  });
});
