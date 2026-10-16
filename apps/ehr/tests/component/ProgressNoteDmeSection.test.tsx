import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DmeOrderDTO, DmeOrderStatus } from 'utils/lib/types/api/dme.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyVisitNote } from './helpers/emptyVisitNote';

const state = vi.hoisted(() => ({
  orders: [] as DmeOrderDTO[],
  readOnly: false,
  flagEnabled: true,
}));

vi.mock('../../src/constants/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/constants/feature-flags')>();
  return {
    ...actual,
    FEATURE_FLAGS: {
      ...actual.FEATURE_FLAGS,
      get DME_ORDERS_ENABLED() {
        return state.flagEnabled;
      },
    },
  };
});

vi.mock('../../src/features/dme/dme.queries', () => ({
  DME_ORDERS_QUERY_KEY: 'dme-orders',
  useDmeOrders: () => ({ data: state.orders, isLoading: false, error: null }),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: state.readOnly }),
}));

// Only the DME section renders its summary, so the test needs no data for the others.
vi.mock('../../src/features/visits/in-person/components/progress-note/InlineEditSection', () => ({
  InlineEditSection: ({ sectionName, children }: { sectionName: string; children: ReactNode }) => (
    <div data-testid={`section-${sectionName}`}>{sectionName === 'dme-orders' && children}</div>
  ),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ appointment: { id: 'appt1' }, encounter: { id: 'enc1' } }),
}));

vi.mock('../../src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => ({}),
}));

vi.mock('../../src/features/visits/shared/stores/tracking-board/tracking-board.queries', () => ({
  useSignAppointmentMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => ({ isProvider: true }),
}));

vi.mock('../../src/features/visits/shared/hooks/useVisitNote', () => ({
  useVisitNote: () => ({ data: emptyVisitNote(), isLoading: false, isFetched: true }),
}));

vi.mock('../../src/features/visits/in-person/hooks/useMedicationOperations', () => ({
  useMedicationAPI: () => ({ medications: [] }),
}));

vi.mock('../../src/features/visits/in-person/hooks/useImmunization', () => ({
  useGetImmunizationOrders: () => ({ data: { orders: [] } }),
}));

vi.mock('../../src/features/visits/shared/hooks/usePatientInstructionsVisibility', () => ({
  usePatientInstructionsVisibility: () => ({ showPatientInstructions: false }),
}));

import { ProgressNoteDetails } from '../../src/features/visits/in-person/components/progress-note/ProgressNoteDetails';

const order: DmeOrderDTO = {
  id: 'order-1',
  encounterId: 'enc1',
  itemName: 'Knee brace',
  diagnoses: [],
  quantity: 1,
  billingCodes: [],
  external: false,
  status: DmeOrderStatus.pending,
  orderedBy: { practitionerId: 'p1', name: 'Dr. Ordering' },
  orderedAt: '2026-10-16T10:00:00.000Z',
};

const renderNote = (): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProgressNoteDetails />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('ProgressNoteDetails DME section', () => {
  beforeEach(() => {
    state.orders = [];
    state.readOnly = false;
    state.flagEnabled = true;
  });

  it('shows the empty section on an editable chart so orders can be placed', () => {
    renderNote();
    expect(screen.getByTestId('section-dme-orders')).toHaveTextContent('No DME orders');
  });

  it('hides the section on a read-only chart with no orders', () => {
    state.readOnly = true;
    renderNote();
    expect(screen.queryByTestId('section-dme-orders')).not.toBeInTheDocument();
  });

  it('lists the orders while collapsed on a read-only chart', () => {
    state.readOnly = true;
    state.orders = [order];
    renderNote();
    expect(screen.getByTestId('section-dme-orders')).toHaveTextContent('Knee brace');
    expect(screen.getByTestId('section-dme-orders')).toHaveTextContent('PENDING');
  });

  it('hides the empty section when DME orders are disabled', () => {
    state.flagEnabled = false;
    renderNote();
    expect(screen.queryByTestId('section-dme-orders')).not.toBeInTheDocument();
  });

  it('still shows existing orders when DME orders are disabled', () => {
    state.flagEnabled = false;
    state.orders = [order];
    renderNote();
    expect(screen.getByTestId('section-dme-orders')).toHaveTextContent('Knee brace');
  });
});
