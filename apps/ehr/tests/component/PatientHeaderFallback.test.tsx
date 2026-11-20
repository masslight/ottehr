import { render, screen } from '@testing-library/react';
import { Patient } from 'fhir/r4b';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('src/App', () => ({ showEnvironmentBanner: false }));
vi.mock('src/hooks/useGetPatient', () => ({ useGetPatient: () => ({ loading: true, patient: undefined }) }));
vi.mock('src/hooks/useGetPatientVisitHistory', () => ({ useGetPatientVisitHistory: () => ({ data: undefined }) }));
vi.mock('src/features/patient-notes/components/PatientNotesButton', () => ({ PatientNotesButton: () => null }));
vi.mock('src/features/visits/in-person/components/PrintVisitLabelButton', () => ({
  PrintVisitLabelButton: () => null,
}));
vi.mock('src/features/visits/shared/components/patient/info/Avatar', () => ({ PatientAvatar: () => null }));

import { dataTestIds } from '../../src/constants/data-test-ids';
import { Header } from '../../src/features/visits/shared/components/patient/Header';

const patient: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
  name: [{ given: ['Lulu'], family: 'Baggins' }],
  gender: 'male',
  birthDate: '2008-05-15',
};

describe('patient Header', () => {
  it("shows the page's already-loaded patient while its own lookup has not produced one", () => {
    render(
      <MemoryRouter>
        <Header handleDiscard={() => undefined} id="patient-1" fallbackPatient={patient} />
      </MemoryRouter>
    );

    expect(screen.getByTestId(dataTestIds.patientHeader.patientName)).toHaveTextContent('Baggins, Lulu');
  });

  it("links the patient name to the patient's record when the page asks for it", () => {
    render(
      <MemoryRouter>
        <Header handleDiscard={() => undefined} id="patient-1" fallbackPatient={patient} linkNameToPatientRecord />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Baggins, Lulu' })).toHaveAttribute('href', '/patient/patient-1');
  });

  it('keeps the patient name as plain text by default', () => {
    render(
      <MemoryRouter>
        <Header handleDiscard={() => undefined} id="patient-1" fallbackPatient={patient} />
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: 'Baggins, Lulu' })).not.toBeInTheDocument();
  });
});
