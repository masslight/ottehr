import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ClaimDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, emptyClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROVISIONAL_BALANCE_HINT } from '../../src/constants/claimStatus';
import ClaimDetail from '../../src/pages/ClaimDetail';

const {
  getBillingClaimDetailMock,
  runBillingRulesEngineMock,
  getBillingClaimHistoryMock,
  addBillingClaimNoteMock,
  oystehrZambdaStub,
} = vi.hoisted(() => ({
  getBillingClaimDetailMock: vi.fn(),
  runBillingRulesEngineMock: vi.fn(),
  getBillingClaimHistoryMock: vi.fn(),
  addBillingClaimNoteMock: vi.fn(),
  oystehrZambdaStub: {},
}));

vi.mock('../../src/api/api', () => ({
  getBillingClaimDetail: getBillingClaimDetailMock,
  runBillingRulesEngine: runBillingRulesEngineMock,
  getBillingClaimHistory: getBillingClaimHistoryMock,
  addBillingClaimNote: addBillingClaimNoteMock,
  getPatientCoverages: vi.fn(),
  searchBillingLocations: vi.fn(),
  searchBillingPayers: vi.fn(),
  searchBillingProviders: vi.fn(),
  searchBillingTags: vi.fn().mockResolvedValue({ tags: [] }),
  tagBillingClaim: vi.fn(),
  updateBillingResource: vi.fn(),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: oystehrZambdaStub,
  }),
}));

const { enqueueSnackbarMock } = vi.hoisted(() => ({ enqueueSnackbarMock: vi.fn() }));

vi.mock('notistack', () => ({
  enqueueSnackbar: enqueueSnackbarMock,
  SnackbarProvider: ({ children }: { children?: ReactNode }) => children ?? null,
}));

const emptyAddressParts = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
};

const makeClaim = (arStage: string): ClaimDetailResponse => ({
  id: 'claim-1',
  encounterId: '',
  appointmentId: '',
  type: 'professional',
  status: '',
  statuses: {
    ...emptyClaimStatusValues(),
    arStage,
  },
  created: '2026-01-01',
  patientName: 'Jane Doe',
  patientDob: '1990-01-01',
  patientGender: 'female',
  patientId: 'patient-1',
  patientOriginalId: 'patient-orig-1',
  patientAddress: '',
  patientAddressParts: emptyAddressParts,
  coverageFhirId: '',
  payorFhirId: '',
  payerName: '',
  payerId: '',
  memberId: '',
  subscriberId: '',
  planType: '',
  relationship: 'Self',
  policyHolder: null,
  responsibleParty: '',
  secondaryCoverageFhirId: '',
  secondaryPayerName: '',
  secondaryPayerId: '',
  secondaryMemberId: '',
  tertiaryCoverageFhirId: '',
  tertiaryPayerName: '',
  tertiaryPayerId: '',
  tertiaryMemberId: '',
  quaternaryCoverageFhirId: '',
  quaternaryPayerName: '',
  quaternaryPayerId: '',
  quaternaryMemberId: '',
  nonInsurancePayerFhirId: '',
  nonInsurancePayerName: '',
  renderingProviderId: '',
  renderingProviderType: '',
  renderingProvider: '',
  renderingNpi: '',
  renderingTaxonomy: '',
  billingProviderFhirId: '',
  billingProviderType: '',
  billingProvider: '',
  billingNpi: '',
  billingTin: '',
  billingTaxonomy: '',
  facilityFhirId: '',
  serviceFacility: '',
  serviceFacilityId: '',
  serviceFacilityAddress: '',
  serviceFacilityAddressParts: emptyAddressParts,
  serviceFacilityNpi: '',
  diagnoses: [],
  serviceLines: [],
  billed: 0,
  allowed: 0,
  insurancePaid: 0,
  patientResp: 0,
  patientPaid: 0,
  balance: 0,
  adjudicated: false,
  remits: [],
  insurancePayments: [],
  patientPayments: [],
  otherClaims: [],
  tags: [],
  pcn: '',
  billType: '',
  patientDischargeStatusCode: '',
  admissionType: '',
  admissionSource: '',
});

