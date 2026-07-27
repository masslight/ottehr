import { render, screen } from '@testing-library/react';
import { RadiologyDTO } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { RadiologySection } from '../../src/features/easy-charting/RadiologySection';

// The view-image launcher talks to the zambda API — stub it so the section renders hermetically.
vi.mock('src/features/radiology/components/RadiologyViewImageBtn', () => ({
  RadiologyViewImageBtn: ({ serviceRequestId }: { serviceRequestId: string }) => (
    <button>View Image {serviceRequestId}</button>
  ),
}));

// The easy-chart note's Radiology block mirrors Review & Sign's RadiologyOrdersContainer: CPT
// display + diagnosis + clinical history, the base64-decoded read HTML (final wins over
// preliminary), a view-image control, and "Radiology Results Pending" for read-less orders.
describe('RadiologySection', () => {
  const baseOrder: RadiologyDTO = {
    serviceRequestId: 'sr-1',
    cptCodeDisplay: '73030 — X-ray shoulder',
    studyType: 'XR',
    diagnosis: 'S43.004A — Unspecified dislocation of right shoulder joint',
    clinicalHistory: 'Fell off a bike onto the right shoulder.',
  };

  it('renders order details and the base64-decoded final read HTML', () => {
    const order: RadiologyDTO = {
      ...baseOrder,
      preliminaryReport: btoa('<em>prelim</em>'),
      finalReport: btoa('<strong>No acute fracture.</strong>'),
    };
    render(<RadiologySection radiologyOrders={[order]} />);
    expect(screen.getByText('Radiology')).toBeDefined();
    expect(screen.getByText('73030 — X-ray shoulder')).toBeDefined();
    expect(screen.getByText(/Unspecified dislocation of right shoulder/)).toBeDefined();
    expect(screen.getByText(/Fell off a bike onto the right shoulder/)).toBeDefined();
    // Final read wins over preliminary, and its HTML renders decoded.
    expect(screen.getByText('Final Read:')).toBeDefined();
    expect(screen.getByText('No acute fracture.')).toBeDefined();
    expect(screen.queryByText('Preliminary Read:')).toBeNull();
    expect(screen.getByRole('button', { name: 'View Image sr-1' })).toBeDefined();
  });

  it('labels a preliminary-only read as "Preliminary Read"', () => {
    render(<RadiologySection radiologyOrders={[{ ...baseOrder, preliminaryReport: btoa('Early impression.') }]} />);
    expect(screen.getByText('Preliminary Read:')).toBeDefined();
    expect(screen.getByText('Early impression.')).toBeDefined();
  });

  it('shows "Radiology Results Pending" for orders without any read', () => {
    render(<RadiologySection radiologyOrders={[baseOrder]} />);
    expect(screen.getByText('Radiology Results Pending')).toBeDefined();
    // A read-less order shows no per-order details block (mirrors Review & Sign).
    expect(screen.queryByText('Final Read:')).toBeNull();
  });
});
