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
import { DateTime } from 'luxon';
import React, { ReactElement, useMemo } from 'react';
import { AllStatesToNames, StateType, TelemedAppointmentInformation } from 'utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useTrackingBoardStore } from '../../state';
import { ApptTab, compareAppointments, compareLuxonDates, filterAppointments } from '../../utils';
import { TrackingBoardFilters } from './TrackingBoardFilters';
import { TrackingBoardTableRow, TrackingBoardTableRowSkeleton } from './TrackingBoardTableRow';

interface AppointmentTableProps {
  tab: ApptTab;
}

export function TrackingBoardTable({ tab }: AppointmentTableProps): ReactElement {
  const theme = useTheme();
  const { appointments, selectedStates, availableStates, isAppointmentsLoading, unsignedFor, showOnlyNext } =
    getSelectors(useTrackingBoardStore, [
      'appointments',
      'selectedStates',
      'unsignedFor',
      'availableStates',
      'isAppointmentsLoading',
      'showOnlyNext',
    ]);

  const filteredAppointments = filterAppointments(appointments, unsignedFor, tab, showOnlyNext, availableStates);

  const showProvider = tab !== ApptTab.ready;

  const groupsSortedByState: Record<string, TelemedAppointmentInformation[]> = useMemo(() => {
    const createGroups = (): Record<string, TelemedAppointmentInformation[]> => {
      return filteredAppointments.reduce<Record<string, TelemedAppointmentInformation[]>>(
        (accumulator, appointment) => {
          if (appointment.location.state) {
            if (!accumulator[appointment.location.state]) {
              accumulator[appointment.location.state] = [];
            }
            accumulator[appointment.location.state].push(appointment);
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
            console.error('missing location and provider and group for appointment', appointment);
            return accumulator;
          }
        },
        {}
      );
    };

    const groups = createGroups();

    const states = selectedStates || [];
    if (!states || states.length === 0) {
      return groups;
    }
    // Rebuild the record with a sorted states as keys
    const sortedGroups: Record<string, TelemedAppointmentInformation[]> = {};
    states.forEach((usState) => {
      if (usState in groups) {
        sortedGroups[usState] = groups[usState];
      }
    });

    return sortedGroups;
  }, [filteredAppointments, selectedStates]);

  const groupCollapse = Object.keys(groupsSortedByState).reduce<Record<string, boolean>>((accumulator, state) => {
    accumulator[state] = false;
    return accumulator;
  }, {});

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
              <TrackingBoardTableRowSkeleton showProvider={showProvider} isState={false} />
            ) : (
              Object.keys(groupsSortedByState).map((state) => (
                <React.Fragment key={state}>
                  <TableRow>
                    <TableCell
                      sx={{ backgroundColor: alpha(theme.palette.secondary.main, 0.08) }}
                      colSpan={9 + +showProvider}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                          {state} - {AllStatesToNames[state as StateType]}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                  {!groupCollapse[state] &&
                    groupsSortedByState[state]
                      .sort((a, b) => compareAppointments(tab === ApptTab['not-signed'], a, b))
                      .map((appointment) => (
                        <TrackingBoardTableRow
                          key={appointment.id}
                          appointment={appointment}
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
