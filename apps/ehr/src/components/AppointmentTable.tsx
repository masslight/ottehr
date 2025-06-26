import ArrowDropDownCircleOutlinedIcon from '@mui/icons-material/ArrowDropDownCircleOutlined';
import {
  alpha,
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
  useTheme,
} from '@mui/material';
import { Location } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ReactElement, useState } from 'react';
import { InPersonAppointmentInformation, OrdersForTrackingBoardRow, OrdersForTrackingBoardTable } from 'utils';
import {
  ACTION_WIDTH,
  ACTION_WIDTH_MIN,
  CHAT_WIDTH,
  CHAT_WIDTH_MIN,
  GO_TO_ONE_BUTTON_WIDTH,
  GO_TO_ONE_BUTTON_WIDTH_MIN,
  GO_TO_TWO_BUTTON_WIDTH,
  GO_TO_TWO_BUTTON_WIDTH_MIN,
  NEXT_WIDTH,
  NOTES_WIDTH,
  NOTES_WIDTH_MIN,
  PATIENT_AND_REASON_WIDTH_MIN,
  PROVIDER_WIDTH,
  PROVIDER_WIDTH_MIN,
  ROOM_WIDTH,
  ROOM_WIDTH_MIN,
  TIME_WIDTH,
  TIME_WIDTH_MIN,
  TYPE_WIDTH,
  TYPE_WIDTH_MIN,
  VISIT_ICONS_WIDTH,
  VISIT_ICONS_WIDTH_MIN,
} from '../constants';
import { dataTestIds } from '../constants/data-test-ids';
import { AppointmentsStatusChipsCount } from './AppointmentStatusChipsCount';
import AppointmentTableRow from './AppointmentTableRow';
import { ApptTab } from './AppointmentTabs';

interface AppointmentTableProps {
  appointments: InPersonAppointmentInformation[];
  location: Location | undefined;
  tab: ApptTab;
  now: DateTime;
  updateAppointments: () => void;
  setEditingComment: (editingComment: boolean) => void;
  orders: OrdersForTrackingBoardTable;
}

export default function AppointmentTable({
  appointments,
  location,
  tab,
  now,
  updateAppointments,
  setEditingComment,
  orders,
}: AppointmentTableProps): ReactElement {
  const theme = useTheme();
  const actionButtons = tab === ApptTab.prebooked ? true : false;
  const showTime = tab !== ApptTab.prebooked ? true : false;
  const [collapseWaiting, setCollapseWaiting] = useState<boolean>(false);
  const [collapseExam, setCollapseExam] = useState<boolean>(false);

  const {
    inHouseLabOrdersByAppointmentId,
    externalLabOrdersByAppointmentId,
    nursingOrdersByAppointmentId,
    inHouseMedicationsByEncounterId,
  } = orders;

  const ordersForAppointment = (appointmentId: string, encounterId: string): OrdersForTrackingBoardRow => ({
    inHouseLabOrders: inHouseLabOrdersByAppointmentId[appointmentId],
    externalLabOrders: externalLabOrdersByAppointmentId[appointmentId],
    nursingOrders: nursingOrdersByAppointmentId[appointmentId],
    inHouseMedications: inHouseMedicationsByEncounterId[encounterId],
  });

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
                <TableCell style={{ width: TYPE_WIDTH, minWidth: TYPE_WIDTH_MIN }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    {tab !== ApptTab.prebooked ? 'Type & Status' : 'Type'}
                  </Typography>
                </TableCell>
                {showTime && (
                  <TableCell style={{ width: TIME_WIDTH, minWidth: TIME_WIDTH_MIN }}>
                    <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                      Time
                    </Typography>
                  </TableCell>
                )}
                <TableCell style={{ minWidth: PATIENT_AND_REASON_WIDTH_MIN }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Patient & Reason
                  </Typography>
                </TableCell>
                {(tab === ApptTab['in-office'] || tab === ApptTab.completed) && (
                  <TableCell style={{ width: ROOM_WIDTH, minWidth: ROOM_WIDTH_MIN }}>
                    <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                      Room
                    </Typography>
                  </TableCell>
                )}
                <TableCell style={{ width: PROVIDER_WIDTH, minWidth: PROVIDER_WIDTH_MIN }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Provider
                  </Typography>
                </TableCell>
                <TableCell style={{ width: VISIT_ICONS_WIDTH, minWidth: VISIT_ICONS_WIDTH_MIN }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    {tab === ApptTab.completed ? 'Orders' : 'Visit Components'}
                  </Typography>
                </TableCell>
                <TableCell style={{ width: NOTES_WIDTH, minWidth: NOTES_WIDTH_MIN }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Notes
                  </Typography>
                </TableCell>
                <TableCell style={{ width: CHAT_WIDTH, minWidth: CHAT_WIDTH_MIN }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Chat
                  </Typography>
                </TableCell>
                <TableCell
                  style={{
                    width: tab === ApptTab.prebooked ? GO_TO_ONE_BUTTON_WIDTH : GO_TO_TWO_BUTTON_WIDTH,
                    minWidth: tab === ApptTab.prebooked ? GO_TO_ONE_BUTTON_WIDTH_MIN : GO_TO_TWO_BUTTON_WIDTH_MIN,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontSize: '14px', textAlign: 'center' }}>
                    Go to...
                  </Typography>
                </TableCell>
                {tab === ApptTab.prebooked && (
                  <TableCell style={{ width: ACTION_WIDTH, minWidth: ACTION_WIDTH_MIN }}>
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
                    <TableCell sx={{ backgroundColor: alpha(theme.palette.secondary.main, 0.08) }} colSpan={10}>
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
                            orders={ordersForAppointment(appointment.id, appointment.encounterId)}
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
                      orders={ordersForAppointment(appointment.id, appointment.encounterId)}
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
                  <TableCell style={{ width: TYPE_WIDTH, minWidth: TYPE_WIDTH_MIN }}></TableCell>
                  {showTime && <TableCell style={{ width: TIME_WIDTH, minWidth: TIME_WIDTH_MIN }}></TableCell>}
                  <TableCell style={{ minWidth: PATIENT_AND_REASON_WIDTH_MIN }}></TableCell>
                  <TableCell style={{ width: ROOM_WIDTH, minWidth: ROOM_WIDTH_MIN }}></TableCell>
                  <TableCell style={{ width: PROVIDER_WIDTH, minWidth: PROVIDER_WIDTH_MIN }}></TableCell>
                  <TableCell style={{ width: VISIT_ICONS_WIDTH, minWidth: VISIT_ICONS_WIDTH_MIN }}></TableCell>
                  <TableCell style={{ width: NOTES_WIDTH, minWidth: NOTES_WIDTH_MIN }}></TableCell>
                  <TableCell style={{ width: CHAT_WIDTH, minWidth: CHAT_WIDTH_MIN }}></TableCell>
                  <TableCell
                    style={{ width: GO_TO_TWO_BUTTON_WIDTH, minWidth: GO_TO_TWO_BUTTON_WIDTH_MIN }}
                  ></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ backgroundColor: alpha(theme.palette.secondary.main, 0.08) }} colSpan={10}>
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
                          orders={ordersForAppointment(appointment.id, appointment.encounterId)}
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
