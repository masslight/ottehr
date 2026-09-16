import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

// Pulls in API hooks irrelevant to rendering the summary text.
vi.mock('../../src/features/radiology/components/RadiologyViewImageBtn', () => ({
  RadiologyViewImageBtn: () => <button>View image</button>,
}));

import { RadiologyOrdersContainer } from 'src/features/visits/shared/components/review-tab/components/RadiologyOrdersContainer';
import { RadiologyDTO } from 'utils/lib/types/api/radiology';

// ============================================================================
// TESTS
// ============================================================================

describe('RadiologyOrdersContainer', () => {
  it('shows an empty state when there are no orders', () => {
    render(<RadiologyOrdersContainer radiologyOrders={[]} />);

    expect(screen.getByText('Radiology')).toBeVisible();
    expect(screen.getByText('No radiology orders')).toBeVisible();
  });

  it('renders a resulted order without the empty state', () => {
    const order = {
      serviceRequestId: 'sr-1',
      studyType: 'XR Chest',
      diagnosis: 'Cough',
      clinicalHistory: 'Cough for 3 days',
      finalReport: btoa('No acute findings'),
    } as RadiologyDTO;

    render(<RadiologyOrdersContainer radiologyOrders={[order]} />);

    expect(screen.getByText('XR Chest')).toBeVisible();
    expect(screen.queryByText('No radiology orders')).toBeNull();
  });

  it('shows the pending label for unperformed orders', () => {
    const order = {
      serviceRequestId: 'sr-2',
      studyType: 'XR Ankle',
      diagnosis: 'Sprain',
      clinicalHistory: 'Twisted ankle',
    } as RadiologyDTO;

    render(<RadiologyOrdersContainer radiologyOrders={[order]} />);

    expect(screen.getByText('Radiology Results Pending')).toBeVisible();
    expect(screen.queryByText('No radiology orders')).toBeNull();
  });
});
