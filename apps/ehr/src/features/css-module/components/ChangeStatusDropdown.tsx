import { CircularProgress, FormControl, Grid, MenuItem, Select, Skeleton, SelectChangeEvent } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { styled } from '@mui/system';
import { CHIP_STATUS_MAP } from '../../../components/AppointmentTableRow';
import { useApiClients } from '../../../hooks/useAppClients';
import { Operation } from 'fast-json-patch';
import {
  Visit_Status_Array,
  VisitStatusLabel,
  getPatchBinary,
  visitStatusToFhirAppointmentStatusMap,
  visitStatusToFhirEncounterStatusMap,
  getVisitStatus,
  VisitStatusWithoutUnknown,
  getEncounterStatusHistoryUpdateOp,
} from 'utils';
import { getCriticalUpdateTagOp } from '../../../helpers/activityLogsUtils';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { useAppointment } from '../hooks/useAppointment';

const StyledSelect = styled(Select)<{ hasdropdown?: string; arrowcolor: string }>(({ hasdropdown, arrowcolor }) => ({
  height: '32px',
  borderRadius: '4px',
  paddingLeft: '12px',
  paddingRight: '12px',
  boxShadow: 'none',
  '& .MuiSelect-select': {
    paddingRight: '32px !important',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  '& .MuiSvgIcon-root': {
    display: 'none',
  },
  ...(hasdropdown && {
    '&::after': {
      content: '""',
      position: 'absolute',
      right: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '10px',
      height: '7px',
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='7' viewBox='0 0 10 7' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5 6.83317L0 1.83317L1.16667 0.666504L5 4.49984L8.83333 0.666504L10 1.83317L5 6.83317Z' fill='${encodeURIComponent(
        arrowcolor
      )}'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      pointerEvents: 'none',
    },
  }),
}));

export const ChangeStatusDropdown = ({
  appointmentID,
  onStatusChange,
}: {
  appointmentID?: string;
  onStatusChange: (status: VisitStatusLabel | undefined) => void;
}): React.ReactElement => {
  const [statusLoading, setStatusLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<VisitStatusLabel | undefined>(undefined);
  const { oystehr } = useApiClients();
  const user = useEvolveUser();
  const { telemedData, refetch } = useAppointment(appointmentID);
  const { appointment, encounter } = telemedData;
  const nonDropdownStatuses = ['checked out', 'canceled', 'no show'];
  const hasdropdown = status ? !nonDropdownStatuses.includes(status) : false;

  // todo move update status logic to back end

  async function updateStatusForAppointment(event: SelectChangeEvent<VisitStatusLabel | unknown>): Promise<void> {
    try {
      if (!user) {
        throw new Error('User is not defined');
      }
      if (!appointment || !appointment.id) {
        throw new Error('Appointment is not defined');
      }
      if (!encounter || !encounter.id) {
        throw new Error('Encounter is not defined');
      }
      if (!oystehr) {
        throw new Error('Oystehr is not defined');
      }
      setStatusLoading(true);

      const updatedStatus = event.target.value as VisitStatusWithoutUnknown;
      const appointmentStatus = visitStatusToFhirAppointmentStatusMap[updatedStatus];
      const encounterStatus = visitStatusToFhirEncounterStatusMap[updatedStatus];

      const patchOps: Operation[] = [
        {
          op: 'replace',
          path: '/status',
          value: appointmentStatus,
        },
      ];

      if (appointment.status === 'cancelled') {
        patchOps.push({
          op: 'remove',
          path: '/cancelationReason',
        });
      }

      const updateTag = getCriticalUpdateTagOp(appointment, `Staff ${user?.email ? user.email : `(${user?.id})`}`);
      patchOps.push(updateTag);

      const encounterPatchOps: Operation[] = [
        {
          op: 'replace',
          path: '/status',
          value: encounterStatus,
        },
      ];

      const encounterStatusHistoryUpdate: Operation = getEncounterStatusHistoryUpdateOp(encounter, encounterStatus);
      encounterPatchOps.push(encounterStatusHistoryUpdate);

      const appointmentPatch = getPatchBinary({
        resourceType: 'Appointment',
        resourceId: appointment.id,
        patchOperations: patchOps,
      });
      const encounterPatch = getPatchBinary({
        resourceType: 'Encounter',
        resourceId: encounter.id,
        patchOperations: encounterPatchOps,
      });
      setStatus(updatedStatus as VisitStatusLabel);
      await oystehr.fhir.transaction({
        requests: [appointmentPatch, encounterPatch],
      });
      await refetch();
      setStatusLoading(false);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    if (appointment && encounter) {
      const encounterStatus = getVisitStatus(appointment, encounter);
      setStatus(encounterStatus);
      onStatusChange(encounterStatus);
    } else {
      setStatus(undefined);
    }
  }, [appointment, encounter, onStatusChange]);

  return (
    <Grid item>
      {statusLoading || !status ? (
        <Skeleton aria-busy="true" sx={{ marginTop: -1 }} width={120} height={52} />
      ) : (
        <div id="user-set-appointment-status">
          <FormControl size="small">
            <StyledSelect
              id="appointment-status"
              value={status}
              {...(hasdropdown ? { hasdropdown: 'true' } : {})}
              arrowcolor={CHIP_STATUS_MAP[status].color.primary}
              onChange={(event: SelectChangeEvent<VisitStatusLabel | unknown>) => updateStatusForAppointment(event)}
              sx={{
                border: `1px solid ${CHIP_STATUS_MAP[status].color.primary}`,
                borderRadius: ' 7px',
                backgroundColor: CHIP_STATUS_MAP[status].background.primary,
                color: CHIP_STATUS_MAP[status].color.primary,
                '&:hover': {
                  backgroundColor: CHIP_STATUS_MAP[status].background.primary,
                  filter: 'brightness(0.95)',
                },
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    maxHeight: 300,
                    '& .MuiMenuItem-root': {
                      padding: '6px 16px',
                    },
                  },
                },
              }}
            >
              {Visit_Status_Array.filter((statusTemp) => {
                const allHiddenStatuses: Partial<VisitStatusLabel>[] = [
                  'no show',
                  'unknown',
                  ...(['cancelled', 'intake', 'ready for provider', 'provider', 'ready for discharge'].filter(
                    (s) => s !== status
                  ) as Partial<VisitStatusLabel>[]),
                ];
                return !allHiddenStatuses.includes(statusTemp);
              }).map((statusTemp) => (
                <MenuItem
                  key={statusTemp}
                  value={statusTemp}
                  sx={{
                    backgroundColor: CHIP_STATUS_MAP[statusTemp].background.primary,
                    color: CHIP_STATUS_MAP[statusTemp].color.primary,
                    '&:hover': {
                      backgroundColor: CHIP_STATUS_MAP[statusTemp].background.primary,
                      filter: 'brightness(0.95)',
                    },
                    '&.Mui-selected': {
                      backgroundColor: CHIP_STATUS_MAP[statusTemp].background.primary,
                      color: CHIP_STATUS_MAP[statusTemp].color.primary,
                      '&:hover': {
                        backgroundColor: CHIP_STATUS_MAP[statusTemp].background.primary,
                        filter: 'brightness(0.95)',
                      },
                    },
                  }}
                >
                  {statusTemp}
                </MenuItem>
              ))}
            </StyledSelect>
          </FormControl>
          {statusLoading && <CircularProgress size="20px" sx={{ marginTop: 2.8, marginLeft: 1 }} />}
        </div>
      )}
    </Grid>
  );
};
