import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BillingInvoiceListItem } from 'utils/lib/types/data/billing/billing.types';
import { describe, expect, it, vi } from 'vitest';
import { InvoiceStatementDialog } from '../../src/components/InvoiceStatementDialog';

const { getStatementMock, createStatementMock } = vi.hoisted(() => ({
  getStatementMock: vi.fn(),
  createStatementMock: vi.fn(),
}));

vi.mock('../../src/api/api', () => ({
  getBillingInvoiceStatement: getStatementMock,
  createBillingInvoiceStatement: createStatementMock,
}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

describe('InvoiceStatementDialog', () => {
  it('previews the statement and starts a new one', async () => {
    getStatementMock.mockResolvedValue({
      html: '<p>Statement</p>',
      generatedAt: '2026-10-29T16:00:00.000Z',
      pdfUrl: 'https://signed.test/statement.pdf',
    });
    createStatementMock.mockResolvedValue({});
    const onClose = vi.fn();

    render(
      <InvoiceStatementDialog
        invoice={{ id: 'inv-1', patientName: 'Patientlastname, Sam' } as BillingInvoiceListItem}
        onClose={onClose}
      />
    );

    expect(await screen.findByTitle('Statement preview')).toHaveAttribute('srcdoc', '<p>Statement</p>');
    expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
      'href',
      'https://signed.test/statement.pdf'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Statement' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(getStatementMock).toHaveBeenCalledWith(expect.anything(), { invoiceId: 'inv-1' });
    expect(createStatementMock).toHaveBeenCalledWith(expect.anything(), { invoiceId: 'inv-1' });
  });
});
