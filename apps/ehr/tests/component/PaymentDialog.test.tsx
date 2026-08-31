import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Patient } from 'fhir/r4b';
import { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// vi.hoisted runs before vi.mock factory evaluation, so shared state is available.
const { mockState, mockProcessPayment } = vi.hoisted(() => {
  return {
    mockState: { capturedTerminalProps: null as any },
    mockProcessPayment: { fn: null as any },
  };
});

vi.mock('../../src/components/CardReaderTerminal', async () => {
  const React = await import('react');
  const { vi: viInner } = await import('vitest');
  mockProcessPayment.fn = viInner.fn().mockResolvedValue(undefined);
  return {
    default: React.forwardRef((props: any, ref: any) => {
      mockState.capturedTerminalProps = props;
      React.useImperativeHandle(ref, () => ({
        processPayment: mockProcessPayment.fn,
      }));
      return React.createElement('div', { 'data-testid': 'card-reader-terminal' }, 'Card Reader Terminal Mock');
    }),
  };
});

vi.mock('../../src/components/SelectCreditCard', () => ({
  default: () => null,
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: { zambda: { execute: () => Promise.resolve({}) } },
  }),
}));

import PaymentDialog from '../../src/components/dialogs/PaymentDialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const testPatient: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
  name: [{ given: ['John'], family: 'Doe' }],
  birthDate: '1990-01-15',
  gender: 'male',
};

function Wrapper({ children }: { children: ReactNode }): ReactElement {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function renderPaymentDialog(overrides: Record<string, any> = {}) {
  const defaultProps = {
    open: true,
    patient: testPatient,
    encounterId: 'enc-1',
    appointmentId: 'appt-1',
    handleClose: vi.fn(),
    isSubmitting: false,
    submitPayment: vi.fn().mockResolvedValue(undefined),
    onTerminalPaymentSuccess: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  const result = render(
    <Wrapper>
      <PaymentDialog {...defaultProps} />
    </Wrapper>
  );

  return { ...result, ...defaultProps };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PaymentDialog - terminal payment race condition guards', () => {
  beforeEach(() => {
    mockState.capturedTerminalProps = null;
  });

  it('does not call submitPayment when card-reader is selected and config is still loading', async () => {
    const user = userEvent.setup();
    const { submitPayment } = renderPaymentDialog();

    // Select card-reader payment method
    const cardReaderRadio = screen.getByLabelText(/card reader/i);
    await user.click(cardReaderRadio);

    // Wait for CardReaderTerminal mock to render
    await screen.findByTestId('card-reader-terminal');

    // Simulate the terminal reporting that config is loading
    await act(async () => {
      mockState.capturedTerminalProps.onConfigLoadingChange(true);
      mockState.capturedTerminalProps.onTerminalConfiguredChange(false);
    });

    // Fill in a valid amount
    const amountInput = screen.getByPlaceholderText(/enter amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, '25.00');

    // The submit button should be disabled while config is loading
    const submitButton = screen.getByTestId('cancel-visit-dialogue');
    expect(submitButton).toBeDisabled();

    // Even if somehow submitted (e.g., programmatic form submit), submitPayment should not be called
    // We can't click because pointer-events:none, but we can fire submit on the form directly
    const form = submitButton.closest('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    // submitPayment should NOT have been called — the guard should block it
    expect(submitPayment).not.toHaveBeenCalled();
  });

  it('does not allow a second terminal submission while payment is in progress', async () => {
    const user = userEvent.setup();
    const { submitPayment } = renderPaymentDialog();

    // Make processPayment block indefinitely (simulates waiting for card tap)
    let resolvePayment: () => void;
    mockProcessPayment.fn.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePayment = resolve;
        })
    );

    // Select card-reader payment method
    const cardReaderRadio = screen.getByLabelText(/card reader/i);
    await user.click(cardReaderRadio);

    // Wait for CardReaderTerminal mock to render
    await screen.findByTestId('card-reader-terminal');

    // Simulate terminal configured and reader connected
    await act(async () => {
      mockState.capturedTerminalProps.onConfigLoadingChange(false);
      mockState.capturedTerminalProps.onTerminalConfiguredChange(true);
      mockState.capturedTerminalProps.onReaderConnectionChange(true);
    });

    // Fill in a valid amount
    const amountInput = screen.getByPlaceholderText(/enter amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, '25.00');

    // First submit — starts the terminal payment (processPayment blocks)
    const submitButton = screen.getByTestId('cancel-visit-dialogue');
    await user.click(submitButton);

    // processPayment should have been called once
    await waitFor(() => {
      expect(mockProcessPayment.fn).toHaveBeenCalledTimes(1);
    });

    // Second submit while first is still in-progress — should be blocked by the guard
    const form = submitButton.closest('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    // processPayment should NOT have been called a second time
    expect(mockProcessPayment.fn).toHaveBeenCalledTimes(1);
    // submitPayment (external path) should also not be called
    expect(submitPayment).not.toHaveBeenCalled();

    // Clean up: resolve the pending payment to avoid unhandled promise warnings
    await act(async () => {
      resolvePayment!();
    });
  });

  it('submit button is disabled while config is loading for card-reader', async () => {
    const user = userEvent.setup();
    renderPaymentDialog();

    // Select card-reader payment method
    const cardReaderRadio = screen.getByLabelText(/card reader/i);
    await user.click(cardReaderRadio);

    // Wait for CardReaderTerminal mock to render
    await screen.findByTestId('card-reader-terminal');

    // Simulate config loading
    await act(async () => {
      mockState.capturedTerminalProps.onConfigLoadingChange(true);
      mockState.capturedTerminalProps.onTerminalConfiguredChange(false);
    });

    const submitButton = screen.getByTestId('cancel-visit-dialogue');
    expect(submitButton).toBeDisabled();
  });

  it('calls submitPayment with external-card-reader when terminal is NOT configured and config finished loading', async () => {
    const user = userEvent.setup();
    const { submitPayment } = renderPaymentDialog();

    // Select card-reader payment method
    const cardReaderRadio = screen.getByLabelText(/card reader/i);
    await user.click(cardReaderRadio);

    // Wait for CardReaderTerminal mock to render
    await screen.findByTestId('card-reader-terminal');

    // Simulate config done loading but terminal NOT configured (no Stripe terminal at location)
    await act(async () => {
      mockState.capturedTerminalProps.onConfigLoadingChange(false);
      mockState.capturedTerminalProps.onTerminalConfiguredChange(false);
    });

    // Fill in a valid amount
    const amountInput = screen.getByPlaceholderText(/enter amount/i);
    await user.clear(amountInput);
    await user.type(amountInput, '25.00');

    // Submit the form
    const submitButton = screen.getByTestId('cancel-visit-dialogue');
    await user.click(submitButton);

    // Should call submitPayment with external-card-reader method
    await waitFor(() => {
      expect(submitPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethod: 'external-card-reader',
          amountInCents: 2500,
        })
      );
    });
  });
});
