import {
  alpha,
  Paper,
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import TrackingBoardTableRow from './TrackingBoardTableRow';
import { ReactElement, useMemo, useState } from 'react';
import { ApptTab } from '../utils';
import { getSelectors } from '../../shared/store/getSelectors';
import { useTrackingBoardStore } from '../state';
import ArrowDropDownCircleOutlinedIcon from '@mui/icons-material/ArrowDropDownCircleOutlined';
import { AllStatesToNames, StateType } from '../../types/types';
import { TelemedAppointmentInformation } from 'ehr-utils';
import React from 'react';

interface AppointmentTableProps {
  tab: ApptTab;
}

export function TrackingBoardTable({ tab }: AppointmentTableProps): ReactElement {
  const theme = useTheme();
  const { appointments, state } = getSelectors(useTrackingBoardStore, ['appointments', 'state']);

  const showEstimated = tab === ApptTab.ready;
  const showProvider = tab !== ApptTab.ready;

  const groups = useMemo(() => {
    if (state) {
      return {};
    }
    return appointments.reduce<Record<string, TelemedAppointmentInformation[]>>((accumulator, appointment) => {
      if (!appointment.location.state) {
        throw new Error('No location state provided');
      }
      if (!accumulator[appointment.location.state]) {
        accumulator[appointment.location.state] = [];
      }
      accumulator[appointment.location.state].push(appointment);
      return accumulator;
    }, {});
  }, [appointments, state]);

  const [groupCollapse, setGroupCollapse] = useState(
    Object.keys(groups).reduce<Record<string, boolean>>((accumulator, state) => {
      accumulator[state] = false;
      return accumulator;
    }, {}),
  );

  return (
    <Paper>
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
            {state
              ? appointments.map((appointment) => (
                  <TrackingBoardTableRow
                    key={appointment.id}
                    appointment={appointment}
                    showEstimated={showEstimated}
                    showProvider={showProvider}
                  />
                ))
              : Object.keys(groups).map((state) => (
                  <React.Fragment key={state}>
                    <TableRow>
                      <TableCell
                        sx={{ backgroundColor: alpha(theme.palette.secondary.main, 0.08) }}
                        colSpan={7 + +showEstimated + +showProvider}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <IconButton
                            onClick={() => setGroupCollapse({ ...groupCollapse, [state]: !groupCollapse[state] })}
                            sx={{ mr: 0.75, p: 0 }}
                          >
                            <ArrowDropDownCircleOutlinedIcon
                              sx={{
                                color: theme.palette.primary.main,
                                rotate: groupCollapse[state] ? '' : '180deg',
                              }}
                            ></ArrowDropDownCircleOutlinedIcon>
                          </IconButton>
                          <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                            {state} - {AllStatesToNames[state as StateType]} ({groups[state].length})
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                    {!groupCollapse[state] &&
                      groups[state].map((appointment) => (
                        <TrackingBoardTableRow
                          key={appointment.id}
                          appointment={appointment}
                          showEstimated={showEstimated}
                          showProvider={showProvider}
                        />
                      ))}
                  </React.Fragment>
                ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
