import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { EraDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ManualRemit from '../../src/pages/ManualRemit';

const { api, oystehrZambdaStub } = vi.hoisted(() => ({
  api: {
    getBillingEraDetail: vi.fn(),
    saveBillingManualEra: vi.fn(),
    searchBillingEras: vi.fn(),
    addEraAttachment: vi.fn(),
    deleteEraAttachment: vi.fn(),
    downloadEraAttachment: vi.fn(),
    renameEraAttachment: vi.fn(),
    unmatchClaimResponse: vi.fn(),
    uploadFileToPresignedUrl: vi.fn(),
    getBillingClaimDetail: vi.fn(),
    searchBillingClaims: vi.fn(),
    matchClaimResponseToClaim: vi.fn(),
  },
  oystehrZambdaStub: {},
}));

vi.mock('../../src/api/api', () => api);
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: oystehrZambdaStub }) }));
vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
  SnackbarProvider: ({ children }: { children?: ReactNode }) => children ?? null,
}));

// Plain inputs stand in for the pickers that need MUI X / live search under jsdom.
vi.mock('../../src/components/DateInput', async () => ({ DateInput: (await import('./inputStub')).InputStub }));
vi.mock('../../src/components/ProcedureCodeAutocomplete', async () => ({
  ProcedureCodeAutocomplete: (await import('./inputStub')).InputStub,
}));
vi.mock('../../src/components/PayerSelect', async () => ({ PayerSelect: (await import('./inputStub')).InputStub }));
vi.mock('../../src/components/ProviderSelect', async () => ({
  ProviderSelect: (await import('./inputStub')).InputStub,
}));

function LocationProbe(): ReactNode {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/eras/new" element={<ManualRemit />} />
        <Route path="/eras/:id/edit" element={<ManualRemit />} />
        <Route path="*" element={<div>elsewhere</div>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );
}

const type = (label: string | RegExp, value: string, index = 0): void => {
  fireEvent.change(screen.getAllByLabelText(label)[index], { target: { value } });
};

const savedRemit = (): EraDetailResponse => ({
  id: 'era-1',
  source: 'manual',
  versionId: '3',
  checkNumber: '557801',
  checkDate: '2026-09-13',
  createdDate: '2026-09-13T15:00:00Z',
  remitDate: '2026-09-13',
  depositDate: '2026-09-13',
  notes: '',
  enteredBy: 'rzinger@masslight.com',
  enteredAt: '2026-09-13T15:00:00Z',
  checkAmount: 51000.45,
  payerName: 'United Health Care',
  payerFhirId: '',
  payee: null,
  status: 'complete',
  paymentMethod: 'ACH',
  totalClaims: 1,
  matchedClaims: 0,
  unmatchedClaims: 1,
  x12: '',
  claims: [],
  attachments: [],
  manualEntry: {
    header: {
      payerId: 'payer-uhc',
      billingProviderRef: 'Organization/org-1',
      checkNumber: '557801',
      checkAmountCents: 5100045,
      paymentMethod: 'ACH',
      remitDate: '2026-09-13',
      checkDate: '2026-09-13',
      depositDate: '2026-09-13',
    },
    claims: [
      {
        claimResponseId: 'cr-1',
        matchedClaimId: null,
        statusCode: '1',
        patientName: 'Joe Schmoe',
        serviceDate: '2026-08-15',
        serviceLines: [
          {
            itemSequence: 1,
            serviceDate: '2026-08-15',
            procedureCode: '99212',
            billedCents: 15000,
            allowedCents: 10000,
            paidCents: 5000,
            adjustments: [{ groupCode: 'CO', reasonCode: '45', amountCents: 5000 }],
            remarkCodes: [],
          },
        ],
      },
    ],
  },
});

