import { renderHook } from '@testing-library/react';
import { Appointment, Encounter, Patient } from 'fhir/r4b';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
let appointmentData: {
  patient?: Patient;
  encounter?: Encounter;
  followUpOriginEncounter?: Encounter;
  appointment?: Appointment;
  rawResources?: Appointment[];
  selectedEncounterId?: string;
} = {};
const useAppointmentData = vi.fn((_appointmentId?: string) => appointmentData);
let hasStaffRole = true;
let visitIsLocked = false;

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: (appointmentId?: string) => useAppointmentData(appointmentId),
}));

const getAppointmentAccessibilityData = vi.fn((_props: { encounter?: Encounter; appointment?: Appointment }) => ({
  isAppointmentReadOnly: visitIsLocked,
}));
vi.mock('../../src/features/visits/shared/utils/appointment-accessibility.helper', () => ({
  getAppointmentAccessibilityData: (props: { encounter?: Encounter; appointment?: Appointment }) =>
    getAppointmentAccessibilityData(props),
}));

vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => ({ hasRole: () => hasStaffRole }),
}));

import { useActionQuickPicks } from '../../src/hooks/useActionQuickPicks';
import { CommandPaletteItem, useCommandPaletteStore } from '../../src/state/command-palette.store';

const FOLLOWUP_ITEM_ID = 'action-add-followup-visit';

const renderAt = (pathname: string): CommandPaletteItem | undefined => {
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <MemoryRouter initialEntries={[pathname]}>{children}</MemoryRouter>
  );
  renderHook(() => useActionQuickPicks(), { wrapper });
  return useCommandPaletteStore.getState().sources.actions?.items.find((item) => item.id === FOLLOWUP_ITEM_ID);
};

describe('useActionQuickPicks — Add Follow-up Visit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCommandPaletteStore.setState({ sources: {} });
    appointmentData = {};
    hasStaffRole = true;
  });

  it.each(['/in-person/appt-1/progress-note', '/visit/appt-1'])(
    'opens the follow-up form linked to the current visit from %s',
    (pathname) => {
      appointmentData = {
        patient: { resourceType: 'Patient', id: 'patient-1' },
        encounter: { resourceType: 'Encounter', id: 'encounter-1', status: 'in-progress', class: {} },
      };

      const item = renderAt(pathname);
      expect(item?.category).toBe('Actions');
      expect(useAppointmentData).toHaveBeenCalledWith('appt-1');

      item!.onSelect();
      expect(navigate).toHaveBeenCalledWith('/patient/patient-1/followup/add', {
        state: { initialEncounterId: 'encounter-1' },
      });
    }
  );

  it('links the original visit when the current visit is itself a follow-up', () => {
    appointmentData = {
      patient: { resourceType: 'Patient', id: 'patient-1' },
      encounter: {
        resourceType: 'Encounter',
        id: 'scheduled-followup-1',
        status: 'planned',
        class: {},
        partOf: { reference: 'Encounter/original-1' },
      },
    };

    renderAt('/in-person/followup-appt/progress-note')!.onSelect();

    expect(navigate).toHaveBeenCalledWith('/patient/patient-1/followup/add', {
      state: { initialEncounterId: 'original-1' },
    });
  });

  it('is withheld on a visit page until the visit patient has loaded', () => {
    expect(renderAt('/visit/appt-1')).toBeUndefined();
  });

  it('opens the follow-up form without an originating encounter from the patient record', () => {
    const item = renderAt('/patient/patient-2/info');
    expect(item?.category).toBe('Actions');
    expect(useAppointmentData).toHaveBeenCalledWith(undefined);

    item!.onSelect();
    expect(navigate).toHaveBeenCalledWith('/patient/patient-2/followup/add', undefined);
  });

  it('opens the generic Add Visit flow without a patient in context', () => {
    const item = renderAt('/visits');
    expect(item?.category).toBe('Actions');

    item!.onSelect();
    expect(navigate).toHaveBeenCalledWith('/visits/add', undefined);
  });

  it('stays available on the follow-up form and routes as from the patient record', () => {
    const item = renderAt('/patient/patient-2/followup/add');
    expect(item?.category).toBe('Actions');

    item!.onSelect();
    expect(navigate).toHaveBeenCalledWith('/patient/patient-2/followup/add', undefined);
  });

  it('stays available on the generic Add Visit page', () => {
    const item = renderAt('/visits/add');
    expect(item?.category).toBe('Actions');

    item!.onSelect();
    expect(navigate).toHaveBeenCalledWith('/visits/add', undefined);
  });

  it('is hidden for users without primary EHR staff roles', () => {
    hasStaffRole = false;
    expect(renderAt('/visits')).toBeUndefined();
  });
});

describe('useActionQuickPicks — Upload and Scan', () => {
  const documentItems = (pathname: string): string[] => {
    renderAt(pathname);
    return (useCommandPaletteStore.getState().sources.actions?.items ?? [])
      .map((item) => item.id)
      .filter((id) => id === 'action-upload-document' || id === 'action-scan-document');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useCommandPaletteStore.setState({ sources: {}, uploadDocumentMode: null });
    appointmentData = { patient: { resourceType: 'Patient', id: 'patient-1' } };
    hasStaffRole = true;
    visitIsLocked = false;
  });

  it.each(['/in-person/appt-1/progress-note', '/visit/appt-1', '/patient/patient-1/docs'])(
    'offers Upload and Scan with a visit or patient on screen (%s), opening the matching dialog',
    (pathname) => {
      expect(documentItems(pathname)).toEqual(['action-upload-document', 'action-scan-document']);

      const items = useCommandPaletteStore.getState().sources.actions!.items;
      items.find((item) => item.id === 'action-scan-document')!.onSelect();
      expect(useCommandPaletteStore.getState().uploadDocumentMode).toBe('scan');
    }
  );

  it('hides them on a locked visit, like the visit Documents page', () => {
    visitIsLocked = true;
    expect(documentItems('/in-person/appt-1/progress-note')).toEqual([]);
  });

  it('hides them with no patient in context', () => {
    appointmentData = {};
    expect(documentItems('/tasks')).toEqual([]);
  });

  it('withholds them on the chart while a just-picked follow-up is still loading', () => {
    appointmentData = {
      patient: { resourceType: 'Patient', id: 'patient-1' },
      encounter: { resourceType: 'Encounter', id: 'visit-encounter', status: 'in-progress', class: {} },
      selectedEncounterId: 'new-follow-up',
    };
    expect(documentItems('/in-person/appt-1/progress-note?encounterId=new-follow-up')).toEqual([]);
  });

  it("checks Visit Details' own encounter and appointment, not a follow-up still selected from the chart", () => {
    const visitAppointment: Appointment = {
      resourceType: 'Appointment',
      id: 'appt-1',
      status: 'fulfilled',
      participant: [],
    };
    appointmentData = {
      patient: { resourceType: 'Patient', id: 'patient-1' },
      encounter: { resourceType: 'Encounter', id: 'follow-up', status: 'in-progress', class: {} },
      followUpOriginEncounter: { resourceType: 'Encounter', id: 'visit-encounter', status: 'in-progress', class: {} },
      appointment: { ...visitAppointment, id: 'follow-up-appt' },
      rawResources: [visitAppointment],
    };

    documentItems('/visit/appt-1');

    expect(getAppointmentAccessibilityData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        encounter: expect.objectContaining({ id: 'visit-encounter' }),
        appointment: expect.objectContaining({ id: 'appt-1' }),
      })
    );
  });
});
