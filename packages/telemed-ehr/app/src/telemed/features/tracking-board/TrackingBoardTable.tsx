import React, { ReactElement, useMemo } from 'react';
import {
  alpha,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { TelemedAppointmentInformation } from 'ehr-utils';
import { DateTime } from 'luxon';
import { ApptTab, filterAppointments } from '../../utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useTrackingBoardStore } from '../../state';
import { TrackingBoardFilters } from './TrackingBoardFilters';
import { TrackingBoardTableRow, TrackingBoardTableRowSkeleton } from './TrackingBoardTableRow';
import { AllStatesToNames, StateType } from '../../../types/types';
import { otherColors } from '../../../CustomThemeProvider';

interface AppointmentTableProps {
  tab: ApptTab;
}

export function TrackingBoardTable({ tab }: AppointmentTableProps): ReactElement {
  const theme = useTheme();
  const { appointments, state, availableStates, isAppointmentsLoading, unsignedFor } = getSelectors(
    useTrackingBoardStore,
    ['appointments', 'state', 'unsignedFor', 'availableStates', 'isAppointmentsLoading'],
  );

  const filteredAppointments = filterAppointments(appointments, unsignedFor, tab);

  const showEstimated = tab === ApptTab.ready;
  const showProvider = tab !== ApptTab.ready;

  const groups = useMemo(() => {
    if (state) {
      return {};
    }
    return filteredAppointments.reduce<Record<string, TelemedAppointmentInformation[]>>((accumulator, appointment) => {
      if (appointment.location.locationID) {
        if (!accumulator[appointment.location.locationID]) {
          accumulator[appointment.location.locationID] = [];
        }
        accumulator[appointment.location.locationID].push(appointment);
        return accumulator;
      } else if (appointment.provider) {
        if (!accumulator[appointment.provider.join(',')]) {
          accumulator[appointment.provider.join(',')] = [];
        }
        accumulator[appointment.provider.join(',')].push(appointment);
        return accumulator;
      } else if (appointment.group) {
        if (!accumulator[appointment.group.join(',')]) {
          accumulator[appointment.group.join(',')] = [];
        }
        accumulator[appointment.group.join(',')].push(appointment);
        return accumulator;
      } else {
        throw Error('missing location and provider and group');
      }
    }, {});
  }, [filteredAppointments, state]);

  const groupCollapse = Object.keys(groups).reduce<Record<string, boolean>>((accumulator, state) => {
    accumulator[state] = false;
    return accumulator;
  }, {});

  const compareLuxonDates = (a: DateTime, b: DateTime): number => a.toMillis() - b.toMillis();

  const oldestId = filteredAppointments
    .filter((appointment) => availableStates.includes(appointment.location.state!))
    .sort((a, b) => compareLuxonDates(DateTime.fromISO(a.start!), DateTime.fromISO(b.start!)))?.[0]?.id;
  const showNext = tab === ApptTab.ready;

  return (
    <Box>
      <TrackingBoardFilters tab={tab} />
      <TableContainer sx={{ overflow: 'inherit' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  Status
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  Start time
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  Waiting time
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  Provider
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  Group
                </Typography>
              </TableCell>
              {showEstimated && (
                <TableCell>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Estimated
                  </Typography>
                </TableCell>
              )}
              <TableCell>
                <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  Patient
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  State
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  Reason
                </Typography>
              </TableCell>
              {showProvider && (
                <TableCell>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Provider
                  </Typography>
                </TableCell>
              )}
              <TableCell>
                <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  Chat
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  Action
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isAppointmentsLoading ? (
              <TrackingBoardTableRowSkeleton
                showEstimated={showEstimated}
                showProvider={showProvider}
                isState={!!state}
              />
            ) : state ? (
              filteredAppointments
                .sort((a, b) => compareLuxonDates(DateTime.fromISO(a.start!), DateTime.fromISO(b.start!)))
                .map((appointment) => (
                  <TrackingBoardTableRow
                    key={appointment.id}
                    appointment={appointment}
                    showEstimated={showEstimated}
                    showProvider={showProvider}
                    next={appointment.id === oldestId && showNext}
                  />
                ))
            ) : (
              Object.keys(groups).map((state) => (
                <React.Fragment key={state}>
                  <TableRow>
                    <TableCell
                      sx={{ backgroundColor: otherColors.lightBlue }}
                      colSpan={10 + +showEstimated + +showProvider}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                          {state} - {AllStatesToNames[state as StateType]}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                  {!groupCollapse[state] &&
                    groups[state]
                      .sort((a, b) => compareLuxonDates(DateTime.fromISO(a.start!), DateTime.fromISO(b.start!)))
                      .map((appointment) => (
                        <TrackingBoardTableRow
                          key={appointment.id}
                          appointment={appointment}
                          showEstimated={showEstimated}
                          showProvider={showProvider}
                          next={appointment.id === oldestId && showNext}
                        />
                      ))}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
