import { Autocomplete, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { Coding, Encounter } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { ProviderDetails } from 'utils';
import { usePractitionerActions } from '../features/visits/shared/hooks/usePractitioner';

interface AppointmentTablePractitionerSelectProps {
  /** Short prefix rendered before the input, e.g. "In:" or "Pr:". */
  label: string;
  options: ProviderDetails[];
  selectedPractitionerId?: string;
  encounter: Encounter;
  /** FHIR participant role coding identifying which assignment this controls (Admitter / Attender). */
  practitionerType: Coding[];
  isLoadingOptions: boolean;
  /** Called after a successful assignment so the tracking board can refresh. */
  onAssigned: () => void;
  dataTestId?: string;
}

/**
 * Searchable, auto-complete practitioner picker used on the tracking board to assign intake staff
 * and providers to a visit. Assignments are persisted to the encounter via {@link usePractitionerActions}
 * (the same mechanism used by the chart header), so selections stay in sync with the progress note.
 */
export default function AppointmentTablePractitionerSelect({
  label,
  options,
  selectedPractitionerId,
  encounter,
  practitionerType,
  isLoadingOptions,
  onAssigned,
  dataTestId,
}: AppointmentTablePractitionerSelectProps): ReactElement {
  const { isEncounterUpdatePending, handleUpdatePractitioner } = usePractitionerActions(
    encounter,
    'start',
    practitionerType
  );

  const sortedOptions = useMemo(
    () => [...options].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
    [options]
  );

  // The board list (`selectedPractitionerId`) is refetched fire-and-forget after assignment, so it lags
  // behind the mutation. Track the just-selected id optimistically and display it until the props catch up,
  // otherwise the select would briefly snap back to the previous practitioner before the new one appears.
  const [pendingPractitionerId, setPendingPractitionerId] = useState<string | null>(null);

  useEffect(() => {
    if (pendingPractitionerId && selectedPractitionerId === pendingPractitionerId) {
      setPendingPractitionerId(null);
    }
  }, [selectedPractitionerId, pendingPractitionerId]);

  const effectivePractitionerId = pendingPractitionerId ?? selectedPractitionerId;

  const selectedOption = useMemo(
    () => sortedOptions.find((option) => option.practitionerId === effectivePractitionerId) ?? null,
    [sortedOptions, effectivePractitionerId]
  );

  const handleChange = async (practitionerId: string): Promise<void> => {
    setPendingPractitionerId(practitionerId);
    try {
      await handleUpdatePractitioner(practitionerId);
      onAssigned();
    } catch (error: any) {
      setPendingPractitionerId(null);
      console.error(error?.message ?? error);
      enqueueSnackbar('An error occurred while updating the assignment. Please try again.', {
        variant: 'error',
      });
    }
  };

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ width: '100%' }}>
      <Typography sx={{ fontSize: 14, color: 'text.secondary', whiteSpace: 'nowrap' }}>{label}</Typography>
      {isLoadingOptions ? (
        <Skeleton sx={{ width: '100%', minWidth: 80 }} animation="wave" />
      ) : (
        <Autocomplete
          options={sortedOptions}
          getOptionLabel={(option) => option.name}
          // Practitioners can share a display name, so key on the id to avoid duplicate React keys.
          getOptionKey={(option) => option.practitionerId}
          isOptionEqualToValue={(option, value) => option.practitionerId === value.practitionerId}
          value={selectedOption}
          disabled={isEncounterUpdatePending}
          fullWidth
          size="small"
          // Selecting always (re)assigns; clearing is intentionally a no-op so a visit can't be left
          // unassigned from here — matching the chart header behaviour.
          onChange={(_event, newValue) => {
            if (newValue) {
              void handleChange(newValue.practitionerId);
            }
          }}
          renderInput={(params) => (
            <TextField {...params} variant="standard" placeholder="Select" data-testid={dataTestId} />
          )}
        />
      )}
    </Stack>
  );
}
