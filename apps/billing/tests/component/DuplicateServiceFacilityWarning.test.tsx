import { render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DuplicateServiceFacilityWarning } from '../../src/components/DuplicateServiceFacilityWarning';

const searchBillingServiceFacilities = vi.fn();

vi.mock('../../src/api/api', () => ({
  searchBillingServiceFacilities: (...args: unknown[]) => searchBillingServiceFacilities(...args),
}));

const oystehrZambda = {};
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda }),
}));

const facility = (id: string, name: string): Record<string, string> => ({ id, name, npi: '', clia: '' });

function TestForm({ npi, clia, facilityId }: { npi: string; clia: string; facilityId?: string }): JSX.Element {
  const methods = useForm({ defaultValues: { npi, clia } });
  return (
    <MemoryRouter>
      <FormProvider {...methods}>
        <DuplicateServiceFacilityWarning facilityId={facilityId} />
      </FormProvider>
    </MemoryRouter>
  );
}

describe('DuplicateServiceFacilityWarning', () => {
  beforeEach(() => {
    searchBillingServiceFacilities.mockReset();
  });

  it('links to other facilities sharing the NPI or CLIA, excluding the one being edited', async () => {
    searchBillingServiceFacilities.mockImplementation(async (_client, params: { npi?: string; clia?: string }) => ({
      facilities: params.npi
        ? [facility('self', 'This Facility'), facility('loc-1', 'North Clinic')]
        : [facility('loc-2', 'Lab Annex')],
    }));

    render(<TestForm npi="1234567893" clia="05D1234567" facilityId="self" />);

    const npiLink = await screen.findByRole('link', { name: 'North Clinic' });
    expect(npiLink).toHaveAttribute('href', '/service-facilities/loc-1');
    expect(screen.getByRole('link', { name: 'Lab Annex' })).toHaveAttribute('href', '/service-facilities/loc-2');
    expect(screen.queryByRole('link', { name: 'This Facility' })).not.toBeInTheDocument();
    expect(screen.getByText(/NPI 1234567893 is already used by/)).toBeInTheDocument();
    expect(screen.getByText(/CLIA number 05D1234567 is already used by/)).toBeInTheDocument();
  });

  it('does not search for invalid identifiers', async () => {
    render(<TestForm npi="123" clia="bad" />);

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(searchBillingServiceFacilities).not.toHaveBeenCalled();
    expect(screen.queryByTestId('duplicate-service-facility-warning')).not.toBeInTheDocument();
  });

  it('shows nothing when no other facility matches', async () => {
    searchBillingServiceFacilities.mockResolvedValue({ facilities: [] });

    render(<TestForm npi="1234567893" clia="" />);

    await waitFor(() => expect(searchBillingServiceFacilities).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('duplicate-service-facility-warning')).not.toBeInTheDocument();
  });
});
