import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Patient } from 'fhir/r4b';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { GetPatientBalancesZambdaOutput } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { default as PatientBalances } from '../../src/components/PatientBalances';

// ============================================================================
// MOCKS
// ============================================================================

const mockExecute = vi.fn();

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: {
      zambda: {
        execute: mockExecute,
      },
    },
  }),
}));

vi.mock('../../src/components/dialogs/PaymentDialog', () => ({
  default: ({ open, patient, appointmentId, handleClose, isSubmitting, submitPayment }: any) => (
    <div data-testid="payment-dialog" data-open={open}>
      {open && (
        <div>
          <div data-testid="dialog-patient-id">{patient.id}</div>
          <div data-testid="dialog-patient-first">{patient.name?.[0]?.given?.[0]}</div>
          <div data-testid="dialog-patient-last">{patient.name?.[0]?.family}</div>
          <div data-testid="dialog-patient-dob">{patient.birthDate}</div>
          <div data-testid="dialog-patient-number">{patient.telecom?.[0]?.value}</div>
          <div data-testid="dialog-appointment-id">{appointmentId}</div>
          <div data-testid="dialog-is-submitting">{isSubmitting ? 'true' : 'false'}</div>
          <button data-testid="dialog-close" onClick={handleClose}>
            Close Dialog
          </button>
          <button
            data-testid="dialog-submit-cash"
            onClick={() =>
              submitPayment({
                paymentType: 'cash',
                amountCents: 12,
              })
            }
          >
            Submit Cash Payment
          </button>
          <button
            data-testid="dialog-submit-card"
            onClick={() =>
              submitPayment({
                paymentType: 'card',
                cardId: 'card-id',
                amountCents: 12,
              })
            }
          >
            Submit Card Payment
          </button>
          <button
            data-testid="dialog-submit-fail"
            onClick={() => {
              throw new Error('Payment submission failed');
            }}
          >
            Fail submission
          </button>
        </div>
      )}
    </div>
  ),
}));

vi.mock('../../src/components/RoundedButton', () => ({
  RoundedButton: ({ onClick, children }: any) => <button onClick={onClick}>{children}</button>,
}));

// HELPERS
// ============================================================================

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

const mockPatient: Patient = {
  resourceType: 'Patient',
  id: 'patient-id',
  name: [
    {
      family: 'Doe',
      given: ['John'],
    },
  ],
  birthDate: '2000-03-03',
  gender: 'male',
  telecom: [
    {
      system: 'phone',
      value: '+12025550123',
    },
  ],
};

const mockPatientBalances: GetPatientBalancesZambdaOutput = {
  totalBalanceCents: 300,
  pendingPaymentCents: 50,
  encounters: [
    {
      encounterId: 'encounter-1',
      appointmentId: 'appointment-1',
      encounterDate: '2026-01-01T12:00:00Z',
      patientBalanceCents: 100,
    },
    {
      encounterId: 'encounter-2',
      appointmentId: 'appointment-2',
      encounterDate: '2026-02-02T12:00:00Z',
      patientBalanceCents: 200,
    },
  ],
};

const mockHandleClose = vi.fn();

// ============================================================================
// TESTS
// ============================================================================

