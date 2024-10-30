import React, { ReactElement } from 'react';
import { MenuItem, FormControl, Select, SelectChangeEvent, CircularProgress } from '@mui/material';
import { FhirClient } from '@zapehr/sdk';
import { Appointment, Encounter } from 'fhir/r4';
import { getPatchOperationsToUpdateVisitStatus, mapVisitStatusToFhirAppointmentStatus } from '../helpers/mappingUtils';
import { Operation } from 'fast-json-patch';
import { getPatchBinary, getStatusFromExtension } from 'ehr-utils';
import { VisitStatus, STATI } from '../helpers/mappingUtils';
import { useApiClients } from '../hooks/useAppClients';
import { getAppointmentStatusChip } from './AppointmentTableRow';
import { Box } from '@mui/system';

const statuses = STATI;

export const switchStatus = async (
  fhirClient: FhirClient | undefined,
  appointment: Appointment,
  encounter: Encounter,
  status: VisitStatus,
): Promise<void> => {
  if (status === 'unknown') {
    throw new Error(`Invalid status: ${status}`);
  }

  if (!fhirClient) {
    throw new Error('error getting fhir client');
  }

  if (!appointment.id || !encounter.id) {
    throw new Error('Appointment or Encounter ID is missing');
  }

  const statusOperations = getPatchOperationsToUpdateVisitStatus(appointment, status);

  const patchOp: Operation = {
    op: 'replace',
    path: '/status',
    value: mapVisitStatusToFhirAppointmentStatus(status),
  };

  await fhirClient?.batchRequest({
    requests: [
      getPatchBinary({
        resourceId: appointment.id,
        resourceType: 'Appointment',
        patchOperations: [patchOp, ...statusOperations],
      }),
      getPatchBinary({
        resourceId: encounter.id,
        resourceType: 'Encounter',
        patchOperations: [patchOp],
      }),
    ],
  });
};

interface AppointmentStatusSwitcherProps {
  appointment: Appointment;
  encounter: Encounter;
}

export default function AppointmentStatusSwitcher({
  appointment,
  encounter,
}: AppointmentStatusSwitcherProps): ReactElement {
  const { fhirClient } = useApiClients();
  const [statusLoading, setStatusLoading] = React.useState<boolean>(false);
  const [currentAppointment, setCurrentAppointment] = React.useState<Appointment>(appointment);

  const handleChange = async (event: SelectChangeEvent): Promise<void> => {
    const value = event.target.value;
    setStatusLoading(true);
    await switchStatus(fhirClient, currentAppointment, encounter, value as VisitStatus);
    const newAppointment = (await fhirClient?.readResource({
      resourceType: 'Appointment',
      resourceId: appointment.id || '',
    })) as Appointment;
    setCurrentAppointment(newAppointment);
    setStatusLoading(false);
  };

  return (
    <FormControl
      sx={{
        borderRadius: '15px',
        border: '1px solid #E0E0E0',
        width: '100%',
        height: '60px',

        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {statusLoading ? (
        <CircularProgress sx={{ mx: 'auto' }} />
      ) : (
        <Select
          id="status-select"
          labelId="status-select-label"
          value={getStatusFromExtension(currentAppointment)}
          onChange={async (event) => await handleChange(event)}
          renderValue={(selected) => getAppointmentStatusChip(selected)}
          sx={{
            boxShadow: 'none',
            '.MuiOutlinedInput-notchedOutline': { border: 0 },
            '&.MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
              border: 0,
            },
            '&.MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
              border: 0,
            },
          }}
        >
          {statuses
            .filter((status) => status !== 'unknown')
            .map((status) => (
              <MenuItem key={status} value={status}>
                {getAppointmentStatusChip(status)}
              </MenuItem>
            ))}
        </Select>
      )}
    </FormControl>
  );
}
