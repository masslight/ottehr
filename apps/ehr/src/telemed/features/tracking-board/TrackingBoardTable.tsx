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
import { AllStatesToNames, ApptTelemedTab, StateType, TelemedAppointmentInformation } from 'utils';
import { dataTestIds } from '../../../constants/data-test-ids';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useTrackingBoardStore } from '../../state';
import { compareAppointments, compareLuxonDates, filterAppointments } from '../../utils';
import { TrackingBoardFilters } from './TrackingBoardFilters';
import { TrackingBoardTableRow, TrackingBoardTableRowSkeleton } from './TrackingBoardTableRow';

interface AppointmentTableProps {
  tab: ApptTelemedTab;
}

interface TrackingBoardColumn {
  id: string;
  label: string;
  conditional?: {
    showWhen: keyof ColumnConditions;
  };
}

interface ColumnConditions {
  showProvider: boolean;
}

const TRACKING_BOARD_COLUMNS_CONFIG: Record<string, TrackingBoardColumn> = {
  STATUS: {
    id: 'status',
    label: 'Type & Status',
  },
  WAITING_TIME: {
    id: 'waitingTime',
    label: 'Waiting time',
  },
  PATIENT_INFO_REASON: {
    id: 'patient-info-reason',
    label: 'Patient & Reason',
  },
  LOCATION: {
    id: 'location',
    label: 'Location',
  },
  PROVIDER: {
    id: 'provider',
    label: 'Provider',
    conditional: {
      showWhen: 'showProvider',
    },
  },
  GROUP: {
    id: 'group',
    label: 'Group',
  },
  CHAT: {
    id: 'chat',
    label: 'Chat',
  },
  ACTION: {
    id: 'action',
    label: 'Action',
  },
};

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

  const showProvider = tab !== ApptTelemedTab.ready;

  const columns = getVisibleColumns({ showProvider });

  const groupsSortedByState: Record<string, TelemedAppointmentInformation[]> = useMemo(() => {
    const createGroups = (): Record<string, TelemedAppointmentInformation[]> => {
      return filteredAppointments.reduce<Record<string, TelemedAppointmentInformation[]>>(
        (accumulator, appointment) => {
          if (appointment.locationVirtual.state) {
            if (!accumulator[appointment.locationVirtual.state]) {
              accumulator[appointment.locationVirtual.state] = [];
            }
            accumulator[appointment.locationVirtual.state].push(appointment);
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
    .filter((appointment) => availableStates.includes(appointment.locationVirtual.state!))
    .sort((a, b) => compareLuxonDates(DateTime.fromISO(a.start!), DateTime.fromISO(b.start!)))?.[0]?.id;
  const showNext = tab === ApptTelemedTab.ready;

  return (
    <Box>
      <TrackingBoardFilters tab={tab} />
      <TableContainer sx={{ overflow: 'inherit' }} data-testid={dataTestIds.telemedEhrFlow.trackingBoardTable}>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.id}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    {column.label}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isAppointmentsLoading ? (
              <TrackingBoardTableRowSkeleton
                showProvider={showProvider}
                isState={false}
                columnsCount={columns.length}
              />
            ) : (
              Object.keys(groupsSortedByState).map((state) => (
                <React.Fragment key={state}>
                  <TableRow data-testid={dataTestIds.telemedEhrFlow.trackingBoardTableGroupRow}>
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
                      .sort((a, b) => compareAppointments(tab === ApptTelemedTab['not-signed'], a, b))
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

const getVisibleColumns = (conditions: ColumnConditions): TrackingBoardColumn[] => {
  return Object.values(TRACKING_BOARD_COLUMNS_CONFIG).filter(
    (column) => !column.conditional || conditions[column.conditional.showWhen]
  );
};
