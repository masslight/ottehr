import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ClaimDetailResponse } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { InsuranceSection } from '../../src/pages/ClaimDetail';

vi.mock('../../src/api/api', () => ({
  getBillingClaimDetail: vi.fn(),
  getPatientCoverages: vi.fn(),
  searchBillingLocations: vi.fn(),
  searchBillingPayers: vi.fn(),
  searchBillingProviders: vi.fn(),
  searchBillingTags: vi.fn(),
  tagBillingClaim: vi.fn(),
  updateBillingResource: vi.fn(),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: {},
  }),
}));

const claim = {
  id: 'claim-1',
  coverageFhirId: 'cov-1',
  payorFhirId: 'payer-1',
  payerName: 'Acme',
  payerId: 'ACME',
  memberId: 'M1',
  coverageStatus: 'active',
  planType: '',
  relationship: 'Self',
  policyHolder: null,
  patientOriginalId: 'patient-1',
} as ClaimDetailResponse;

describe('InsuranceSection — plan type', () => {
  it('offers the value-set options and saves the selected candid code on the claim', async () => {
    const updateResource = vi.fn().mockResolvedValue(null);
    render(<InsuranceSection claim={claim} updateResource={updateResource} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Plan Type *' }));
    fireEvent.click(await screen.findByRole('option', { name: 'PPO' }));

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateResource).toHaveBeenCalledWith('Claim', 'claim-1', { payerId: 'ACME', planType: '12' })
    );
  });
});