describe('PatientBalances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue({});
    mockHandleClose.mockResolvedValue({});
  });

  describe('Render correctly', () => {
    it('should display header', () => {
      render(
        <PatientBalances patient={mockPatient} patientBalances={mockPatientBalances} handleClose={mockHandleClose} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Outstanding Balance')).toBeInTheDocument();
      expect(screen.getByText('$2.50 ($0.50 pending)')).toBeInTheDocument();
    });

    it('should not show loading indicator', () => {
      render(
        <PatientBalances patient={mockPatient} patientBalances={mockPatientBalances} handleClose={mockHandleClose} />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('should display all encounters with correct data', () => {
      render(
        <PatientBalances patient={mockPatient} patientBalances={mockPatientBalances} handleClose={mockHandleClose} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('appointment-1')).toBeInTheDocument();
      expect(screen.getByText('01/01/2026')).toBeInTheDocument();
      expect(screen.getByText('$1.00')).toBeInTheDocument();
      const link1 = screen.getByText('appointment-1').closest('a');
      expect(link1).toHaveAttribute('href', '/visit/appointment-1');
      expect(link1).toHaveAttribute('target', '_blank');

      expect(screen.getByText('appointment-2')).toBeInTheDocument();
      expect(screen.getByText('02/02/2026')).toBeInTheDocument();
      expect(screen.getByText('$2.00')).toBeInTheDocument();
      const link2 = screen.getByText('appointment-2').closest('a');
      expect(link2).toHaveAttribute('href', '/visit/appointment-2');
      expect(link2).toHaveAttribute('target', '_blank');

      const payButtons = screen.getAllByText('Pay for visit');
      expect(payButtons).toHaveLength(2);
    });
  });

  describe('Payment Dialog', () => {
    it('should not show payment dialog by default', () => {
      render(
        <PatientBalances patient={mockPatient} patientBalances={mockPatientBalances} handleClose={mockHandleClose} />,
        { wrapper: createWrapper() }
      );

      const dialog = screen.getByTestId('payment-dialog');
      expect(dialog).toHaveAttribute('data-open', 'false');
    });

    it('should open payment dialog when "Pay for visit" is clicked', async () => {
      const user = userEvent.setup();

      render(
        <PatientBalances patient={mockPatient} patientBalances={mockPatientBalances} handleClose={mockHandleClose} />,
        { wrapper: createWrapper() }
      );

      const payButtons = screen.getAllByText('Pay for visit');
      await user.click(payButtons[0]);

      const dialog = screen.getByTestId('payment-dialog');
      expect(dialog).toHaveAttribute('data-open', 'true');
    });

    describe('should pass correct data to payment dialog', () => {
      it('encounter 1', async () => {
        const user = userEvent.setup();

        render(
          <PatientBalances patient={mockPatient} patientBalances={mockPatientBalances} handleClose={mockHandleClose} />,
          { wrapper: createWrapper() }
        );

        const payButtons = screen.getAllByText('Pay for visit');
        await user.click(payButtons[0]);

        expect(screen.getByTestId('dialog-patient-id')).toHaveTextContent('patient-id');
        expect(screen.getByTestId('dialog-patient-first')).toHaveTextContent('John');
        expect(screen.getByTestId('dialog-patient-last')).toHaveTextContent('Doe');
        expect(screen.getByTestId('dialog-patient-dob')).toHaveTextContent('2000-03-03');
        expect(screen.getByTestId('dialog-patient-number')).toHaveTextContent('+12025550123');
        expect(screen.getByTestId('dialog-appointment-id')).toHaveTextContent('appointment-1');
        expect(screen.getByTestId('dialog-is-submitting')).toHaveTextContent('false');
      });

      it('encounter 2', async () => {
        const user = userEvent.setup();

        render(
          <PatientBalances patient={mockPatient} patientBalances={mockPatientBalances} handleClose={mockHandleClose} />,
          { wrapper: createWrapper() }
        );

        const payButtons = screen.getAllByText('Pay for visit');
        await user.click(payButtons[1]);

        expect(screen.getByTestId('dialog-patient-id')).toHaveTextContent('patient-id');
        expect(screen.getByTestId('dialog-patient-first')).toHaveTextContent('John');
        expect(screen.getByTestId('dialog-patient-last')).toHaveTextContent('Doe');
        expect(screen.getByTestId('dialog-patient-dob')).toHaveTextContent('2000-03-03');
        expect(screen.getByTestId('dialog-patient-number')).toHaveTextContent('+12025550123');
        expect(screen.getByTestId('dialog-appointment-id')).toHaveTextContent('appointment-2');
        expect(screen.getByTestId('dialog-is-submitting')).toHaveTextContent('false');
      });
    });

    it('should close payment dialog when handleClose is called', async () => {
      const user = userEvent.setup();

      render(
        <PatientBalances patient={mockPatient} patientBalances={mockPatientBalances} handleClose={mockHandleClose} />,
        { wrapper: createWrapper() }
      );

      const payButtons = screen.getAllByText('Pay for visit');
      await user.click(payButtons[0]);

      const dialog = screen.getByTestId('payment-dialog');
      expect(dialog).toHaveAttribute('data-open', 'true');

      const closeButton = screen.getByTestId('dialog-close');
      await user.click(closeButton);

      await waitFor(() => {
        expect(dialog).toHaveAttribute('data-open', 'false');
      });
    });

    describe('payments', () => {
      it('should submit cash payment with correct data', async () => {
        const user = userEvent.setup();

        render(
          <PatientBalances patient={mockPatient} patientBalances={mockPatientBalances} handleClose={mockHandleClose} />,
          { wrapper: createWrapper() }
        );

        const payButtons = screen.getAllByText('Pay for visit');
        await user.click(payButtons[0]);

        const submitButton = screen.getByTestId('dialog-submit-cash');
        await user.click(submitButton);

        await waitFor(() => {
          expect(mockExecute).toHaveBeenCalledWith({
            id: 'patient-payments-post',
            patientId: 'patient-id',
            encounterId: 'encounter-1',
            paymentDetails: {
              paymentType: 'cash',
              amountCents: 12,
            },
          });
        });
      });

      it('should submit card payment with correct data', async () => {
        const user = userEvent.setup();

        render(
          <PatientBalances patient={mockPatient} patientBalances={mockPatientBalances} handleClose={mockHandleClose} />,
          { wrapper: createWrapper() }
        );

        const payButtons = screen.getAllByText('Pay for visit');
        await user.click(payButtons[0]);

        const submitButton = screen.getByTestId('dialog-submit-card');
        await user.click(submitButton);

        await waitFor(() => {
          expect(mockExecute).toHaveBeenCalledWith({
            id: 'patient-payments-post',
            patientId: 'patient-id',
            encounterId: 'encounter-1',
            paymentDetails: {
              paymentType: 'card',
              cardId: 'card-id',
              amountCents: 12,
            },
          });
        });
      });

      describe('after successful payment', () => {
        it('should refetch patient balances', async () => {
          const user = userEvent.setup();

          render(
            <PatientBalances
              patient={mockPatient}
              patientBalances={mockPatientBalances}
              handleClose={mockHandleClose}
            />,
            { wrapper: createWrapper() }
          );

          const payButtons = screen.getAllByText('Pay for visit');
          await user.click(payButtons[0]);

          const submitButton = screen.getByTestId('dialog-submit-cash');
          await user.click(submitButton);

          await waitFor(() => {
            expect(mockHandleClose).toHaveBeenCalled();
          });
        });

        it('should close payment dialog', async () => {
          const user = userEvent.setup();

          render(
            <PatientBalances
              patient={mockPatient}
              patientBalances={mockPatientBalances}
              handleClose={mockHandleClose}
            />,
            { wrapper: createWrapper() }
          );

          const payButtons = screen.getAllByText('Pay for visit');
          await user.click(payButtons[0]);

          const submitButton = screen.getByTestId('dialog-submit-cash');
          await user.click(submitButton);

          await waitFor(() => {
            const dialog = screen.getByTestId('payment-dialog');
            expect(dialog).toHaveAttribute('data-open', 'false');
          });
        });
      });
    });
  });
});
