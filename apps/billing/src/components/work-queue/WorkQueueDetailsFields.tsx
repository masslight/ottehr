import { Autocomplete, Box, TextField } from '@mui/material';
import { ReactElement } from 'react';
import {
  WORK_QUEUE_DESCRIPTION_MAX_LENGTH,
  WORK_QUEUE_NAME_MAX_LENGTH,
  WorkQueueOwner,
} from 'utils/lib/types/data/billing/work-queue.schemas';

export interface WorkQueueDetails {
  name: string;
  description: string;
  owner: WorkQueueOwner | null;
}

export const workQueueNameError = (name: string): string | undefined =>
  name.trim() ? undefined : 'Queue name is required';

interface WorkQueueDetailsFieldsProps {
  value: WorkQueueDetails;
  onChange: (value: WorkQueueDetails) => void;
  owners: WorkQueueOwner[];
  ownersLoading?: boolean;
  // Show the name's required error (once the user tried to save).
  showErrors?: boolean;
  disabled?: boolean;
  // Lay the fields out in one row instead of stacking them.
  inline?: boolean;
}

// The name, description, and owner of a work queue — edited in the create dialog and on the queue.
export function WorkQueueDetailsFields({
  value,
  onChange,
  owners,
  ownersLoading,
  showErrors,
  disabled,
  inline,
}: WorkQueueDetailsFieldsProps): ReactElement {
  const nameError = showErrors ? workQueueNameError(value.name) : undefined;
  // The saved owner may not be offered anymore (e.g. they lost the role); keep showing them.
  const ownerOptions =
    value.owner && !owners.some((o) => o.practitionerId === value.owner?.practitionerId)
      ? [value.owner, ...owners]
      : owners;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: inline ? { xs: '1fr', md: '1fr 2fr 1fr' } : '1fr',
        gap: 2,
        alignItems: 'start',
      }}
    >
      <TextField
        label="Queue Name"
        required
        size="small"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        error={!!nameError}
        helperText={nameError}
        disabled={disabled}
        inputProps={{ maxLength: WORK_QUEUE_NAME_MAX_LENGTH }}
      />
      <TextField
        label="Queue Description"
        size="small"
        value={value.description}
        onChange={(e) => onChange({ ...value, description: e.target.value })}
        helperText={`${value.description.length}/${WORK_QUEUE_DESCRIPTION_MAX_LENGTH}`}
        disabled={disabled}
        multiline={!inline}
        minRows={inline ? undefined : 2}
        inputProps={{ maxLength: WORK_QUEUE_DESCRIPTION_MAX_LENGTH }}
      />
      <Autocomplete
        size="small"
        options={ownerOptions}
        loading={ownersLoading}
        value={value.owner}
        onChange={(_, owner) => onChange({ ...value, owner })}
        getOptionLabel={(o) => o.name}
        isOptionEqualToValue={(o, v) => o.practitionerId === v.practitionerId}
        renderInput={(params) => <TextField {...params} label="Owner" />}
        disabled={disabled}
      />
    </Box>
  );
}
