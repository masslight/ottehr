import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AR_STAGE, ClaimDetailResponse, emptyClaimStatusValues } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClaimDetail from '../../src/pages/ClaimDetail';

const { getBillingClaimDetailMock, runBillingRulesEngineMock } = vi.hoisted(() => ({
  getBillingClaimDetailMock: vi.fn(),
  runBillingRulesEngineMock: vi.fn(),
}));

vi.mock('../../src/api/api', () => ({
  getBillingClaimDetail: getBillingClaimDetailMock,
  runBillingRulesEngine: runBillingRulesEngineMock,
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
    oystehrZambda: {},
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
  billingType: '',
  billableStatus: '',
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
  coverageStatus: '',
  planType: '',
  relationship: 'Self',
  policyHolder: null,
  responsibleParty: '',
  secondaryCoverageFhirId: '',
  secondaryPayerName: '',
  secondaryPayerId: '',
  secondaryMemberId: '',
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
  remits: [],
  insurancePayments: [],
  otherClaims: [],
  tags: [],
  pcn: '',
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

    await waitFor(() => expect(runBillingRulesEngineMock).toHaveBeenCalledWith({}, { claimIds: ['claim-1'] }));
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

    await waitFor(() => expect(runBillingRulesEngineMock).toHaveBeenCalledWith({}, { claimIds: ['claim-1'] }));
    expect(enqueueSnackbarMock).toHaveBeenCalledWith(
      'Non-Insurance Payer Pre-Invoice Rules started — when every rule passes, the Non-insurance AR Status moves to Ready to invoice; a Hold keeps the claim for review. Refresh to see the result.',
      { variant: 'info' }
    );
  });
});
