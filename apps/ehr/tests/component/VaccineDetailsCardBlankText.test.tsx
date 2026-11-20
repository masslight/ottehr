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

vi.mock('src/features/visits/shared/components/QuickPickSaveDialogs', () => ({ QuickPickSaveDialogs: () => <div /> }));
vi.mock('src/features/immunization/hooks/useImmunizationQuickPickManagement', () => ({
  useImmunizationQuickPickManagement: () => quickPickState,
}));
vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));
vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ mappedData: {}, resources: { patient: { resourceType: 'Patient', id: 'patient-1' } } }),
}));
vi.mock('src/features/visits/shared/hooks/useOystehrAPIClient', () => ({ useOystehrAPIClient: () => ({}) }));
vi.mock('src/hooks/useGetPatient', () => ({
  useGetPatientAccount: ({ patientId }: { patientId: string | null }) => ({
    data: patientId
      ? {
          emergencyContactResource: {
            resourceType: 'RelatedPerson',
            patient: { reference: 'Patient/patient-1' },
            relationship: [
              { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0131', code: 'EP', display: 'Parent' }] },
            ],
            name: [{ given: ['Martin'], family: 'Black' }],
            telecom: [{ system: 'phone', value: '+11234567890' }],
          },
        }
      : undefined,
    isError: false,
  }),
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
// The sentences show their errors and what they hold, and can have a quick pick picked in them; the card's own
// sentence (the emergency contact) renders inside.
vi.mock('src/features/immunization/components/ImmunizationSentences', () => ({
  ImmunizationSectionLabel: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  ImmunizationSentences: ({ values, errors, onQuickPick, needAdministration, children }: any) => (
    <div
      data-testid="immunization-sentences"
      data-vaccine={values.details.medication?.name ?? ''}
      data-dose={values.details.dose ?? ''}
      data-instructions={values.details.instructions ?? ''}
      data-manufacturer={values.details.manufacturer ?? ''}
      data-lot={values.administrationDetails.lot ?? ''}
      data-mvx={values.administrationDetails.mvx ?? ''}
      data-given={values.administrationDetails.administeredDateTime ?? ''}
      data-need-administration={String(Boolean(needAdministration))}
    >
      {errors.length > 0 && <p data-testid="sentences-errors">{errors.join('. ')}</p>}
      <button
        type="button"
        onClick={() =>
          onQuickPick({
            name: 'MMR box',
            vaccine: { id: '03', name: 'MMR' },
            dose: '9',
            manufacturer: 'Merck and Co., Inc.',
            mvx: 'MSD',
            lot: 'QP-LOT',
          })
        }
      >
        Pick the quick pick
      </button>
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
          <button type="button" onClick={handleConfirm}>
            Confirm
          </button>
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

// A vaccine from the vaccine list: its id is its CVX code.
const TDAP = { id: '115', name: 'Tdap' };
const LEGACY_VACCINE = { id: 'a3f1c2d4-0000-4000-8000-000000000001', name: 'Tdap (Adacel/Boostrix)' };

const ORDER_DETAILS = {
  medication: TDAP,
  dose: '0.5',
  units: 'ml',
  instructions: 'After consent',
  orderedProvider: { id: 'prov-1', name: 'Dr. Test' },
};

const COMPLETE_ADMINISTRATION = {
  ndc: '58160-0842-11',
  mvx: 'SKB',
  expDate: '2027-01-31',
  visGiven: true,
  visGivenDate: '2026-11-10',
};

const renderCard = (
  lot: string,
  administrationDetails: Record<string, unknown> = COMPLETE_ADMINISTRATION,
  details: Record<string, unknown> = ORDER_DETAILS
): void => {
  render(
    <VaccineDetailsCard
      order={
        {
          id: 'order-1',
          status: 'pending',
          encounterId: 'enc-1',
          details: { ...details, orderedDateTime: '2026-11-09T10:00:00Z' },
          administrationDetails: {
            lot,
            cvx: '115',
            administeredProvider: { id: '', name: '' },
            emergencyContact: { relationship: 'parent', fullName: 'Old Contact', mobile: '+12025550178' },
            ...administrationDetails,
          },
        } as any
      }
      onFinished={vi.fn()}
    />
  );
};

const sentences = (): HTMLElement => screen.getByTestId('immunization-sentences');

describe('VaccineDetailsCard - emergency contact', () => {
  it("shows the patient's emergency contact read-only on a pending order", () => {
    renderCard('L1');

    expect(screen.getByTestId('vaccine-emergency-contact')).toHaveTextContent('Parent | Martin Black | (123) 456-7890');
    expect(screen.queryByRole('textbox', { name: /full name/i })).not.toBeInTheDocument();
  });
});

describe('VaccineDetailsCard - the order as sentences', () => {
  it('shows the order under an Order heading, with the administration blanks marked as needed', () => {
    renderCard('L1');

    expect(screen.getByRole('heading', { name: 'Order' })).toBeInTheDocument();
    expect(sentences()).toHaveAttribute('data-vaccine', 'Tdap');
    expect(sentences()).toHaveAttribute('data-lot', 'L1');
    expect(sentences()).toHaveAttribute('data-need-administration', 'true');
  });

  it('takes the dose as given now when the order has no administered date', () => {
    renderCard('L1');

    const given = Date.parse(sentences().getAttribute('data-given') ?? '');
    expect(Math.abs(given - Date.now())).toBeLessThan(60_000);
  });

  it('a quick pick fills only what is recorded at administration: the order stays as it was placed', async () => {
    renderCard('L1');

    await userEvent.click(screen.getByRole('button', { name: 'Pick the quick pick' }));

    expect(sentences()).toHaveAttribute('data-lot', 'QP-LOT');
    expect(sentences()).toHaveAttribute('data-manufacturer', 'Merck and Co., Inc.');
    expect(sentences()).toHaveAttribute('data-mvx', 'MSD');
    expect(sentences()).toHaveAttribute('data-vaccine', 'Tdap');
    expect(sentences()).toHaveAttribute('data-dose', '0.5');
    expect(sentences()).toHaveAttribute('data-instructions', 'After consent');
  });
});

describe('VaccineDetailsCard - blank administration text', () => {
  beforeEach(() => {
    administerOrder.mockReset();
  });

  it('treats a whitespace-only LOT number as missing when administering', async () => {
    renderCard('   ');

    await userEvent.click(screen.getByRole('button', { name: 'Administered' }));

    expect(await screen.findByTestId('sentences-errors')).toHaveTextContent('Enter the lot number');
    expect(screen.queryByTestId('administration-confirmation-dialog')).not.toBeInTheDocument();
  });

  it('opens the confirmation when the LOT number has text', async () => {
    renderCard(' L1 ');

    await userEvent.click(screen.getByRole('button', { name: 'Administered' }));

    expect(await screen.findByTestId('administration-confirmation-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('sentences-errors')).not.toBeInTheDocument();
  });

  it('requires the lot, expiration date, NDC code, manufacturer and VIS date to administer, and lists what is missing', async () => {
    renderCard('', { visGiven: false });

    await userEvent.click(screen.getByRole('button', { name: 'Partly Administered' }));

    expect(await screen.findByTestId('sentences-errors')).toHaveTextContent(
      /^Enter the lot number\. Enter the expiration date\. Enter the NDC code\. Pick the manufacturer from the list\. Enter the date the VIS was given$/
    );
    expect(screen.queryByTestId('administration-confirmation-dialog')).not.toBeInTheDocument();
  });

  it('does not require CPT codes to administer', async () => {
    renderCard('L1', { ...COMPLETE_ADMINISTRATION, cptCodes: [] });

    await userEvent.click(screen.getByRole('button', { name: 'Administered' }));

    expect(await screen.findByTestId('administration-confirmation-dialog')).toBeInTheDocument();
  });

  it('does not require the administration details to mark the order not administered', async () => {
    renderCard('', { visGiven: false });

    await userEvent.click(screen.getByRole('button', { name: 'Not Administered' }));

    expect(await screen.findByTestId('administration-confirmation-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('sentences-errors')).not.toBeInTheDocument();
  });

  it('still requires the order itself to mark it not administered', async () => {
    renderCard('', { visGiven: false }, { ...ORDER_DETAILS, dose: '' });

    await userEvent.click(screen.getByRole('button', { name: 'Not Administered' }));

    expect(await screen.findByTestId('sentences-errors')).toHaveTextContent(/^Enter the dose$/);
    expect(screen.queryByTestId('administration-confirmation-dialog')).not.toBeInTheDocument();
  });

  it('administers with the form as it stands, and sends no CVX code or emergency contact', async () => {
    renderCard('L1');

    await userEvent.click(screen.getByRole('button', { name: 'Administered' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(administerOrder).toHaveBeenCalledTimes(1));
    const request = administerOrder.mock.calls[0][0];
    expect(request).toEqual({
      orderId: 'order-1',
      type: 'administered',
      reason: undefined,
      details: ORDER_DETAILS,
      administrationDetails: {
        lot: 'L1',
        ...COMPLETE_ADMINISTRATION,
        administeredDateTime: sentences().getAttribute('data-given'),
      },
    });
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
      administrationDetails: { ndc: '58160-0842-11', mvx: 'SKB' },
    });
    // the blank lot is left out
    expect(administerOrder.mock.calls[0][0].administrationDetails.lot).toBeUndefined();
  });
});

describe('VaccineDetailsCard - an order placed before the vaccine list', () => {
  const legacyDetails = { ...ORDER_DETAILS, medication: LEGACY_VACCINE };

  it('asks for a vaccine from the list when no CVX code was saved with the order', async () => {
    renderCard('L1', { ...COMPLETE_ADMINISTRATION, cvx: '' }, legacyDetails);

    await userEvent.click(screen.getByRole('button', { name: 'Administered' }));

    expect(await screen.findByTestId('sentences-errors')).toHaveTextContent(
      /^Pick the immunization from the list: this one has no CVX code$/
    );
    expect(screen.queryByTestId('administration-confirmation-dialog')).not.toBeInTheDocument();
  });

  it('administers with the CVX code that was typed on the order', async () => {
    renderCard('L1', { ...COMPLETE_ADMINISTRATION, cvx: '140' }, legacyDetails);

    await userEvent.click(screen.getByRole('button', { name: 'Administered' }));

    expect(await screen.findByTestId('administration-confirmation-dialog')).toBeInTheDocument();
  });

  it('can be marked not administered without a CVX code', async () => {
    renderCard('L1', { ...COMPLETE_ADMINISTRATION, cvx: '' }, legacyDetails);

    await userEvent.click(screen.getByRole('button', { name: 'Not Administered' }));

    expect(await screen.findByTestId('administration-confirmation-dialog')).toBeInTheDocument();
  });
});