function renderDetail(): void {
  render(
    <MemoryRouter initialEntries={['/claims/claim-1']}>
      <Routes>
        <Route path="/claims/:id" element={<ClaimDetail />} />
        <Route path="/eras/:id" element={<div>ERA page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ClaimDetail — remits', () => {
  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
  });

  it('renders remit rows with payment details and adjustment codes', async () => {
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.insurancePayer),
      remits: [
        {
          claimResponseId: 'cr-1',
          date: '2026-07-08T18:20:39.029Z',
          payerName: 'Test Payer',
          status: 'complete',
          eraStatusCode: '1',
          allowed: 80,
          paid: 60,
          patientResp: 20,
          adjustments: [
            {
              groupCode: 'PR',
              reasonCode: '1',
              amount: 15,
            },
            {
              groupCode: 'CO',
              reasonCode: '45',
              amount: 20,
            },
          ],
        },
      ],
    });
    renderDetail();

    fireEvent.click(await screen.findByRole('tab', { name: 'Dx, Service Lines & Remits' }));

    expect(await screen.findByText('07/08/2026')).toBeInTheDocument();
    expect(screen.getByText('Test Payer')).toBeInTheDocument();
    expect(screen.getByText('complete')).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('$60.00')).toBeInTheDocument();
    expect(screen.getByText('PR-1 $15.00, CO-45 $20.00')).toBeInTheDocument();
  });

  it('renders each amount by state: missing as a dash, zero as $0.00, positive as currency', async () => {
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.insurancePayer),
      remits: [
        {
          claimResponseId: 'cr-2',
          date: '2026-07-09T10:00:00.000Z',
          payerName: 'Aetna',
          status: 'complete',
          eraStatusCode: '',
          allowed: null,
          paid: 0,
          patientResp: 20,
          adjustments: [],
        },
      ],
    });
    renderDetail();

    fireEvent.click(await screen.findByRole('tab', { name: 'Dx, Service Lines & Remits' }));

    const row = (await screen.findByText('Aetna')).closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(cells).toEqual(['07/09/2026', 'Aetna', 'complete', '-', '-', '-', '$0.00', '$20.00']);
  });

  it('shows the empty state when the claim has no remits', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.insurancePayer));
    renderDetail();

    fireEvent.click(await screen.findByRole('tab', { name: 'Dx, Service Lines & Remits' }));

    expect(await screen.findByText('No remits yet')).toBeInTheDocument();
  });
});

describe('ClaimDetail — insurance payments', () => {
  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
  });

  it('lists insurance payments and navigates to the ERA on row click', async () => {
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.insurancePayer),
      insurancePayments: [
        {
          paymentReconciliationId: 'pr-1',
          checkNumber: 'ERA0000000001',
          paymentDate: '2026-07-08',
          paymentAmount: 350,
          payerName: 'CIGNA',
          status: 'active',
        },
      ],
    });
    renderDetail();

    const remitsTab = await screen.findByRole('tab', { name: 'Dx, Service Lines & Remits' });
    fireEvent.click(remitsTab);

    const row = (await screen.findByText('ERA0000000001')).closest('tr');
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(cells).toEqual(['07/08/2026', 'CIGNA', 'ERA0000000001', 'active', '$350.00']);

    fireEvent.click(row as HTMLElement);
    expect(await screen.findByText('ERA page')).toBeInTheDocument();
  });
});

