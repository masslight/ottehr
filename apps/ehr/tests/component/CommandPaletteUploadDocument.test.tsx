import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { Encounter, Patient } from 'fhir/r4b';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let appointmentData: {
  patient?: Patient;
  encounter?: Encounter;
  followUpOriginEncounter?: Encounter;
  selectedEncounterId?: string;
} = {};
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

  const renderWithRouter = (pathname: string): ReturnType<typeof createMemoryRouter> => {
    const router = createMemoryRouter([{ path: '*', element: <CommandPaletteUploadDocument /> }], {
      initialEntries: [pathname],
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );
    return router;
  };

  it('closes when the user navigates to another patient, so the upload cannot land in their chart', async () => {
    const router = renderWithRouter('/patient/patient-1/info');
    act(() => useCommandPaletteStore.setState({ uploadDocumentMode: 'upload' }));
    expect(useCommandPaletteStore.getState().uploadDocumentMode).toBe('upload');
    expect(dialogProps).toHaveBeenLastCalledWith(expect.objectContaining({ patientId: 'patient-1' }));
    dialogProps.mockClear();

    await act(() => router.navigate('/patient/patient-2/info'));

    expect(useCommandPaletteStore.getState().uploadDocumentMode).toBeNull();
    expect(dialogProps).not.toHaveBeenCalledWith(expect.objectContaining({ patientId: 'patient-2' }));
  });

  it('closes when the visit switches to another follow-up encounter', async () => {
    const patient: Patient = { resourceType: 'Patient', id: 'patient-2' };
    appointmentData = {
      patient,
      encounter: { resourceType: 'Encounter', id: 'encounter-a', status: 'in-progress', class: {} },
    };
    const router = renderWithRouter('/in-person/appt-2/progress-note?encounterId=encounter-a');
    act(() => useCommandPaletteStore.setState({ uploadDocumentMode: 'upload' }));
    expect(dialogProps).toHaveBeenLastCalledWith(expect.objectContaining({ encounterId: 'encounter-a' }));
    dialogProps.mockClear();

    appointmentData = {
      patient,
      encounter: { resourceType: 'Encounter', id: 'encounter-b', status: 'in-progress', class: {} },
    };
    await act(() => router.navigate('/in-person/appt-2/progress-note?encounterId=encounter-b'));

    expect(useCommandPaletteStore.getState().uploadDocumentMode).toBeNull();
    expect(dialogProps).not.toHaveBeenCalledWith(expect.objectContaining({ encounterId: 'encounter-b' }));
  });

  it("files against Visit Details' own encounter, not a follow-up still selected from the chart", () => {
    appointmentData = {
      patient: { resourceType: 'Patient', id: 'patient-2' },
      encounter: { resourceType: 'Encounter', id: 'follow-up', status: 'in-progress', class: {} },
      followUpOriginEncounter: { resourceType: 'Encounter', id: 'visit-encounter', status: 'in-progress', class: {} },
    };
    useCommandPaletteStore.setState({ uploadDocumentMode: 'upload' });

    renderAt('/visit/appt-2');

    expect(dialogProps).toHaveBeenLastCalledWith(expect.objectContaining({ encounterId: 'visit-encounter' }));
  });

  it("doesn't open on the chart while a just-picked follow-up is still loading", () => {
    appointmentData = {
      patient: { resourceType: 'Patient', id: 'patient-2' },
      encounter: { resourceType: 'Encounter', id: 'visit-encounter', status: 'in-progress', class: {} },
      selectedEncounterId: 'new-follow-up',
    };
    useCommandPaletteStore.setState({ uploadDocumentMode: 'upload' });

    renderAt('/in-person/appt-2/progress-note?encounterId=new-follow-up');

    expect(dialogProps).not.toHaveBeenCalled();
    expect(useCommandPaletteStore.getState().uploadDocumentMode).toBeNull();
  });

  it('renders nothing while closed, but loads the patient folders as the palette opens', () => {
    useCommandPaletteStore.setState({ isOpen: true });

    renderAt('/patient/patient-1/info');

    expect(dialogProps).not.toHaveBeenCalled();
    expect(prefetch).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'patient-1');
  });
});
