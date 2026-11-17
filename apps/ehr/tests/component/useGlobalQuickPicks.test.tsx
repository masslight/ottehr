import { renderHook } from '@testing-library/react';
import { Encounter } from 'fhir/r4b';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigate = vi.fn();
const noQuickPicks = (): { quickPicks: never[] } => ({ quickPicks: [] });
const dmeQuickPick = { id: 'dme-1', name: 'Crutches', itemName: 'Crutches' };
const procedureQuickPick = { id: 'proc-1', name: 'Splint', procedureType: 'Splinting' };

const encounter: Encounter = {
  resourceType: 'Encounter',
  id: 'encounter-1',
  status: 'in-progress',
  class: {},
  participant: [
    {
      type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'ATND' }] }],
      individual: { reference: 'Practitioner/provider-1' },
    },
  ],
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../../src/constants/feature-flags', () => ({ FEATURE_FLAGS: { DME_ORDERS_ENABLED: true } }));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter }),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ visitType: 'follow-up', isAppointmentReadOnly: false }),
}));

vi.mock('../../src/features/visits/shared/components/templates/useListTemplates', () => ({
  useListTemplates: () => ({ templates: [] }),
}));

vi.mock('../../src/hooks/useMergedQuickPicks', () => ({
  useMergedAllergyQuickPicks: () => noQuickPicks(),
  useMergedMedicalConditionQuickPicks: () => noQuickPicks(),
  useMergedMedicationHistoryQuickPicks: () => noQuickPicks(),
  useMergedInHouseMedicationQuickPicks: () => noQuickPicks(),
  useMergedImmunizationQuickPicks: () => noQuickPicks(),
  useMergedRadiologyQuickPicks: () => noQuickPicks(),
  useMergedProcedureQuickPicks: () => ({ quickPicks: [procedureQuickPick] }),
  useMergedDmeQuickPicks: () => ({ quickPicks: [dmeQuickPick] }),
}));

import { useGlobalQuickPicks } from '../../src/hooks/useGlobalQuickPicks';
import { CommandPaletteItem, useCommandPaletteStore } from '../../src/state/command-palette.store';

const renderAt = (url: string): CommandPaletteItem[] => {
  const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  renderHook(() => useGlobalQuickPicks(), { wrapper });
  return useCommandPaletteStore.getState().sources['global-quick-picks']?.items ?? [];
};

const selectItem = (items: CommandPaletteItem[], id: string): void => {
  const item = items.find((candidate) => candidate.id === id);
  expect(item).toBeDefined();
  item!.onSelect();
};

describe('useGlobalQuickPicks navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCommandPaletteStore.setState({ sources: {}, pendingQuickPick: null });
  });

  it('keeps the follow-up encounterId when opening a DME pick', () => {
    selectItem(renderAt('/in-person/appt-1/progress-note?encounterId=followup-1'), 'global-dme-dme-1');

    expect(navigate).toHaveBeenCalledWith('/in-person/appt-1/dme/create?encounterId=followup-1');
    expect(useCommandPaletteStore.getState().pendingQuickPick).toMatchObject({ category: 'dme', itemId: 'dme-1' });
  });

  it('keeps the encounterId for other categories and drops unrelated query params', () => {
    selectItem(renderAt('/in-person/appt-1/progress-note?tab=x&encounterId=followup-1'), 'global-procedure-proc-1');

    expect(navigate).toHaveBeenCalledWith('/in-person/appt-1/procedures/new?encounterId=followup-1');
  });

  it('navigates without a query string when no encounterId is present', () => {
    selectItem(renderAt('/in-person/appt-1/progress-note'), 'global-dme-dme-1');

    expect(navigate).toHaveBeenCalledWith('/in-person/appt-1/dme/create');
  });
});
