import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { useMemo } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { canBeAssignedAsProvider } from 'utils/lib/types/api/get-employees/get-employees.types';
import { PRACTITIONER_CODINGS } from 'utils/lib/types/data/appointments/appointments.types';
import { invalidateChart } from '../features/visits/shared/hooks/chartSectionCache';
import { usePractitionerActions } from '../features/visits/shared/hooks/usePractitioner';
import { useAppointmentData } from '../features/visits/shared/stores/appointment/appointment.store';
import { CommandPaletteItem } from '../state/command-palette.store';
import { useCommandPaletteRouteContext } from './useCommandPaletteRouteContext';
import { useCommandPaletteSource } from './useCommandPaletteSource';
import useEvolveUser from './useEvolveUser';

/**
 * Registers "Assign Current Chart to Me" in the command palette, letting a provider take over the
 * Provider (Attender) assignment of the visit they are viewing, in-person or telemed. Offered in every visit
 * status, and whether or not another provider already holds the assignment; hidden once the current
 * user is the assigned provider.
 */
export function useAssignToMeQuickPick(): void {
  const currentUser = useEvolveUser();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const { visitId } = useCommandPaletteRouteContext();
  const { encounter: selectedEncounter, followUpOriginEncounter } = useAppointmentData(visitId);
  // The chart may have an annotation follow-up selected, and that selection outlives the chart. Visit
  // details shows only the appointment's own encounter, so act on that one there.
  const encounter = matchPath('/visit/:id', pathname) ? followUpOriginEncounter : selectedEncounter;
  const { isEncounterUpdatePending, handleUpdatePractitioner } = usePractitionerActions(
    encounter,
    'start',
    PRACTITIONER_CODINGS.Attender
  );

  const currentPractitionerId = currentUser?.profileResource?.id;
  const canTakeAssignment = canBeAssignedAsProvider({ roles: currentUser?.roles?.map((role) => role.name) ?? [] });
  const assignedProviderId = encounter ? getAttendingPractitionerId(encounter) : undefined;

  const items = useMemo<CommandPaletteItem[]>(() => {
    if (
      !visitId ||
      !canTakeAssignment ||
      !currentPractitionerId ||
      !encounter?.id ||
      assignedProviderId === currentPractitionerId
    ) {
      return [];
    }

    const encounterId = encounter.id;

    return [
      {
        id: 'action-assign-chart-to-me',
        label: 'Assign Current Chart to Me',
        category: 'Actions',
        keywords: ['assign', 'assign to me', 'take over', 'takeover', 'claim', 'provider', 'chart', 'me'],
        onSelect: () => {
          if (isEncounterUpdatePending) {
            return;
          }
          void handleUpdatePractitioner(currentPractitionerId)
            .then(async () => {
              // The visit note carries the encounter's practitioners; re-read it where it is shown.
              await Promise.all([
                invalidateChart(queryClient, encounterId),
                queryClient.invalidateQueries({ queryKey: ['telemed-appointment', visitId] }),
                queryClient.invalidateQueries({ queryKey: ['get-visit-details', visitId] }),
              ]);
              enqueueSnackbar('You are now the provider for this chart.', { variant: 'success' });
            })
            .catch((error: unknown) => {
              console.error(error);
              enqueueSnackbar('An error occurred trying to assign you to this chart. Please try again.', {
                variant: 'error',
              });
            });
        },
      },
    ];
  }, [
    assignedProviderId,
    canTakeAssignment,
    currentPractitionerId,
    encounter?.id,
    handleUpdatePractitioner,
    isEncounterUpdatePending,
    queryClient,
    visitId,
  ]);

  useCommandPaletteSource('assign-chart-to-me', items);
}
