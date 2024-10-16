import {
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
import { Location } from 'fhir/r4';
import { DateTime } from 'luxon';
import { ReactElement, useState } from 'react';
import { UCAppointmentInformation } from 'ehr-utils';
import { AppointmentsStatusChipsCount } from './AppointmentStatusChipsCount';
import AppointmentTableRow from './AppointmentTableRow';
import { ApptTab } from './AppointmentTabs';

interface AppointmentTableProps {
  appointments: UCAppointmentInformation[];
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
                  <TableCell style={{ width: '13%' }}>
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
                <TableCell style={{ width: '15%' }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Reason
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '14%' }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Visit Components
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '14%' }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Provider
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '14%' }}>
                  <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Group
                  </Typography>
                </TableCell>
                <TableCell style={{ width: '14%' }}>
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
              {
                appointments?.map((appointment, idx) => {
                  return (
                    <AppointmentTableRow
                      key={idx}
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
              }
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  );
}
