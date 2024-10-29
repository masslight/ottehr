import React, { Dispatch, ReactElement, SetStateAction } from 'react';
import {
  OutlinedInput,
  InputLabel,
  MenuItem,
  FormControl,
  ListItemText,
  Checkbox,
  Select,
  SelectChangeEvent,
  CircularProgress,
} from '@mui/material';
import { FhirClient } from '@zapehr/sdk';
import { Appointment, Encounter } from 'fhir/r4';
import { getPatchOperationsToUpdateVisitStatus } from '../helpers/mappingUtils';
import { Operation } from 'fast-json-patch';
import { getPatchBinary } from 'ehr-utils';
import { VisitStatus, STATI } from '../helpers/mappingUtils';
import { useApiClients } from '../hooks/useAppClients';
import { Label } from 'amazon-chime-sdk-component-library-react';
import { AppointmentStatusChip } from '../telemed';
import { getAppointmentStatusChip } from './AppointmentTableRow';
import { set } from 'react-hook-form';

const statuses = STATI;

export const switchStatus = async (
  fhirClient: FhirClient | undefined,
  appointment: Appointment,
  encounter: Encounter,
  status: VisitStatus,
): Promise<void> => {
  const statusOperations = getPatchOperationsToUpdateVisitStatus(appointment, status);

  if (!fhirClient) {
    throw new Error('error getting fhir client');
  }

  if (!appointment.id || !encounter.id) {
    throw new Error('Appointment or Encounter ID is missing');
  }

  const patchOp: Operation = {
    op: 'replace',
    path: '/status',
    value: status,
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
    <>
      <FormControl sx={{ width: 300, backgroundColor: 'white', borderRadius: '20px' }}>
        {statusLoading ? (
          <CircularProgress sx={{ display: 'block', mx: 'auto', my: 1.1 }} />
        ) : (
          <Select
            id="status-select"
            labelId="status-select-label"
            value={currentAppointment.status}
            onChange={async (event) => await handleChange(event)}
            renderValue={(selected) => getAppointmentStatusChip(selected)}
            sx={{ borderRadius: '20px' }}
          >
            {statuses.map((status) => (
              <MenuItem key={status} value={status}>
                {getAppointmentStatusChip(status)}
              </MenuItem>
            ))}
          </Select>
        )}
      </FormControl>
    </>
  );
}
