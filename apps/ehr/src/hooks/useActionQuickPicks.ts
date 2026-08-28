import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInitialEncounterIdForFollowUp } from 'utils/lib/fhir/encounter';
import { useAppointmentData } from '../features/visits/shared/stores/appointment/appointment.store';
import { CommandPaletteItem, useCommandPaletteStore } from '../state/command-palette.store';
import { useCommandPaletteRouteContext } from './useCommandPaletteRouteContext';
import { useCommandPaletteSource } from './useCommandPaletteSource';
import useEvolveUser from './useEvolveUser';
import { PRIMARY_EHR_STAFF_ROLES } from './useNavigationQuickPicks';

/** Registers global action items ("Create Task", "Create Follow-up Visit") in the command palette. */
export function useActionQuickPicks(): void {
  const currentUser = useEvolveUser();
  const navigate = useNavigate();
  const setCreateTaskDialogOpen = useCommandPaletteStore((state) => state.setCreateTaskDialogOpen);
  const { visitId, patientId } = useCommandPaletteRouteContext();
  // On the in-person chart this shares the page's appointment query cache; on visit details it adds one background bundle fetch.
  const { patient, encounter, followUpOriginEncounter } = useAppointmentData(visitId);
  const visitPatientId = visitId ? patient?.id : undefined;

  const items = useMemo<CommandPaletteItem[]>(() => {
    if (!currentUser || !currentUser.hasRole(PRIMARY_EHR_STAFF_ROLES)) {
      return [];
    }

    return [
      {
        id: 'action-create-task',
        label: 'Create Task',
        category: 'Actions',
        keywords: ['task', 'new task', 'create task', 'todo', 'assign'],
        onSelect: () => setCreateTaskDialogOpen(true),
      },
      {
        id: 'action-create-followup',
        label: 'Create Follow-up Visit',
        category: 'Actions',
        keywords: ['follow-up', 'followup', 'follow up visit', 'add visit', 'recheck'],
        onSelect: () => {
          if (visitPatientId) {
            navigate(`/patient/${visitPatientId}/followup/add`, {
              state: { initialEncounterId: getInitialEncounterIdForFollowUp(encounter, followUpOriginEncounter) },
            });
          } else if (patientId) {
            navigate(`/patient/${patientId}/followup/add`);
          } else {
            // No route context (or visit data not yet resolved): mirror the tracking board's "+ Visit" flow.
            navigate('/visits/add');
          }
        },
      },
    ];
  }, [currentUser, setCreateTaskDialogOpen, navigate, visitPatientId, patientId, encounter, followUpOriginEncounter]);

  useCommandPaletteSource('actions', items);
}
