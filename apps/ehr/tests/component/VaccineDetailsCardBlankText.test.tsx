import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { administerOrder } = vi.hoisted(() => ({ administerOrder: vi.fn() }));

const quickPickState = {
  mergedQuickPicks: [],
  mergedQuickPicksLoading: false,
  quickPickDialogOpen: false,
  setQuickPickDialogOpen: vi.fn(),
  quickPickName: '',
  setQuickPickName: vi.fn(),
  existingQuickPicks: [],
  quickPickSaving: false,
  onQuickPickSelect: vi.fn(),
  openQuickPickDialog: vi.fn(),
  onSaveAsQuickPick: vi.fn(),
};

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<object>('react-router-dom')),
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 'appointment-1' }),
}));

vi.mock('src/features/visits/shared/components/QuickPicksButton', () => ({ QuickPicksButton: () => <div /> }));
vi.mock('src/features/visits/shared/components/QuickPickSaveDialogs', () => ({ QuickPickSaveDialogs: () => <div /> }));
vi.mock('src/features/immunization/hooks/useImmunizationQuickPickManagement', () => ({
  useImmunizationQuickPickManagement: () => quickPickState,
}));
vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));
vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ mappedData: {} }),
}));
vi.mock('src/features/visits/in-person/hooks/useImmunization', () => ({
  useAdministerImmunizationOrder: () => ({ mutateAsync: administerOrder }),
  useCancelImmunizationOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ hasRole: () => false }) }));
vi.mock('src/components/dialogs/CustomDialog', () => ({ CustomDialog: () => <div /> }));
vi.mock('src/components/input/CheckboxInput', () => ({ CheckboxInput: () => <div /> }));
vi.mock('src/components/input/CptCodesInput', () => ({ CptCodesInput: () => <div /> }));
vi.mock('src/components/input/DateInput', () => ({ DateInput: () => <div /> }));
vi.mock('src/components/input/TimeInput', () => ({ TimeInput: () => <div /> }));
vi.mock('src/components/input/PhoneInput', () => ({ PhoneInput: () => <div /> }));
vi.mock('src/components/input/SelectInput', () => ({ SelectInput: () => <div /> }));
vi.mock('src/features/visits/in-person/components/RoundedButton', () => ({
  ButtonRounded: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));
vi.mock('src/features/immunization/components/OrderDetailsSection', () => ({ OrderDetailsSection: () => <div /> }));
vi.mock('src/features/immunization/components/OrderStatusChip', () => ({ OrderStatusChip: () => <div /> }));
vi.mock('src/features/immunization/components/AdministrationConfirmationDialog', async () => {
  const { useFormContext } = await vi.importActual<typeof import('react-hook-form')>('react-hook-form');
  return {
    AdministrationConfirmationDialog: ({ open, handleConfirm }: { open: boolean; handleConfirm: () => void }) => {
      const { setValue } = useFormContext();
      return open ? (
        <div data-testid="administration-confirmation-dialog">
          <button
            type="button"
            onClick={() => {
              setValue('reason', 'patient-refused');
              setValue('otherReason', '   ');
              handleConfirm();
            }}
          >
            Confirm refused after blank other reason
          </button>
        </div>
      ) : null;
    },
  };
});

import { VaccineDetailsCard } from '../../src/features/immunization/components/VaccineDetailsCard';

const renderCard = (lot: string): void => {
  render(
    <VaccineDetailsCard
      order={
        {
          id: 'order-1',
          status: 'pending',
          details: {},
          administrationDetails: { lot, ndc: '58160-0842-11', mvx: 'SKB', cvx: '115' },
        } as any
      }
      onFinished={vi.fn()}
    />
  );
};

describe('VaccineDetailsCard - blank administration text', () => {
  beforeEach(() => {
    administerOrder.mockReset();
  });

  it('treats a whitespace-only LOT number as missing when administering', async () => {
    renderCard('   ');

    await userEvent.click(screen.getByRole('button', { name: 'Administered' }));

    expect(await screen.findByText(REQUIRED_FIELD_ERROR_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByTestId('administration-confirmation-dialog')).not.toBeInTheDocument();
  });

  it('opens the confirmation when the LOT number has text', async () => {
    renderCard(' L1 ');

    await userEvent.click(screen.getByRole('button', { name: 'Administered' }));

    expect(await screen.findByTestId('administration-confirmation-dialog')).toBeInTheDocument();
    expect(screen.queryByText(REQUIRED_FIELD_ERROR_MESSAGE)).not.toBeInTheDocument();
  });

  it('does not let a whitespace-only other reason replace the selected reason', async () => {
    renderCard('');

    await userEvent.click(screen.getByRole('button', { name: 'Not Administered' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm refused after blank other reason' }));

    await waitFor(() => expect(administerOrder).toHaveBeenCalledTimes(1));
    expect(administerOrder.mock.calls[0][0]).toMatchObject({ type: 'administered-not', reason: 'patient-refused' });
  });
});
