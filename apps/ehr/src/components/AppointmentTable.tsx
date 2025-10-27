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
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement, useState } from 'react';
import { LocationWithWalkinSchedule } from 'src/pages/AddPatient';
import {
  GetVitalsForListOfEncountersResponseData,
  GetVitalsResponseData,
  InPersonAppointmentInformation,
  OrdersForTrackingBoardRow,
  OrdersForTrackingBoardTable,
} from 'utils';
import { dataTestIds } from '../constants/data-test-ids';
import { AppointmentsStatusChipsCount } from './AppointmentStatusChipsCount';
import AppointmentTableHeader from './AppointmentTableHeader';
import AppointmentTableRow from './AppointmentTableRow';
import { ApptTab } from './AppointmentTabs';

interface AppointmentTableProps {
  appointments: InPersonAppointmentInformation[];
  location: LocationWithWalkinSchedule | undefined;
  tab: ApptTab;
  now: DateTime;
  updateAppointments: () => void;
  setEditingComment: (editingComment: boolean) => void;
  orders: OrdersForTrackingBoardTable;
  vitals?: GetVitalsForListOfEncountersResponseData;
}

export default function AppointmentTable({
  appointments,
  location,
  tab,
  now,
  updateAppointments,
  setEditingComment,
  orders,
  vitals,
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
    radiologyOrdersByAppointmentId,
  } = orders;

  const ordersForAppointment = (appointmentId: string, encounterId: string): OrdersForTrackingBoardRow => ({
    inHouseLabOrders: inHouseLabOrdersByAppointmentId[appointmentId],
    externalLabOrders: externalLabOrdersByAppointmentId[appointmentId],
    nursingOrders: nursingOrdersByAppointmentId[appointmentId],
    inHouseMedications: inHouseMedicationsByEncounterId[encounterId],
    radiologyOrders: radiologyOrdersByAppointmentId[appointmentId],
  });

  const vitalsForAppointment = (appointment: InPersonAppointmentInformation): GetVitalsResponseData | undefined => {
    return vitals?.[appointment.encounterId];
  };

  return (
    <>
      <AppointmentsStatusChipsCount appointments={appointments} />
      <Paper>
        <TableContainer sx={{ overflow: 'auto' }} data-testid={dataTestIds.dashboard.appointmentsTable(tab)}>
          <Table style={{ tableLayout: 'auto', width: '100%', maxWidth: '100%' }}>
            <AppointmentTableHeader tab={tab} showTime={showTime} table="waiting-room" />
            <TableBody>
              {tab === ApptTab['in-office'] ? (
                <>
                  <TableRow>
                    <TableCell
                      sx={{ backgroundColor: alpha(theme.palette.secondary.main, 0.08), px: 1.5 }}
                      colSpan={11}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <IconButton onClick={() => setCollapseWaiting(!collapseWaiting)} sx={{ mr: 0.75, p: 0 }}>
                          <ArrowDropDownCircleOutlinedIcon
                            sx={{
                              color: theme.palette.primary.main,
                              rotate: collapseWaiting ? '' : '180deg',
                            }}
                          ></ArrowDropDownCircleOutlinedIcon>
                        </IconButton>
                        <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 600 }}>
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
                            table={'waiting-room'}
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
          <TableContainer sx={{ overflow: 'auto' }}>
            <Table style={{ tableLayout: 'auto', width: '100%', maxWidth: '100%' }}>
              <AppointmentTableHeader tab={tab} showTime={showTime} table="in-exam" />
              <TableBody>
                <TableRow>
                  <TableCell sx={{ backgroundColor: alpha(theme.palette.secondary.main, 0.08), px: 1.5 }} colSpan={11}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <IconButton onClick={() => setCollapseExam(!collapseExam)} sx={{ mr: 0.75, p: 0 }}>
                        <ArrowDropDownCircleOutlinedIcon
                          sx={{
                            color: theme.palette.primary.main,
                            rotate: collapseExam ? '' : '180deg',
                          }}
                        ></ArrowDropDownCircleOutlinedIcon>
                      </IconButton>
                      <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 600 }}>
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
                          vitals={vitalsForAppointment(appointment)}
                          updateAppointments={updateAppointments}
                          setEditingComment={setEditingComment}
                          tab={tab}
                          table="in-exam"
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
