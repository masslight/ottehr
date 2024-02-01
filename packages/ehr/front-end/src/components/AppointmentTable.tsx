import {
  Box,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import AppointmentTableRow from './AppointmentTableRow';
import { ApptTab } from './AppointmentTabs';
import ArrowDropDownCircleOutlinedIcon from '@mui/icons-material/ArrowDropDownCircleOutlined';
import { useState, ReactElement } from 'react';
import { AppointmentInformation } from '../types/types';
import { DateTime } from 'luxon';
import { AppointmentsStatusChipsCount } from './AppointmentStatusChipsCount';

interface AppointmentTableProps {
  appointments: AppointmentInformation[];
  tab: ApptTab;
  now: DateTime;
  updateAppointments: () => Promise<void>;
  setEditingComment: (editingComment: boolean) => void;
}

export default function AppointmentTable({
  appointments,
  tab,
  now,
  updateAppointments,
  setEditingComment,
}: AppointmentTableProps): ReactElement {
  const theme = useTheme();
  const actionButtons = tab === ApptTab.prebooked ? true : false;
  const showTime = tab !== ApptTab.prebooked ? true : false;
  const [collapseWaiting, setCollapseWaiting] = useState<boolean>(false);
  const [collapseExam, setCollapseExam] = useState<boolean>(false);

  return (
    <>
      <AppointmentsStatusChipsCount appointments={appointments} />
      <Paper>
        <TableContainer sx={{ overflow: 'inherit' }}>
          <Table style={{ tableLayout: 'fixed', width: '100%' }}>
            {/* column widths must add up to the table width ^ */}
            <TableHead>
              <TableRow>
                <TableCell style={{ width: '15%' }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Type & Status
                  </Typography>
                </TableCell>
                {showTime && (
                  <TableCell style={{ width: '10%' }}>
                    <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                      Time
                    </Typography>
                  </TableCell>
                )}
                <TableCell style={{ width: '15%' }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Patient
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '20%' }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Reason
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '15%' }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Paperwork
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '20px' }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Notes
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '5%' }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Chat
                  </Typography>
                </TableCell>
                {tab === ApptTab.prebooked && (
                  <TableCell style={{ width: '10%' }}>
                    <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                      Action
                    </Typography>
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {tab === ApptTab['in-office'] ? (
                <>
                  <TableRow>
                    <TableCell sx={{ backgroundColor: alpha(theme.palette.secondary.main, 0.08) }} colSpan={7}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <IconButton onClick={() => setCollapseWaiting(!collapseWaiting)} sx={{ mr: 0.75, p: 0 }}>
                          <ArrowDropDownCircleOutlinedIcon
                            sx={{
                              color: theme.palette.primary.main,
                              rotate: collapseWaiting ? '' : '180deg',
                            }}
                          ></ArrowDropDownCircleOutlinedIcon>
                        </IconButton>
                        {/* todo add a count to the this title */}
                        <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                          Waiting Room (
                          {
                            appointments.filter((appointmentTemp) => {
                              return appointmentTemp.status === 'ARRIVED' || appointmentTemp.status === 'READY';
                            }).length
                          }
                          )
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                  {!collapseWaiting &&
                    // todo add logic to filter out appointments that are not waiting
                    appointments
                      .filter((appointmentTemp) => {
                        return appointmentTemp.status === 'ARRIVED' || appointmentTemp.status === 'READY';
                      })
                      .map((appointment, idx) => {
                        return (
                          <AppointmentTableRow
                            key={idx}
                            appointment={appointment}
                            actionButtons={actionButtons}
                            showTime={showTime}
                            now={now}
                            updateAppointments={updateAppointments}
                            setEditingComment={setEditingComment}
                          ></AppointmentTableRow>
                        );
                      })}
                  <TableRow>
                    <TableCell sx={{ backgroundColor: alpha(theme.palette.secondary.main, 0.08) }} colSpan={7}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <IconButton onClick={() => setCollapseExam(!collapseExam)} sx={{ mr: 0.75, p: 0 }}>
                          <ArrowDropDownCircleOutlinedIcon
                            sx={{
                              color: theme.palette.primary.main,
                              rotate: collapseExam ? '' : '180deg',
                            }}
                          ></ArrowDropDownCircleOutlinedIcon>
                        </IconButton>
                        {/* todo add a count to the this title */}
                        <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                          In Exam (
                          {
                            appointments.filter((appointmentTemp) => {
                              return appointmentTemp.status !== 'ARRIVED' && appointmentTemp.status !== 'READY';
                            }).length
                          }
                          )
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                  {!collapseExam &&
                    // todo add logic to filter out appointments that are not in exam
                    appointments
                      .filter((appointmentTemp) => {
                        return appointmentTemp.status !== 'ARRIVED' && appointmentTemp.status !== 'READY';
                      })
                      .map((appointment, idx) => {
                        return (
                          <AppointmentTableRow
                            key={idx}
                            appointment={appointment}
                            actionButtons={actionButtons}
                            showTime={showTime}
                            now={now}
                            updateAppointments={updateAppointments}
                            setEditingComment={setEditingComment}
                          ></AppointmentTableRow>
                        );
                      })}
                </>
              ) : (
                appointments?.map((appointment, idx) => {
                  return (
                    <AppointmentTableRow
                      key={idx}
                      appointment={appointment}
                      actionButtons={actionButtons}
                      showTime={showTime}
                      now={now}
                      updateAppointments={updateAppointments}
                      setEditingComment={setEditingComment}
                    ></AppointmentTableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  );
}
