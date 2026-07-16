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

describe('ClaimDetail — submit claim', () => {
  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
    runBillingRulesEngineMock.mockReset();
    enqueueSnackbarMock.mockReset();
  });

  it('keeps Submit claim enabled outside Insurance Payer AR — the rules engine guards submission', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.patient));
    renderDetail();

    expect(await screen.findByRole('button', { name: 'Submit claim' })).toBeEnabled();
  });

  it('runs the rules engine through the confirm dialog', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.insurancePayer));
    runBillingRulesEngineMock.mockResolvedValue({ taskId: 'task-1' });
    renderDetail();

    const submitButton = await screen.findByRole('button', { name: 'Submit claim' });
    fireEvent.click(submitButton);

    const confirmButton = await screen.findByRole('button', { name: 'Submit' });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(runBillingRulesEngineMock).toHaveBeenCalledWith({}, { claimId: 'claim-1' }));
    expect(enqueueSnackbarMock).toHaveBeenCalledWith(
      'Rules engine started — it will submit or hold the claim shortly. Refresh to see the result.',
      { variant: 'info' }
    );
  });
});