describe('ClaimDetail — run rules engine button', () => {
  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
    runBillingRulesEngineMock.mockReset();
    enqueueSnackbarMock.mockReset();
  });

  it('shows Submit claim for a claim in Insurance Payer AR', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.insurancePayer));
    renderDetail();

    expect(await screen.findByRole('button', { name: 'Submit claim' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Prepare for invoice' })).not.toBeInTheDocument();
  });

  it('shows Prepare for invoice for a claim in Non-insurance Payer AR', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.nonInsurancePayer));
    renderDetail();

    expect(await screen.findByRole('button', { name: 'Prepare for invoice' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Submit claim' })).not.toBeInTheDocument();
  });

  it('shows Prepare for invoice for a self-pay claim in Patient AR', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.patient)); // coverageFhirId '' -> self-pay
    renderDetail();

    expect(await screen.findByRole('button', { name: 'Prepare for invoice' })).toBeEnabled();
  });

  it('hides the run button for a Patient AR claim with insurance coverage', async () => {
    getBillingClaimDetailMock.mockResolvedValue({ ...makeClaim(AR_STAGE.patient), coverageFhirId: 'coverage-1' });
    renderDetail();
    await screen.findAllByText('Jane Doe');
    expect(screen.queryByRole('button', { name: 'Prepare for invoice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit claim' })).not.toBeInTheDocument();
  });

  it('hides the run button when the claim has no AR stage', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(''));
    renderDetail();
    await screen.findByText('No AR Stage');
    expect(screen.queryByRole('button', { name: 'Prepare for invoice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit claim' })).not.toBeInTheDocument();
  });

  it('runs the claim submission rules through the confirm dialog', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.insurancePayer));
    runBillingRulesEngineMock.mockResolvedValue({
      results: [{ claimId: 'claim-1', taskId: 'task-1', engine: 'claim-submission' }],
    });
    renderDetail();

    const submitButton = await screen.findByRole('button', { name: 'Submit claim' });
    fireEvent.click(submitButton);

    const confirmButton = await screen.findByRole('button', { name: 'Run rules' });
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(runBillingRulesEngineMock).toHaveBeenCalledWith({}, { claimIds: ['claim-1'], skipRules: false })
    );
    expect(enqueueSnackbarMock).toHaveBeenCalledWith(
      'Claim Submission Rules started — when every rule passes, the claim is submitted to the payer; a Hold keeps the claim for review. Refresh to see the result.',
      { variant: 'info' }
    );
  });

  it('runs the pre-invoice rules through the Prepare for invoice dialog', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.nonInsurancePayer));
    runBillingRulesEngineMock.mockResolvedValue({
      results: [{ claimId: 'claim-1', taskId: 'task-1', engine: 'non-insurance-payer-pre-invoice' }],
    });
    renderDetail();

    fireEvent.click(await screen.findByRole('button', { name: 'Prepare for invoice' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Run rules' }));

    await waitFor(() =>
      expect(runBillingRulesEngineMock).toHaveBeenCalledWith({}, { claimIds: ['claim-1'], skipRules: false })
    );
    expect(enqueueSnackbarMock).toHaveBeenCalledWith(
      'Non-Insurance Payer Pre-Invoice Rules started — when every rule passes, the Non-insurance AR Status moves to Ready to invoice; a Hold keeps the claim for review. Refresh to see the result.',
      { variant: 'info' }
    );
  });
});

describe('ClaimDetail — patient payments', () => {
  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
  });

  it('lists patient payments, including a negative refund', async () => {
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.patient),
      patientPayments: [
        {
          paymentNoticeId: 'pn-1',
          paymentDate: '2026-07-10',
          amount: 60,
          method: 'check',
          description: 'check collected at front desk',
          checkNumber: '1234',
          status: 'active',
        },
        {
          paymentNoticeId: 'pn-2',
          paymentDate: '2026-07-11',
          amount: -20,
          method: 'card',
          description: 'partial refund',
          status: 'active',
        },
      ],
    });
    renderDetail();

    const paymentsTab = await screen.findByRole('tab', { name: 'Write offs & Patient payments' });
    fireEvent.click(paymentsTab);

    const paymentRow = (await screen.findByText('check collected at front desk')).closest('tr');
    expect(paymentRow).not.toBeNull();
    const paymentCells = within(paymentRow as HTMLElement)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(paymentCells).toEqual(['07/10/2026', 'check', 'check collected at front desk', '1234', 'active', '$60.00']);

    const refundRow = (await screen.findByText('partial refund')).closest('tr');
    const refundCells = within(refundRow as HTMLElement)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(refundCells).toEqual(['07/11/2026', 'card', 'partial refund', '-', 'active', '-$20.00']);
  });

  it('shows the empty state when the claim has no patient payments', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.patient));
    renderDetail();

    const paymentsTab = await screen.findByRole('tab', { name: 'Write offs & Patient payments' });
    fireEvent.click(paymentsTab);

    expect(await screen.findByText('No patient payments yet')).toBeInTheDocument();
  });
});