describe('ManualRemit', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.searchBillingEras.mockResolvedValue({ eras: [], total: 0 });
  });

  it('requires the remit details before the first save, and claims wait for it', async () => {
    renderAt('/eras/new');
    expect(screen.getByRole('heading', { name: 'Manual Remit' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findAllByText('Required')).length).toBeGreaterThanOrEqual(6);
    expect(api.saveBillingManualEra).not.toHaveBeenCalled();
    // claims and attachments hang off the saved remit
    expect(
      screen.getAllByRole('button', { name: 'Add' }).every((button) => (button as HTMLButtonElement).disabled)
    ).toBe(true);
  });

  it('creates the remit and moves on to adding its claims', async () => {
    api.saveBillingManualEra.mockResolvedValue({ eraId: 'era-1', versionId: '1', claims: [] });
    api.getBillingEraDetail.mockResolvedValue(savedRemit());
    renderAt('/eras/new');

    type('Payer', 'payer-uhc');
    type('Billing Provider', 'Organization/org-1');
    type(/Check Number/, '557801');
    type(/Check Amount/, '51,000.45');
    type('Remit Date *', '2026-09-13');
    type('Check Date *', '2026-09-13');
    type('Deposit Date *', '2026-09-13');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.saveBillingManualEra).toHaveBeenCalledTimes(1));
    expect(api.saveBillingManualEra.mock.calls[0][1]).toEqual({
      idempotencyKey: expect.any(String),
      header: {
        payerId: 'payer-uhc',
        billingProviderRef: 'Organization/org-1',
        checkNumber: '557801',
        checkAmountCents: 5100045,
        remitDate: '2026-09-13',
        checkDate: '2026-09-13',
        depositDate: '2026-09-13',
      },
    });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/eras/era-1/edit'));
  });

  it('shows a saved remit with who keyed it, its claims and how far it is from balancing', async () => {
    api.getBillingEraDetail.mockResolvedValue(savedRemit());
    renderAt('/eras/era-1/edit');

    expect(await screen.findByRole('heading', { name: 'Manual Remit — 557801' })).toBeInTheDocument();
    expect(screen.getByText('Entered by rzinger@masslight.com on 09/13/2026')).toBeInTheDocument();
    expect(screen.getByText('Claims (1)')).toBeInTheDocument();
    expect(screen.getByText('Joe Schmoe')).toBeInTheDocument();
    const reconciliation = within(screen.getByTestId('remit-reconciliation'));
    expect(reconciliation.getByText('$51,000.45')).toBeInTheDocument();
    expect(reconciliation.getByText('$50.00')).toBeInTheDocument();
    expect(reconciliation.getByText('Off by $50,950.45')).toBeInTheDocument();
    // nothing changed yet
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves only the claims edited in place', async () => {
    api.getBillingEraDetail.mockResolvedValue(savedRemit());
    api.saveBillingManualEra.mockResolvedValue({
      eraId: 'era-1',
      versionId: '4',
      claims: [{ claimResponseId: 'cr-1' }],
    });
    renderAt('/eras/era-1/edit');
    await screen.findByText('Joe Schmoe');

    fireEvent.click(screen.getByRole('button', { name: 'Expand claim' }));
    type('Ins Paid', '60');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.saveBillingManualEra).toHaveBeenCalledTimes(1));
    const request = api.saveBillingManualEra.mock.calls[0][1];
    expect(request).toMatchObject({ eraId: 'era-1', expectedVersionId: '3' });
    expect(request.header).toBeUndefined();
    expect(request.claims).toHaveLength(1);
    expect(request.claims[0]).toMatchObject({ claimResponseId: 'cr-1', serviceLines: [{ paidCents: 6000 }] });
  });

  it('keys a claim in from the Add menu and saves it straight away', async () => {
    api.getBillingEraDetail.mockResolvedValue(savedRemit());
    api.saveBillingManualEra.mockImplementation(async (_client, input) => ({
      eraId: 'era-1',
      versionId: '4',
      claims: [{ clientKey: input.claims[0].clientKey, claimResponseId: 'cr-2' }],
    }));
    renderAt('/eras/era-1/edit');
    await screen.findByText('Joe Schmoe');

    const claimsCard = screen.getByText('Claims (1)').closest('.MuiCard-root') as HTMLElement;
    fireEvent.click(within(claimsCard).getByRole('button', { name: 'Add' }));
    fireEvent.click(await screen.findByText('Enter Manually'));

    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText(/Patient Name/), { target: { value: 'Ann Lee' } });
    fireEvent.change(dialog.getByLabelText('Service Date'), { target: { value: '2026-08-16' } });
    fireEvent.change(dialog.getByLabelText('CPT/HCPCS'), { target: { value: '87880' } });
    fireEvent.change(dialog.getByLabelText('Billed'), { target: { value: '40' } });
    fireEvent.change(dialog.getByLabelText('Ins Paid'), { target: { value: '40' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Add to Remit' }));

    await waitFor(() => expect(api.saveBillingManualEra).toHaveBeenCalledTimes(1));
    const request = api.saveBillingManualEra.mock.calls[0][1];
    expect(request).toMatchObject({ eraId: 'era-1', expectedVersionId: '3' });
    expect(request.header).toBeUndefined();
    expect(request.claims).toEqual([expect.objectContaining({ patientName: 'Ann Lee', serviceDate: '2026-08-16' })]);
    expect(await screen.findByText('Claims (2)')).toBeInTheDocument();
    expect(screen.getByText('Ann Lee')).toBeInTheDocument();
  });

  it('refuses to edit an ERA that was not keyed in', async () => {
    api.getBillingEraDetail.mockResolvedValue({ ...savedRemit(), source: 'clearing-house', manualEntry: undefined });
    renderAt('/eras/era-1/edit');
    expect(await screen.findByText('Only manually entered remits can be edited here.')).toBeInTheDocument();
  });
});
