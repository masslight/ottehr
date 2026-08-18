import { render, screen, waitFor } from '@testing-library/react';
import { InvoiceablePatientReport } from 'utils/lib/types/api/invoicing.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnqueueSnackbar = vi.fn();
const mockExecute = vi.fn();

vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: any[]) => mockEnqueueSnackbar(...args),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: {
      zambda: {
        execute: (...args: any[]) => mockExecute(...args),
      },
    },
  }),
}));

vi.mock('src/components/RoundedButton', () => ({
  RoundedButton: ({ children, onClick, disabled, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('utils/lib/statements/generate-statement', () => ({
  generateStatement: () => '<html>statement preview</html>',
}));

import SendStatementToPatientDialog from '../../src/components/dialogs/SendStatementToPatientDialog';

const MISSING_CLAIM_MESSAGE = 'No billing claim found for Encounter/enc-1, so a statement cannot be generated.';
const GENERIC_MESSAGE = 'Unable to load statement preview';

const report = {
  claimId: 'claim-1',
  finalizationDateISO: '2026-08-14',
  amountInvoiceable: 60,
  visitDate: '2026-08-14',
  location: 'Test Office',
  task: {
    resourceType: 'Task',
    id: 'task-1',
    encounter: {
      reference: 'Encounter/enc-1',
    },
  },
  patient: {
    patientId: 'patient-1',
    fullName: 'Test Patient',
    phoneNumber: '+15551234567',
  },
  responsibleParty: {
    fullName: 'Test Guarantor',
  },
} as unknown as InvoiceablePatientReport;

// The dialog fires three zambdas on open; only get-statement-details varies per case.
const respondWith = (statementDetails: () => Promise<unknown>): void => {
  mockExecute.mockImplementation(async ({ id }: { id: string }) => {
    if (id === 'get-statement-template') {
      return {
        output: {
          template: '<html></html>',
          fileName: 'statement-template',
          logoBase64: '',
        },
      };
    }
    if (id === 'get-statement-details') return statementDetails();
    if (id === 'get-statement-status') {
      return {
        output: {
          generated: {
            generated: false,
          },
          mailProcessor: {
            found: false,
          },
        },
      };
    }
    return { output: {} };
  });
};

const renderDialog = (): void => {
  render(<SendStatementToPatientDialog modalOpen={true} handleClose={vi.fn()} onSubmit={vi.fn()} report={report} />);
};

const generateButton = (): HTMLElement => screen.getByRole('button', { name: /Generate Statement/i });
const mailButton = (): HTMLElement => screen.getByRole('button', { name: /Send by Mail/i });

// the SDK rejects with an Error carrying the zambda's APIError code
const sdkError = (code: number, message: string): Error => Object.assign(new Error(message), { code });

describe('SendStatementToPatientDialog', () => {
  beforeEach(() => {
    mockEnqueueSnackbar.mockReset();
    mockExecute.mockReset();
  });

  it('surfaces the missing-claim message and blocks generating or mailing', async () => {
    respondWith(() => Promise.reject(sdkError(APIErrorCode.STATEMENT_BILLING_CLAIM_NOT_FOUND, MISSING_CLAIM_MESSAGE)));
    renderDialog();

    await waitFor(() => expect(screen.getByText(MISSING_CLAIM_MESSAGE)).toBeInTheDocument());
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(MISSING_CLAIM_MESSAGE, { variant: 'error' });
    expect(generateButton()).toBeDisabled();
    expect(mailButton()).toBeDisabled();
    expect(mockExecute).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'create-generate-statement-task' }));
  });

  it('keeps the generic message for any other failure', async () => {
    respondWith(() => Promise.reject(new Error('Guarantor resource not found for Patient/patient-1')));
    renderDialog();

    await waitFor(() => expect(screen.getByText(GENERIC_MESSAGE)).toBeInTheDocument());
    // internal failures stay in the console rather than on a biller's screen
    expect(screen.queryByText(/Guarantor resource not found/)).not.toBeInTheDocument();
    expect(generateButton()).toBeDisabled();
  });

  it('leaves the actions available once the preview loads', async () => {
    respondWith(() =>
      Promise.resolve({
        output: {
          service: [],
        },
      })
    );
    renderDialog();

    await waitFor(() => expect(generateButton()).toBeEnabled());
    expect(mailButton()).toBeEnabled();
    expect(screen.queryByText(GENERIC_MESSAGE)).not.toBeInTheDocument();
  });
});
