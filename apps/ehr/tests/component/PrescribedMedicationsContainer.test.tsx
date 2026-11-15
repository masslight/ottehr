import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrescribedMedicationsContainer } from '../../src/features/visits/shared/components/review-tab/components/PrescribedMedicationsContainer';

const state = vi.hoisted(() => ({
  prescriptions: [] as PrescribedMedicationDTO[],
  getPharmacy: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: { erx: { getPharmacy: state.getPharmacy } } }),
}));
vi.mock('../../src/features/visits/shared/hooks/useVisitNote', () => ({
  useVisitNote: () => ({ data: { plan: { prescribedMedications: state.prescriptions } } }),
}));
vi.mock('src/features/visits/shared/components/NoteSectionHeading', () => ({
  SectionHeading: ({ children }: { children: string }) => <h3>{children}</h3>,
  useNoteSectionTitleInCardHeader: () => false,
}));

const AMOX: PrescribedMedicationDTO = {
  resourceId: 'mr-1',
  name: 'Amoxicillin 400 mg/5ml Susp',
  instructions: 'Take 5 mL by mouth twice daily for 10 days.',
  pharmacyId: '0000031',
  pharmacyName: 'Sample Pharmacy Two',
};

const renderNote = (): void => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PrescribedMedicationsContainer />
    </QueryClientProvider>
  );
};

describe('Visit note prescriptions: the pharmacy line', () => {
  beforeEach(() => {
    state.prescriptions = [AMOX];
    state.getPharmacy.mockReset();
  });

  it('falls back to the pharmacy name stored on the prescription when the eRx lookup fails', async () => {
    state.getPharmacy.mockRejectedValue(new Error('401'));
    renderNote();
    expect(await screen.findByText('Sample Pharmacy Two')).toBeInTheDocument();
    expect(screen.getByText('Pharmacy:', { exact: false })).toBeInTheDocument();
  });

  it('keeps the looked-up pharmacy, with its address, when the lookup works', async () => {
    state.getPharmacy.mockResolvedValue({ name: 'Looked Up', address1: '1 Main St', city: 'Austin', state: 'TX' });
    renderNote();
    expect(await screen.findByText(/Looked Up, 1 Main St, Austin, TX/)).toBeInTheDocument();
  });

  it('shows no pharmacy line when neither has a name', async () => {
    state.prescriptions = [{ ...AMOX, pharmacyName: undefined }];
    state.getPharmacy.mockRejectedValue(new Error('401'));
    renderNote();
    await screen.findByText(AMOX.name!);
    expect(screen.queryByText('Pharmacy:', { exact: false })).not.toBeInTheDocument();
  });
});
