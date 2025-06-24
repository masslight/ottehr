import { CircularProgress, FormControl, Grid, MenuItem, Select, SelectChangeEvent, Skeleton } from '@mui/material';
import { styled } from '@mui/system';
import { enqueueSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { getVisitStatus, Visit_Status_Array, VisitStatusLabel, VisitStatusWithoutUnknown } from 'utils';
import { CHIP_STATUS_MAP } from '../../../components/AppointmentTableRow';
import { dataTestIds } from '../../../constants/data-test-ids';
import { handleChangeInPersonVisitStatus } from '../../../helpers/inPersonVisitStatusUtils';
import { useApiClients } from '../../../hooks/useAppClients';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { useAppointment } from '../hooks/useAppointment';

const StyledSelect = styled(Select)<{ hasDropdown?: string; arrowColor: string }>(
  ({ hasDropdown: hasDropdown, arrowColor: arrowColor }) => ({
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
    ...(hasDropdown && {
      '&::after': {
        content: '""',
        position: 'absolute',
        right: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '10px',
        height: '7px',
        // cSpell:disable-next %3C svg
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='7' viewBox='0 0 10 7' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5 6.83317L0 1.83317L1.16667 0.666504L5 4.49984L8.83333 0.666504L10 1.83317L5 6.83317Z' fill='${encodeURIComponent(
          arrowColor
        )}'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        pointerEvents: 'none',
      },
    }),
  })
);

export const ChangeStatusDropdown = ({
  appointmentID,
  onStatusChange,
}: {
  appointmentID?: string;
  onStatusChange: (status: VisitStatusWithoutUnknown) => void;
}): React.ReactElement => {
  const [statusLoading, setStatusLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<VisitStatusWithoutUnknown | undefined>(undefined);
  const { oystehrZambda } = useApiClients();
  const user = useEvolveUser();
  const { visitState: telemedData, refetch } = useAppointment(appointmentID);
  const { appointment, encounter } = telemedData;

  const nonDropdownStatuses = ['checked out', 'canceled', 'no show'];
  const hasDropdown = status ? !nonDropdownStatuses.includes(status) : false;

  async function updateInPersonVisitStatus(event: SelectChangeEvent<VisitStatusLabel | unknown>): Promise<void> {
    setStatusLoading(true);
    try {
      if (!user) {
        throw new Error('User is required to change the visit status');
      }

      if (!encounter || !encounter.id) {
        throw new Error('Encounter ID is required to change the visit status');
      }

      if (!oystehrZambda) {
        throw new Error('Oystehr Zambda client is not available when changing the visit status');
      }

      await handleChangeInPersonVisitStatus(
        {
          encounterId: encounter.id,
          user,
          updatedStatus: event.target.value as VisitStatusWithoutUnknown,
        },
        oystehrZambda
      );
      await refetch();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    }
    setStatusLoading(false);
  }

  useEffect(() => {
    if (appointment && encounter) {
      const encounterStatus = getVisitStatus(appointment, encounter);

      if (encounterStatus === 'unknown') {
        console.warn('Encounter status is unknown, so not setting a status');
        return;
      }

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
              data-testid={dataTestIds.cssHeader.appointmentStatus}
              id="appointment-status"
              value={status}
              {...(hasDropdown ? { hasDropdown: 'true' } : {})}
              arrowColor={CHIP_STATUS_MAP[status].color.primary}
              onChange={(event: SelectChangeEvent<VisitStatusLabel | unknown>) => updateInPersonVisitStatus(event)}
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