describe('ClaimDetail — provisional balance indicator', () => {
  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
  });

  it('flags the balance as provisional when the claim is not adjudicated', async () => {
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.patient),
      adjudicated: false,
    });
    renderDetail();

    expect(await screen.findByRole('img', { name: PROVISIONAL_BALANCE_HINT })).toBeInTheDocument();
  });

  it('does not flag the balance once the claim is adjudicated', async () => {
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.patient),
      adjudicated: true,
    });
    renderDetail();

    await screen.findAllByText('Jane Doe');
    expect(screen.queryByRole('img', { name: PROVISIONAL_BALANCE_HINT })).not.toBeInTheDocument();
  });
});

describe('ClaimDetail — header copy buttons', () => {
  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
  });

  it('copies the claim id and the pcn from the header', async () => {
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.patient),
      pcn: 'claim1',
    });
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText,
      },
      writable: true,
      configurable: true,
    });
    renderDetail();

    const copyClaimId = await screen.findByRole('button', { name: 'Copy Claim ID' });
    await user.click(copyClaimId);
    expect(writeText).toHaveBeenCalledWith('claim-1');

    const copyPcn = screen.getByRole('button', { name: 'Copy PCN' });
    await user.click(copyPcn);
    expect(writeText).toHaveBeenCalledWith('claim1');
  });

  it('offers no copy button for an empty pcn', async () => {
    getBillingClaimDetailMock.mockResolvedValue({
      ...makeClaim(AR_STAGE.patient),
      pcn: '',
    });
    renderDetail();

    expect(await screen.findByRole('button', { name: 'Copy Claim ID' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy PCN' })).not.toBeInTheDocument();
  });
});

describe('ClaimDetail: notes drawer', () => {
  const noteMessage = 'Called payer, on hold pending medical records';
  const noteEntry = {
    id: 'prov-note',
    recorded: '2026-06-01T12:00:00Z',
    activity: 'Note',
    actor: {
      display: 'Jane Doe',
      type: 'user' as const,
    },
    changes: [],
    message: noteMessage,
  };

  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.patient));
    getBillingClaimHistoryMock.mockReset();
    getBillingClaimHistoryMock.mockResolvedValue({ entries: [] });
    addBillingClaimNoteMock.mockReset();
    addBillingClaimNoteMock.mockResolvedValue({ ok: true });
  });

  it('opens the notes drawer from the header button', async () => {
    const user = userEvent.setup();
    renderDetail();

    const notesButton = await screen.findByRole('button', { name: 'Notes' });
    await user.click(notesButton);

    expect(await screen.findByLabelText('Add a note')).toBeInTheDocument();
  });

  it('drops an unsent draft when the user moves to another claim', async () => {
    const otherClaim = {
      id: 'claim-2',
      status: '',
      arStage: AR_STAGE.patient,
      serviceDate: '2026-01-02',
      payerName: 'Acme Health',
      billed: 100,
      cptCodes: ['99213'],
    };
    getBillingClaimDetailMock.mockImplementation((_client: unknown, { claimId }: { claimId: string }) =>
      Promise.resolve({
        ...makeClaim(AR_STAGE.patient),
        id: claimId,
        otherClaims: claimId === 'claim-1' ? [otherClaim] : [],
      })
    );
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Notes' }));
    const draft = await screen.findByLabelText('Add a note');
    fireEvent.change(draft, { target: { value: 'draft for the first claim' } });
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('tab', { name: 'Other claims' }));
    await user.click(await screen.findByText('claim-2'));

    await user.click(await screen.findByRole('button', { name: 'Notes' }));
    expect(await screen.findByLabelText('Add a note')).toHaveValue('');
  });

  it('shows a note posted from the drawer on the already-open History tab', async () => {
    const user = userEvent.setup();
    renderDetail();

    const historyTab = await screen.findByRole('tab', { name: 'History' });
    await user.click(historyTab);
    await waitFor(() => expect(getBillingClaimHistoryMock).toHaveBeenCalled());
    expect(screen.getByText('No history recorded for this claim yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Notes' }));
    const input = await screen.findByLabelText('Add a note');
    fireEvent.change(input, { target: { value: noteMessage } });

    getBillingClaimHistoryMock.mockResolvedValue({ entries: [noteEntry] });
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(addBillingClaimNoteMock).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Close' }));

    const historyTable = await screen.findByRole('table');
    expect(within(historyTable).getByText(noteMessage)).toBeInTheDocument();
    expect(within(historyTable).getByText('Note')).toBeInTheDocument();
  });
});
