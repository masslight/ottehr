import { render, screen } from '@testing-library/react';
import { Patient } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { CustomThemeProvider } from '../../src/CustomThemeProvider';

const patient: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
  name: [{ family: 'Black', given: ['Oliver'] }],
  gender: 'male',
  birthDate: '2016-06-15',
};

vi.mock('src/App', () => ({ showEnvironmentBanner: false }));
vi.mock('src/hooks/useGetPatient', () => ({
  useGetPatient: () => ({ loading: false, patient, setPatient: vi.fn() }),
}));
vi.mock('src/hooks/useGetPatientVisitHistory', () => ({
  useGetPatientVisitHistory: () => ({ data: { visits: [{ encounterId: 'encounter-1' }] } }),
}));
vi.mock('src/features/patient-notes/hooks/usePatientNotesCount', () => ({
  usePatientNotesCount: () => ({ data: 3 }),
}));
vi.mock('src/features/visits/shared/components/patient/info/Avatar', () => ({ PatientAvatar: () => null }));
vi.mock('src/api/api', () => ({ getOrCreateVisitLabel: vi.fn() }));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: undefined }) }));
vi.mock('src/features/visits/shared/hooks/usePrintVisitLabel', () => ({
  usePrintVisitLabel: () => ({ printVisitLabel: vi.fn() }),
}));

import { dataTestIds } from '../../src/constants/data-test-ids';
import { PrintVisitLabelButton } from '../../src/features/visits/in-person/components/PrintVisitLabelButton';
import { Header } from '../../src/features/visits/shared/components/patient/Header';

describe('Patient Profile header', () => {
  it('vertically centers the name, notes and print icons, and summary on one line', () => {
    render(
      <CustomThemeProvider>
        <Header id="patient-1" handleDiscard={vi.fn()} />
      </CustomThemeProvider>
    );

    const nameRow = screen.getByTestId(dataTestIds.patientHeader.nameRow);
    expect(nameRow).toHaveStyle({ alignItems: 'center' });
    expect(nameRow).toContainElement(screen.getByTestId(dataTestIds.patientHeader.patientName));
    expect(nameRow).toContainElement(screen.getByRole('button', { name: 'Print label' }));
  });

  it('renders the print label icon in the accent blue used by the notes icon', () => {
    render(
      <CustomThemeProvider>
        <Header id="patient-1" handleDiscard={vi.fn()} />
      </CustomThemeProvider>
    );

    expect(screen.getByRole('button', { name: 'Print label' })).toHaveStyle({ color: 'rgb(33, 105, 245)' });
  });

  it('keeps the dark print label icon by default for other headers', () => {
    render(
      <CustomThemeProvider>
        <PrintVisitLabelButton encounterId="encounter-1" />
      </CustomThemeProvider>
    );

    expect(screen.getByRole('button', { name: 'Print label' })).toHaveStyle({ color: 'rgb(15, 52, 124)' });
  });
});
