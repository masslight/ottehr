import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
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
vi.mock('src/features/immunization/hooks/useVaccineInventory', () => ({
  useVfcEligibility: () => ({ data: undefined, isLoading: false }),
  useConfirmVfcEligibility: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useVaccineLotsOnHand: () => ({ data: [] }),
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ mappedData: {}, resources: {} }),
}));
vi.mock('src/features/visits/in-person/hooks/useImmunization', () => ({
  useAdministerImmunizationOrder: () => ({ mutateAsync: administerOrder }),
  useCancelImmunizationOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ hasRole: () => false }) }));
vi.mock('src/components/dialogs/CustomDialog', () => ({ CustomDialog: () => <div /> }));
vi.mock('src/components/AccordionCard', () => ({
  AccordionCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('src/features/visits/in-person/components/RoundedButton', () => ({
  ButtonRounded: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));
vi.mock('src/features/immunization/components/OrderStatusChip', () => ({ OrderStatusChip: () => <div /> }));
// The line shows its errors and what it holds; the card's own sentences (the emergency contact) render inside it.
vi.mock('src/features/immunization/components/ImmunizationSentences', () => ({
  ImmunizationSectionLabel: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  ImmunizationSentences: ({ line, errors, children }: any) => (
    <div data-testid="immunization-line" data-lot={line.administrationDetails.lot ?? ''}>
      {errors.length > 0 && <p data-testid="line-errors">{errors.join('. ')}</p>}
      {children}
    </div>
  ),
}));
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

const ORDER_DETAILS = {
  medication: { id: 'vac-1', name: 'Tdap' },
  dose: '0.5',
  units: 'ml',
  orderedProvider: { id: 'prov-1', name: 'Dr. Test' },
};

const COMPLETE_ADMINISTRATION = {
  ndc: '58160-0842-11',
  mvx: 'SKB',
  cvx: '115',
  expDate: '2027-01-31',
  visGiven: true,
  visGivenDate: '2026-11-10',
};

const renderCard = (lot: string, administrationDetails: Record<string, unknown> = COMPLETE_ADMINISTRATION): void => {
  render(
    <VaccineDetailsCard
      order={
        {
          id: 'order-1',
          status: 'pending',
          encounterId: 'enc-1',
          details: ORDER_DETAILS,
          administrationDetails: { lot, ...administrationDetails },
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

    expect(await screen.findByTestId('line-errors')).toHaveTextContent('Enter the lot number');
    expect(screen.queryByTestId('administration-confirmation-dialog')).not.toBeInTheDocument();
  });

  it('opens the confirmation when the LOT number has text', async () => {
    renderCard(' L1 ');

    await userEvent.click(screen.getByRole('button', { name: 'Administered' }));

    expect(await screen.findByTestId('administration-confirmation-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('line-errors')).not.toBeInTheDocument();
  });

  it('requires every administration detail to administer, and lists what is missing', async () => {
    renderCard('', { visGiven: false });

    await userEvent.click(screen.getByRole('button', { name: 'Partly Administered' }));

    expect(await screen.findByTestId('line-errors')).toHaveTextContent(
      'Enter the lot number. Enter the expiration date. Enter the NDC code. This vaccine has no CVX code in its setup. Enter the MVX code. ' +
        'Confirm the VIS was given to the patient. Enter the VIS date'
    );
    expect(screen.queryByTestId('administration-confirmation-dialog')).not.toBeInTheDocument();
  });

  it('does not require the administration details to mark the order not administered', async () => {
    renderCard('', { visGiven: false });

    await userEvent.click(screen.getByRole('button', { name: 'Not Administered' }));

    expect(await screen.findByTestId('administration-confirmation-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('line-errors')).not.toBeInTheDocument();
  });

  it('does not let a whitespace-only other reason replace the selected reason', async () => {
    renderCard('');

    await userEvent.click(screen.getByRole('button', { name: 'Not Administered' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm refused after blank other reason' }));

    await waitFor(() => expect(administerOrder).toHaveBeenCalledTimes(1));
    expect(administerOrder.mock.calls[0][0]).toMatchObject({
      orderId: 'order-1',
      type: 'administered-not',
      reason: 'patient-refused',
      details: ORDER_DETAILS,
      administrationDetails: { ndc: '58160-0842-11', mvx: 'SKB', cvx: '115' },
    });
    // the blank lot and the empty emergency contact are left out, as the form's cleanup did
    expect(administerOrder.mock.calls[0][0].administrationDetails.lot).toBeUndefined();
    expect(administerOrder.mock.calls[0][0].administrationDetails.emergencyContact).toBeUndefined();
  });

  it('asks for the whole emergency contact once any of it is filled', async () => {
    renderCard(' L1 ');
    const user = userEvent.setup();

    await user.type(screen.getByTestId('fullName'), 'Pat Parent');
    await user.click(screen.getByRole('button', { name: 'Administered' }));

    expect(await screen.findByTestId('line-errors')).toHaveTextContent(
      'Complete all emergency contact fields or leave them all empty'
    );
    expect(screen.queryByTestId('administration-confirmation-dialog')).not.toBeInTheDocument();
  });
});
