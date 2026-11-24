import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ClaimDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE } from 'utils/lib/types/data/billing/claim-status';
import { describe, expect, it, vi } from 'vitest';
import { ClaimInvoicesSection } from '../../src/components/ClaimInvoicesSection';

vi.mock('../../src/hooks/useInvoicingInBillingApp', () => ({ useInvoicingInBillingApp: () => true }));

describe('ClaimInvoicesSection', () => {
  it("lists the claim's invoices and lets an invoiced claim send another", () => {
    const claim = {
      id: 'claim-1',
      balance: 3.5,
      statuses: { arStage: AR_STAGE.patient, patientArStatus: 'invoiced' },
      invoices: [
        {
          id: 'inv-1',
          status: 'cancelled',
          issueDate: '2026-10-29T12:00:00.000Z',
          dueDate: '2026-11-05',
          amount: 3.5,
          hostedInvoiceUrl: 'https://pay.test/in_1',
          kind: 'patient',
          pastDue: false,
        },
      ],
    } as ClaimDetailResponse;

    render(
      <MemoryRouter>
        <ClaimInvoicesSection claim={claim} refetchClaim={vi.fn()} />
      </MemoryRouter>
    );

    const row = within(screen.getByText('Void').closest('tr')!);
    expect(row.getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '10/29/2026',
      '11/05/2026',
      'Void',
      'View',
      '$3.50',
    ]);
    expect(row.getByRole('link', { name: 'View' })).toHaveAttribute('href', 'https://pay.test/in_1');
    expect(screen.getByRole('button', { name: 'Send Invoice' })).toBeEnabled();
  });

  it('links an NIO invoice to its details page and shows it past due', () => {
    const claim = {
      id: 'claim-1',
      balance: 150,
      statuses: {
        arStage: AR_STAGE.nonInsurancePayer,
        nonInsuranceArStatus: 'invoiced',
      },
      invoices: [
        {
          id: 'inv-nio',
          status: 'issued',
          issueDate: '2026-11-10T12:00:00.000Z',
          dueDate: '2026-11-17',
          amount: 150,
          kind: 'nio',
          pastDue: true,
        },
      ],
    } as ClaimDetailResponse;

    render(
      <MemoryRouter>
        <ClaimInvoicesSection claim={claim} refetchClaim={vi.fn()} />
      </MemoryRouter>
    );

    const row = within(screen.getByText('Past due').closest('tr')!);
    const view = row.getByRole('link', { name: 'View' });
    expect(view).toHaveAttribute('href', '/invoices/inv-nio');
    expect(row.getByText('$150.00')).toBeInTheDocument();
  });
});
