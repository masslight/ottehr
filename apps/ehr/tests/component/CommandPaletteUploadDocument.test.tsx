import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { Encounter, Patient } from 'fhir/r4b';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let appointmentData: { patient?: Patient; encounter?: Encounter } = {};
const useAppointmentData = vi.fn((_appointmentId?: string) => appointmentData);
const dialogProps = vi.fn();
const prefetch = vi.fn();

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: (appointmentId?: string) => useAppointmentData(appointmentId),
}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: {} }) }));
vi.mock('../../src/hooks/useGetPatientDocs', () => ({
  prefetchPatientDocsFolders: (...args: unknown[]) => prefetch(...args),
}));
vi.mock('../../src/features/visits/shared/components/patient/docs/UploadDocumentDialog', () => ({
  UploadDocumentDialog: (props: unknown) => {
    dialogProps(props);
    return null;
  },
}));

import { CommandPaletteUploadDocument } from '../../src/components/CommandPaletteUploadDocument';
import { useCommandPaletteStore } from '../../src/state/command-palette.store';

const renderAt = (pathname: string): void => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[pathname]}>
        <CommandPaletteUploadDocument />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('CommandPaletteUploadDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appointmentData = {};
    useCommandPaletteStore.setState({ uploadDocumentMode: null, isOpen: false });
  });

  it('opens the chosen dialog for the patient on screen, with no visit', () => {
    useCommandPaletteStore.setState({ uploadDocumentMode: 'scan' });

    renderAt('/patient/patient-1/info');

    expect(dialogProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'scan', patientId: 'patient-1', encounterId: undefined })
    );
  });

  it("files against the visit's encounter on a visit page", () => {
    appointmentData = {
      patient: { resourceType: 'Patient', id: 'patient-2' },
      encounter: { resourceType: 'Encounter', id: 'encounter-2', status: 'in-progress', class: {} },
    };
    useCommandPaletteStore.setState({ uploadDocumentMode: 'upload' });

    renderAt('/in-person/appt-2/progress-note');

    expect(dialogProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'upload', patientId: 'patient-2', encounterId: 'encounter-2' })
    );
  });

  it('renders nothing while closed, but loads the patient folders as the palette opens', () => {
    useCommandPaletteStore.setState({ isOpen: true });

    renderAt('/patient/patient-1/info');

    expect(dialogProps).not.toHaveBeenCalled();
    expect(prefetch).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'patient-1');
  });
});
