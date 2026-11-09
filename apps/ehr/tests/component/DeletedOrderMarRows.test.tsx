import { render, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ExtendedMedicationDataForResponse } from 'utils/lib/types/api/medication-administration.types';
import { ImmunizationOrder } from 'utils/lib/types/data/immunization/types';
import { describe, expect, it, vi } from 'vitest';
import { OrderHistoryTableRow } from '../../src/features/immunization/components/OrderHistoryTableRow';
import { MarTableRow } from '../../src/features/visits/in-person/components/medication-administration/mar/MarTableRow';

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: true }),
}));

vi.mock('../../src/features/visits/in-person/hooks/useMedicationManagement', () => ({
  useMedicationManagement: () => ({ getAvailableStatuses: () => [] }),
}));

vi.mock('../../src/features/visits/in-person/hooks/useImmunization', () => ({
  useCancelImmunizationOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const renderRow = (row: ReactElement): void => {
  render(
    <MemoryRouter>
      <table>
        <tbody>{row}</tbody>
      </table>
    </MemoryRouter>
  );
};

const GIVEN_DATE = /10\/14\/2026/;

const medicationOrder = (status: ExtendedMedicationDataForResponse['status']): ExtendedMedicationDataForResponse => ({
  id: 'ma-1',
  status,
  patient: 'patient-1',
  encounterId: 'encounter-1',
  medicationName: 'Albuterol',
  dose: 2,
  units: 'ml',
  route: '',
  reason: 'Patient refused',
  providerCreatedTheOrder: 'Dr Order',
  providerCreatedTheOrderId: 'practitioner-1',
  orderedByProvider: 'Dr Order',
  dateTimeCreated: '2026-10-13T12:00:00.000Z',
  effectiveDateTime: '2026-10-14T12:00:00.000Z',
  administeredProvider: 'Nurse Joy',
});

const immunizationOrder = (status: string): ImmunizationOrder => ({
  id: 'ma-2',
  status,
  reason: 'Caregiver refused',
  encounterId: 'encounter-1',
  details: {
    medication: { id: 'medication-1', name: 'DTaP' },
    dose: '2',
    units: 'ml',
    orderedProvider: { id: 'practitioner-1', name: 'Dr Order' },
    orderedDateTime: '2026-10-13T12:00:00.000Z',
  },
  administrationDetails: {
    lot: '',
    expDate: '',
    mvx: '',
    cvx: '',
    ndc: '',
    administeredProvider: { id: 'practitioner-2', name: 'Nurse Joy' },
    administeredDateTime: '2026-10-14T12:00:00.000Z',
  },
});

describe('In-house medication MAR row', () => {
  it('shows the reason and who gave a partly administered order and when', () => {
    renderRow(<MarTableRow medication={medicationOrder('administered-partly')} columnStyles={{}} />);

    expect(screen.getByText('Patient refused')).toBeInTheDocument();
    expect(screen.getByText(GIVEN_DATE)).toBeInTheDocument();
    expect(screen.getByText('Nurse Joy')).toBeInTheDocument();
  });

  it('shows neither the reason nor who gave a deleted order and when', () => {
    renderRow(<MarTableRow medication={medicationOrder('cancelled')} columnStyles={{}} />);

    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByText('Patient refused')).not.toBeInTheDocument();
    expect(screen.queryByText(GIVEN_DATE)).not.toBeInTheDocument();
    expect(screen.queryByText('Nurse Joy')).not.toBeInTheDocument();
  });
});

describe('Immunization MAR row', () => {
  it('shows the reason and who gave a partly administered order and when', () => {
    renderRow(<OrderHistoryTableRow order={immunizationOrder('administered-partly')} showActions={false} />);

    expect(screen.getByText('Caregiver refused')).toBeInTheDocument();
    expect(screen.getByText(GIVEN_DATE)).toBeInTheDocument();
    expect(screen.getByText('Nurse Joy')).toBeInTheDocument();
  });

  it('shows neither the reason nor who gave a deleted order and when', () => {
    renderRow(<OrderHistoryTableRow order={immunizationOrder('cancelled')} showActions={false} />);

    expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    expect(screen.queryByText('Caregiver refused')).not.toBeInTheDocument();
    expect(screen.queryByText(GIVEN_DATE)).not.toBeInTheDocument();
    expect(screen.queryByText('Nurse Joy')).not.toBeInTheDocument();
  });
});
