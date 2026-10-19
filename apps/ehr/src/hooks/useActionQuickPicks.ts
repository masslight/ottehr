import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInitialEncounterIdForFollowUp } from 'utils/lib/fhir/encounter';
import { useAppointmentData } from '../features/visits/shared/stores/appointment/appointment.store';
import { CommandPaletteItem, useCommandPaletteStore } from '../state/command-palette.store';
import { useCommandPaletteRouteContext } from './useCommandPaletteRouteContext';
import { useCommandPaletteSource } from './useCommandPaletteSource';
import useEvolveUser from './useEvolveUser';
import { PRIMARY_EHR_STAFF_ROLES } from './useNavigationQuickPicks';

interface FollowUpTarget {
  to: string;
  state?: { initialEncounterId: string | undefined };
}

/** Registers global action items ("Create Task", "Add Follow-up Visit") in the command palette. */
export function useActionQuickPicks(): void {
  const currentUser = useEvolveUser();
  const navigate = useNavigate();
  const setCreateTaskDialogOpen = useCommandPaletteStore((state) => state.setCreateTaskDialogOpen);
  const { visitId, patientId } = useCommandPaletteRouteContext();
  const { patient, encounter } = useAppointmentData(visitId);

  const followUpTarget = useMemo<FollowUpTarget | undefined>(() => {
    if (visitId) {
      if (!patient?.id) {
        return undefined;
      }
      return {
        to: `/patient/${patient.id}/followup/add`,
        state: { initialEncounterId: getInitialEncounterIdForFollowUp(encounter) },
      };
    }
    if (patientId) {
      return { to: `/patient/${patientId}/followup/add` };
    }
    return { to: '/visits/add' };
  }, [visitId, patientId, patient?.id, encounter]);

  const items = useMemo<CommandPaletteItem[]>(() => {
    if (!currentUser || !currentUser.hasRole(PRIMARY_EHR_STAFF_ROLES)) {
      return [];
    }

    const actions: CommandPaletteItem[] = [
      {
        id: 'action-create-task',
        label: 'Create Task',
        category: 'Actions',
        keywords: ['task', 'new task', 'create task', 'todo', 'assign'],
        onSelect: () => setCreateTaskDialogOpen(true),
      },
    ];

    if (followUpTarget) {
      actions.push({
        id: 'action-add-followup-visit',
        label: 'Add Follow-up Visit',
        category: 'Actions',
        keywords: ['follow-up', 'followup', 'follow up visit', 'recheck'],
        onSelect: () => navigate(followUpTarget.to, followUpTarget.state ? { state: followUpTarget.state } : undefined),
      });
    }

    return actions;
  }, [currentUser, followUpTarget, navigate, setCreateTaskDialogOpen]);

  useCommandPaletteSource('actions', items);
}
