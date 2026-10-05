import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ClaimDetailResponse, EraDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
// Picking a claim from the claims list hands the page its details.
const pickedClaim = {
  id: 'claim-9',
  patientName: 'Lee, Ann',
  memberId: 'M-9',
  pcn: 'PCN-9',
  serviceLines: [{ sequence: 1, serviceDate: '2026-08-16', cptCode: '87880', charges: 40 }],
} as unknown as ClaimDetailResponse;
vi.mock('../../src/components/era/AssociateClaimDialog', () => ({
  AssociateClaimDialog: ({ onSelected }: { onSelected: (claim: ClaimDetailResponse) => void }) => (
    <button onClick={() => onSelected(pickedClaim)}>Pick claim-9</button>
  ),
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
const values = (label: string): string[] =>
  screen.getAllByLabelText(label).map((input) => (input as HTMLInputElement).value);
const section = (title: RegExp): HTMLElement => screen.getByText(title).closest('.MuiCard-root') as HTMLElement;
const addClaim = async (option: 'Enter Manually' | 'Existing Claim'): Promise<void> => {
  fireEvent.click(within(section(/^Claims \(/)).getByRole('button', { name: 'Add' }));
  fireEvent.click(await screen.findByText(option));
};
// fills in the one-line claim a new card starts with
const keyClaim = (index = 0): void => {
  type(/Patient Name/, 'Ann Lee', index);
  type('Service Date', '2026-08-16', index);
  type('CPT/HCPCS', '87880', index);
  type('Billed', '40', index);
  type('Ins Paid', '40', index);
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
    // only the clock: the page's debounces and waitFor keep real timers
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 13, 9, 0));
    // jsdom doesn't implement scrollIntoView, which taking the biller to an error calls
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('requires the remit details before the first save, and attachments wait for it', async () => {
    renderAt('/eras/new');
    expect(screen.getByRole('heading', { name: 'Manual Remit' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    // payer, billing provider, check number, check amount and check date; the remit date starts as
    // today and the deposit date is optional
    expect(await screen.findAllByText('Required')).toHaveLength(5);
    expect(screen.getByLabelText('Remit Date *')).toHaveValue('2026-09-13');
    expect(screen.getByLabelText('Deposit Date')).toHaveValue('');
    // the cursor goes to the first one
    await waitFor(() => expect(screen.getByLabelText('Payer')).toHaveFocus());
    expect(api.saveBillingManualEra).not.toHaveBeenCalled();
    // nothing to balance until the remit exists and its claims are keyed
    expect(within(screen.getByTestId('remit-header')).queryByText(/^(Off by|Balanced)/)).not.toBeInTheDocument();
    // a scan is attached to the saved remit; claims can be keyed in already
    expect(within(section(/^Attachments$/)).getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(within(section(/^Claims \(/)).getByRole('button', { name: 'Add' })).toBeEnabled();
  });

  it('creates the remit and moves on to adding its claims', async () => {
    api.saveBillingManualEra.mockResolvedValue({ eraId: 'era-1', versionId: '1', claims: [] });
    api.getBillingEraDetail.mockResolvedValue(savedRemit());
    renderAt('/eras/new');

    type('Payer', 'payer-uhc');
    type('Billing Provider', 'Organization/org-1');
    type(/Check Number/, '557801');
    type(/Check Amount/, '51,000.45');
    type('Check Date *', '2026-09-10');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.saveBillingManualEra).toHaveBeenCalledTimes(1));
    // dated today, with no deposit date
    expect(api.saveBillingManualEra.mock.calls[0][1]).toStrictEqual({
      header: {
        payerId: 'payer-uhc',
        billingProviderRef: 'Organization/org-1',
        checkNumber: '557801',
        checkAmountCents: 5100045,
        remitDate: '2026-09-13',
        checkDate: '2026-09-10',
      },
    });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/eras/era-1/edit'));
  });

  it('saves claims keyed in before the first save together with the remit', async () => {
    api.saveBillingManualEra.mockImplementation(async (_client, input) => ({
      eraId: 'era-1',
      versionId: '1',
      claims: [{ clientKey: input.claims[0].clientKey, claimResponseId: 'cr-2' }],
    }));
    api.getBillingEraDetail.mockResolvedValue(savedRemit());
    renderAt('/eras/new');

    type('Payer', 'payer-uhc');
    type('Billing Provider', 'Organization/org-1');
    type(/Check Number/, '557801');
    type(/Check Amount/, '40');
    type('Check Date *', '2026-09-10');
    await addClaim('Enter Manually');
    keyClaim();
    // the balance shows as soon as there are claims to balance
    expect(within(screen.getByTestId('remit-header')).getByText('Balanced')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.saveBillingManualEra).toHaveBeenCalledTimes(1));
    const request = api.saveBillingManualEra.mock.calls[0][1];
    expect(request.eraId).toBeUndefined();
    expect(request.header).toMatchObject({ checkNumber: '557801', checkAmountCents: 4000 });
    expect(request.claims).toEqual([
      expect.objectContaining({ clientKey: expect.any(String), patientName: 'Ann Lee', serviceDate: '2026-08-16' }),
    ]);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/eras/era-1/edit'));
  });

  it("doesn't count the remit date it fills in as an unsaved change", async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/eras/new');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/eras$/));
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('saves a cleared deposit date as no deposit date', async () => {
    api.getBillingEraDetail.mockResolvedValue(savedRemit());
    api.saveBillingManualEra.mockResolvedValue({ eraId: 'era-1', versionId: '4', claims: [] });
    renderAt('/eras/era-1/edit');
    await screen.findByText('Joe Schmoe');

    type('Deposit Date', '');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.saveBillingManualEra).toHaveBeenCalledTimes(1));
    const { depositDate: _cleared, ...header } = savedRemit().manualEntry!.header;
    expect(api.saveBillingManualEra.mock.calls[0][1].header).toStrictEqual(header);
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
    // the header, with Save and the balance, stays at the top of the page as it scrolls
    const header = screen.getByTestId('remit-header');
    expect(header).toHaveStyle({ position: 'sticky' });
    expect(within(header).getByText('Off by $50,950.45')).toBeInTheDocument();
    // nothing changed yet
    expect(within(header).getByRole('button', { name: 'Save' })).toBeDisabled();
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
    // the balance in the header follows the claims as they're keyed
    expect(within(screen.getByTestId('remit-header')).getByText('Off by $50,940.45')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.saveBillingManualEra).toHaveBeenCalledTimes(1));
    const request = api.saveBillingManualEra.mock.calls[0][1];
    expect(request).toMatchObject({ eraId: 'era-1', expectedVersionId: '3' });
    expect(request.header).toBeUndefined();
    expect(request.claims).toHaveLength(1);
    expect(request.claims[0]).toMatchObject({ claimResponseId: 'cr-1', serviceLines: [{ paidCents: 6000 }] });
    // saved, the edit is no longer pending
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('shows why a save failed in the header, in view however far down the biller saved from', async () => {
    api.getBillingEraDetail.mockResolvedValue(savedRemit());
    api.saveBillingManualEra.mockRejectedValue({ output: { code: APIErrorCode.MANUAL_ERA_VERSION_CONFLICT } });
    renderAt('/eras/era-1/edit');
    await screen.findByText('Joe Schmoe');

    fireEvent.click(screen.getByRole('button', { name: 'Expand claim' }));
    type('Ins Paid', '60');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const alert = await within(screen.getByTestId('remit-header')).findByRole('alert');
    expect(alert).toHaveTextContent('Someone else saved this remit since you opened it');
  });

  it('opens the claim a save found incomplete and puts the cursor on the field to fix', async () => {
    api.getBillingEraDetail.mockResolvedValue(savedRemit());
    api.saveBillingManualEra.mockResolvedValue({
      eraId: 'era-1',
      versionId: '4',
      claims: [{ claimResponseId: 'cr-1' }],
    });
    renderAt('/eras/era-1/edit');
    await screen.findByText('Joe Schmoe');

    fireEvent.click(screen.getByRole('button', { name: 'Expand claim' }));
    type('Ins Paid', '');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse claim' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // the message is on the field, not in a banner at the top of the page
    const insPaid = await screen.findByRole('textbox', { name: 'Ins Paid' });
    await waitFor(() => expect(insPaid).toHaveFocus());
    expect(insPaid).toHaveAccessibleDescription('Required');
    expect(screen.getByRole('button', { name: 'Collapse claim' })).toBeInTheDocument();
    // once the card has finished opening
    await waitFor(() =>
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.saveBillingManualEra).not.toHaveBeenCalled();

    // fixing it clears the message, and the save goes through
    type('Ins Paid', '60');
    await waitFor(() => expect(insPaid).not.toHaveAccessibleDescription('Required'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.saveBillingManualEra).toHaveBeenCalledTimes(1));
    expect(api.saveBillingManualEra.mock.calls[0][1].claims[0].serviceLines[0].paidCents).toBe(6000);
  });

  it('adds a claim on the page and saves it with the remit', async () => {
    api.getBillingEraDetail.mockResolvedValue(savedRemit());
    api.saveBillingManualEra.mockImplementation(async (_client, input) => ({
      eraId: 'era-1',
      versionId: '4',
      claims: [{ clientKey: input.claims[0].clientKey, claimResponseId: 'cr-2' }],
    }));
    renderAt('/eras/era-1/edit');
    await screen.findByText('Joe Schmoe');

    await addClaim('Enter Manually');
    // a new card, open at the end of the page with the cursor in it
    expect(screen.getByText('Claims (2)')).toBeInTheDocument();
    expect(screen.getByText('Not saved yet')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /Patient Name/ })).toHaveFocus());
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(api.saveBillingManualEra).not.toHaveBeenCalled();

    keyClaim();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.saveBillingManualEra).toHaveBeenCalledTimes(1));
    const request = api.saveBillingManualEra.mock.calls[0][1];
    expect(request).toMatchObject({ eraId: 'era-1', expectedVersionId: '3' });
    expect(request.header).toBeUndefined();
    expect(request.claims).toEqual([
      expect.objectContaining({ clientKey: expect.any(String), patientName: 'Ann Lee', serviceDate: '2026-08-16' }),
    ]);
    expect(request.claims[0].claimResponseId).toBeUndefined();
    // saved: it's on the remit like the others, and there's nothing left to save
    await waitFor(() => expect(screen.queryByText('Not saved yet')).not.toBeInTheDocument());
    expect(screen.getByTestId('claim-card-cr-2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('adds a claim picked from the claims list, matched and filled in from it', async () => {
    api.getBillingEraDetail.mockResolvedValue(savedRemit());
    api.saveBillingManualEra.mockResolvedValue({ eraId: 'era-1', versionId: '4', claims: [] });
    renderAt('/eras/era-1/edit');
    await screen.findByText('Joe Schmoe');

    await addClaim('Existing Claim');
    fireEvent.click(screen.getByRole('button', { name: 'Pick claim-9' }));

    expect(screen.getByText('Lee, Ann')).toBeInTheDocument();
    expect(screen.getByText('claim-9')).toBeInTheDocument();
    expect(values('CPT/HCPCS')).toEqual(['87880']);
    expect(values('Billed')).toEqual(['40']);
    type('Ins Paid', '40');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.saveBillingManualEra).toHaveBeenCalledTimes(1));
    expect(api.saveBillingManualEra.mock.calls[0][1].claims).toEqual([
      expect.objectContaining({ matchedClaimId: 'claim-9', patientName: 'Lee, Ann', patientAccountNumber: 'PCN-9' }),
    ]);
  });

  it('discards a claim that was never saved, without asking the server', async () => {
    api.getBillingEraDetail.mockResolvedValue(savedRemit());
    renderAt('/eras/era-1/edit');
    await screen.findByText('Joe Schmoe');

    await addClaim('Enter Manually');
    const card = screen.getByText('Not saved yet').closest('.MuiCard-root') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: 'Claim actions' }));
    // nothing saved yet to match, view or remove
    expect(screen.queryByText('Match to claim')).not.toBeInTheDocument();
    expect(screen.queryByText('View reimbursement details')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Discard'));

    await waitFor(() => expect(screen.getByText('Claims (1)')).toBeInTheDocument());
    expect(screen.queryByText('Not saved yet')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(api.saveBillingManualEra).not.toHaveBeenCalled();
  });

  it('marks what a new claim is missing on its fields and takes the biller to the first', async () => {
    api.getBillingEraDetail.mockResolvedValue(savedRemit());
    renderAt('/eras/era-1/edit');
    await screen.findByText('Joe Schmoe');

    await addClaim('Enter Manually');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const patientName = screen.getByRole('textbox', { name: /Patient Name/ });
    await waitFor(() => expect(patientName).toHaveAccessibleDescription('Required'));
    await waitFor(() => expect(patientName).toHaveFocus());
    // and the line's date of service, procedure code, billed and paid amounts
    expect(screen.getAllByText('Required')).toHaveLength(5);
    expect(api.saveBillingManualEra).not.toHaveBeenCalled();

    // from here on the errors follow the edits
    type(/Patient Name/, 'Ann Lee');
    await waitFor(() => expect(screen.getAllByText('Required')).toHaveLength(4));
  });

  it('flags each part of a CARC left incomplete', async () => {
    api.getBillingEraDetail.mockResolvedValue(savedRemit());
    renderAt('/eras/era-1/edit');
    await screen.findByText('Joe Schmoe');

    await addClaim('Enter Manually');
    keyClaim();
    fireEvent.click(screen.getByRole('button', { name: 'CARC' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // the group, the code and the amount
    await waitFor(() => expect(screen.getAllByText('Required')).toHaveLength(3));
    await waitFor(() => expect(screen.getByRole('combobox', { name: /^Group/ })).toHaveFocus());
    expect(api.saveBillingManualEra).not.toHaveBeenCalled();
  });

  it('refuses to edit an ERA that was not keyed in', async () => {
    api.getBillingEraDetail.mockResolvedValue({ ...savedRemit(), source: 'clearing-house', manualEntry: undefined });
    renderAt('/eras/era-1/edit');
    expect(await screen.findByText('Only manually entered remits can be edited here.')).toBeInTheDocument();
  });
});
