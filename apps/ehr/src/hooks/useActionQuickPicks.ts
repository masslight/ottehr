import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInitialEncounterIdForFollowUp } from 'utils/lib/fhir/encounter';
import { useAppointmentData } from '../features/visits/shared/stores/appointment/appointment.store';
import { getAppointmentAccessibilityData } from '../features/visits/shared/utils/appointment-accessibility.helper';
import { CommandPaletteItem, useCommandPaletteStore } from '../state/command-palette.store';
import { useCommandPaletteRouteContext } from './useCommandPaletteRouteContext';
import { useCommandPaletteSource } from './useCommandPaletteSource';
import useEvolveUser from './useEvolveUser';
import { PRIMARY_EHR_STAFF_ROLES } from './useNavigationQuickPicks';

interface FollowUpTarget {
  to: string;
  state?: { initialEncounterId: string | undefined };
}

/** Registers global action items ("Create Task", "Add Follow-up Visit", "Upload", "Scan") in the command palette. */
export function useActionQuickPicks(): void {
  const currentUser = useEvolveUser();
  const navigate = useNavigate();
  const setCreateTaskDialogOpen = useCommandPaletteStore((state) => state.setCreateTaskDialogOpen);
  const setUploadDocumentMode = useCommandPaletteStore((state) => state.setUploadDocumentMode);
  const { visitId, patientId } = useCommandPaletteRouteContext();
  const { patient, encounter, appointment, locationVirtual } = useAppointmentData(visitId);

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

    // Documents belong to a patient, so these only appear with a visit or a patient on screen, and, like the
    // visit's own Documents page, not on a locked visit.
    const visitIsLocked =
      !!visitId &&
      getAppointmentAccessibilityData({ locationVirtual, encounter, appointment, user: currentUser })
        .isAppointmentReadOnly;
    if (((visitId && patient?.id) || patientId) && !visitIsLocked) {
      actions.push(
        {
          id: 'action-upload-document',
          label: 'Upload',
          category: 'Actions',
          keywords: ['upload', 'document', 'file', 'attach', 'docs'],
          onSelect: () => setUploadDocumentMode('upload'),
        },
        {
          id: 'action-scan-document',
          label: 'Scan',
          category: 'Actions',
          keywords: ['scan', 'scanner', 'document', 'docs'],
          onSelect: () => setUploadDocumentMode('scan'),
        }
      );
    }

    return actions;
  }, [
    currentUser,
    followUpTarget,
    navigate,
    setCreateTaskDialogOpen,
    setUploadDocumentMode,
    visitId,
    patientId,
    patient?.id,
    encounter,
    appointment,
    locationVirtual,
  ]);

  useCommandPaletteSource('actions', items);
}
