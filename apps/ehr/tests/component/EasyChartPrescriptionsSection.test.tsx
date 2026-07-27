import { render, screen } from '@testing-library/react';
import { PrescribedMedicationDTO } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrescriptionsSection } from '../../src/features/easy-charting/PrescriptionsSection';

// The pharmacy-details lookup goes through the eRx SDK — stub the client so the section renders
// hermetically. Individual tests swap the getPharmacy implementation.
const getPharmacy = vi.fn();
vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: { erx: { getPharmacy } } }),
}));

const captureException = vi.fn();
vi.mock('@sentry/react', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

// The easy-chart note's Prescriptions block mirrors Review & Sign's PrescribedMedicationsContainer:
// meds grouped by pharmacy, a "Refill" chip on renewals, the sig under each med — and it must
// degrade gracefully (no pharmacy line, no error UI) when the eRx service is unavailable.
describe('PrescriptionsSection', () => {
  beforeEach(() => {
    getPharmacy.mockReset();
    captureException.mockReset();
  });

  const amoxicillin: PrescribedMedicationDTO = {
    resourceId: 'rx-1',
    name: 'Amoxicillin 400 mg/5 mL suspension',
    instructions: 'Take 5 mL by mouth twice daily for 10 days.',
    pharmacyId: 'pharm-1',
  };
  const refill: PrescribedMedicationDTO = {
    resourceId: 'rx-2',
    name: 'Albuterol HFA inhaler',
    instructions: '2 puffs every 4-6 hours as needed.',
    isRenewal: true,
  };

  it('renders med name, instructions, and the Refill chip for renewals', () => {
    getPharmacy.mockRejectedValue(new Error('no eRx'));
    render(<PrescriptionsSection prescriptions={[amoxicillin, refill]} />);
    expect(screen.getByText('Prescriptions')).toBeDefined();
    expect(screen.getByText('Amoxicillin 400 mg/5 mL suspension')).toBeDefined();
    expect(screen.getByText('Take 5 mL by mouth twice daily for 10 days.')).toBeDefined();
    expect(screen.getByText('Albuterol HFA inhaler')).toBeDefined();
    // Exactly one Refill chip — only the renewal carries it.
    expect(screen.getAllByText('Refill')).toHaveLength(1);
  });

  it('shows the pharmacy line once the eRx lookup resolves', async () => {
    getPharmacy.mockResolvedValue({
      name: 'Main St Pharmacy',
      address1: '1 Main St',
      address2: null,
      city: 'Springfield',
      state: 'MA',
      zipCode: '01101',
      phone: '4135551234',
    });
    render(<PrescriptionsSection prescriptions={[amoxicillin]} />);
    expect(await screen.findByText(/Main St Pharmacy/)).toBeDefined();
    expect(getPharmacy).toHaveBeenCalledWith({ pharmacyId: 'pharm-1' });
    expect(screen.getByText('Pharmacy:')).toBeDefined();
  });

  it('degrades silently when the eRx lookup fails: meds render, error is captured, no error UI', async () => {
    getPharmacy.mockRejectedValue(new Error('eRx unavailable'));
    render(<PrescriptionsSection prescriptions={[amoxicillin]} />);
    expect(screen.getByText('Amoxicillin 400 mg/5 mL suspension')).toBeDefined();
    await vi.waitFor(() => expect(captureException).toHaveBeenCalled());
    expect(screen.queryByText('Pharmacy:')).toBeNull();
  });

  it('never calls the eRx service when no prescription has a pharmacyId', () => {
    render(<PrescriptionsSection prescriptions={[refill]} />);
    expect(getPharmacy).not.toHaveBeenCalled();
  });
});
