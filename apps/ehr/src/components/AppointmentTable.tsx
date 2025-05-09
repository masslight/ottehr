import ArrowDropDownCircleOutlinedIcon from '@mui/icons-material/ArrowDropDownCircleOutlined';
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
import { Location } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ReactElement, useState } from 'react';
import { InPersonAppointmentInformation } from 'utils';
import { AppointmentsStatusChipsCount } from './AppointmentStatusChipsCount';
import AppointmentTableRow from './AppointmentTableRow';
import { ApptTab } from './AppointmentTabs';
import {
  NEXT_WIDTH,
  TYPE_WIDTH,
  TIME_WIDTH,
  PATIENT_AND_REASON_WIDTH,
  INTAKE_WIDTH,
  VISIT_ICONS_WIDTH,
  NOTES_WIDTH,
  CHAT_WIDTH,
  ACTION_WIDTH,
  PROVIDER_WIDTH,
  GROUP_WIDTH,
} from '../constants';
import { dataTestIds } from '../constants/data-test-ids';

interface AppointmentTableProps {
  appointments: InPersonAppointmentInformation[];
  location: Location | undefined;
  tab: ApptTab;
  now: DateTime;
  updateAppointments: () => void;
  setEditingComment: (editingComment: boolean) => void;
}

export default function AppointmentTable({
  appointments,
  location,
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
        <TableContainer sx={{ overflow: 'inherit' }} data-testid={dataTestIds.dashboard.appointmentsTable(tab)}>
          <Table style={{ tableLayout: 'fixed', width: '100%' }}>
            {/* column widths must add up to the table width ^ */}
            <TableHead>
              <TableRow
                sx={{ '& .MuiTableCell-root': { px: '8px' }, display: { xs: 'none', sm: 'none', md: 'table-row' } }}
              >
                <TableCell style={{ width: NEXT_WIDTH }}></TableCell>
                <TableCell style={{ width: TYPE_WIDTH }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    {tab !== ApptTab.prebooked ? 'Type & Status' : 'Type'}
                  </Typography>
                </TableCell>
                {showTime && (
                  <TableCell style={{ width: TIME_WIDTH }}>
                    <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                      Time
                    </Typography>
                  </TableCell>
                )}
                <TableCell style={{ width: PATIENT_AND_REASON_WIDTH }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Patient & Reason
                  </Typography>
                </TableCell>
                <TableCell style={{ width: INTAKE_WIDTH, textAlign: 'center' }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Intake
                  </Typography>
                </TableCell>
                {(tab === ApptTab['in-office'] || tab === ApptTab.completed) && (
                  <TableCell style={{ width: TIME_WIDTH }}>
                    <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                      Room
                    </Typography>
                  </TableCell>
                )}
                <TableCell style={{ width: PROVIDER_WIDTH }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Provider
                  </Typography>
                </TableCell>
                <TableCell style={{ width: GROUP_WIDTH }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Group
                  </Typography>
                </TableCell>
                <TableCell style={{ width: VISIT_ICONS_WIDTH }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Visit Components
                  </Typography>
                </TableCell>
                <TableCell style={{ width: NOTES_WIDTH }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Notes
                  </Typography>
                </TableCell>
                <TableCell style={{ width: CHAT_WIDTH }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Chat
                  </Typography>
                </TableCell>
                {tab === ApptTab.prebooked && (
                  <TableCell style={{ width: ACTION_WIDTH }}>
                    <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                      Arrived
                    </Typography>
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {tab === ApptTab['in-office'] ? (
                <>
                  <TableRow>
                    <TableCell sx={{ backgroundColor: alpha(theme.palette.secondary.main, 0.08) }} colSpan={11}>
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
                              return appointmentTemp.status === 'arrived' || appointmentTemp.status === 'ready';
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
                        return appointmentTemp.status === 'arrived' || appointmentTemp.status === 'ready';
                      })
                      .map((appointment) => {
                        return (
                          <AppointmentTableRow
                            key={appointment.id}
                            appointment={appointment}
                            location={location}
                            actionButtons={actionButtons}
                            showTime={showTime}
                            now={now}
                            updateAppointments={updateAppointments}
                            setEditingComment={setEditingComment}
                            tab={tab}
                          ></AppointmentTableRow>
                        );
                      })}
                </>
              ) : (
                appointments?.map((appointment) => {
                  return (
                    <AppointmentTableRow
                      key={appointment.id}
                      appointment={appointment}
                      location={location}
                      actionButtons={actionButtons}
                      showTime={showTime}
                      now={now}
                      updateAppointments={updateAppointments}
                      setEditingComment={setEditingComment}
                      tab={tab}
                    ></AppointmentTableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {tab === ApptTab['in-office'] && (
        <Paper sx={{ marginTop: '16px' }}>
          <TableContainer sx={{ overflow: 'inherit' }}>
            <Table style={{ tableLayout: 'fixed', width: '100%' }}>
              <TableHead>
                <TableRow
                  sx={{ '& .MuiTableCell-root': { px: '8px' }, display: { xs: 'none', sm: 'none', md: 'table-row' } }}
                >
                  <TableCell style={{ width: NEXT_WIDTH }}></TableCell>
                  <TableCell style={{ width: TYPE_WIDTH }}></TableCell>
                  {showTime && <TableCell style={{ width: TIME_WIDTH }}></TableCell>}
                  <TableCell style={{ width: PATIENT_AND_REASON_WIDTH }}></TableCell>
                  <TableCell style={{ width: INTAKE_WIDTH }}></TableCell>
                  <TableCell style={{ width: PROVIDER_WIDTH }}></TableCell>
                  <TableCell style={{ width: GROUP_WIDTH }}></TableCell>
                  <TableCell style={{ width: VISIT_ICONS_WIDTH }}></TableCell>
                  <TableCell style={{ width: NOTES_WIDTH }}></TableCell>
                  <TableCell style={{ width: CHAT_WIDTH }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ backgroundColor: alpha(theme.palette.secondary.main, 0.08) }} colSpan={11}>
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
                        Exam Rooms (
                        {
                          appointments.filter((appointmentTemp) => {
                            return appointmentTemp.status !== 'arrived' && appointmentTemp.status !== 'ready';
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
                      return appointmentTemp.status !== 'arrived' && appointmentTemp.status !== 'ready';
                    })
                    .map((appointment) => {
                      return (
                        <AppointmentTableRow
                          key={appointment.id}
                          appointment={appointment}
                          location={location}
                          actionButtons={actionButtons}
                          showTime={showTime}
                          now={now}
                          updateAppointments={updateAppointments}
                          setEditingComment={setEditingComment}
                          tab={tab}
                        ></AppointmentTableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </>
  );
}
