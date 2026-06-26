import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AR_STAGE, ClaimDetailResponse, emptyClaimStatusValues } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClaimDetail from '../../src/pages/ClaimDetail';

const { getBillingClaimDetailMock, submitBillingClaimsMock } = vi.hoisted(() => ({
  getBillingClaimDetailMock: vi.fn(),
  submitBillingClaimsMock: vi.fn(),
}));

vi.mock('../../src/api/api', () => ({
  getBillingClaimDetail: getBillingClaimDetailMock,
  submitBillingClaims: submitBillingClaimsMock,
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
  type: 'professional',
  status: '',
  statuses: {
    ...emptyClaimStatusValues(),
    arStage,
  },
  created: '2026-01-01',
  billingType: '',
  billableStatus: '',
  appointmentType: '',
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
  relationship: '',
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
  otherClaims: [],
  tags: [],
});

function renderDetail(): void {
  render(
    <MemoryRouter initialEntries={['/claims/claim-1']}>
      <Routes>
        <Route path="/claims/:id" element={<ClaimDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ClaimDetail — submit claim', () => {
  beforeEach(() => {
    getBillingClaimDetailMock.mockReset();
    submitBillingClaimsMock.mockReset();
    enqueueSnackbarMock.mockReset();
  });

  it('disables Submit claim when the claim is not in Insurance Payer AR', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.patient));
    renderDetail();

    expect(await screen.findByRole('button', { name: 'Submit claim' })).toBeDisabled();
  });

  it('submits the claim through the confirm dialog when in Insurance Payer AR', async () => {
    getBillingClaimDetailMock.mockResolvedValue(makeClaim(AR_STAGE.insurancePayer));
    submitBillingClaimsMock.mockResolvedValue({
      results: [
        {
          claimId: 'claim-1',
          status: 'submitted',
        },
      ],
    });
    renderDetail();

    const submitButton = await screen.findByRole('button', { name: 'Submit claim' });
    expect(submitButton).toBeEnabled();

    fireEvent.click(submitButton);

    const confirmButton = await screen.findByRole('button', { name: 'Submit' });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(submitBillingClaimsMock).toHaveBeenCalledWith({}, { claimIds: ['claim-1'] }));
    expect(enqueueSnackbarMock).toHaveBeenCalledWith('Claim submitted to payer', { variant: 'success' });
  });
});
