import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { FC } from 'react';
import { Link } from 'react-router-dom';
import { getVisitTypeLabelForTypeAndServiceMode } from 'src/shared/utils';
import { AppointmentHistoryRow, formatMinutes, ServiceMode } from 'utils';
import { formatISOStringToDateAndTime } from '../helpers/formatDateTime';

type PastVisitsTableProps = {
  appointments?: AppointmentHistoryRow[];
  stickyHeader?: boolean;
};

export const PastVisitsTable: FC<PastVisitsTableProps> = (props) => {
  const { appointments, stickyHeader } = props;

  return (
    <Table sx={{ minWidth: 650 }} aria-label="locationsTable" stickyHeader={stickyHeader}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ fontWeight: 'bold' }} align="left">
            Date & Time
          </TableCell>
          <TableCell sx={{ fontWeight: 'bold' }} align="left">
            Visit ID
          </TableCell>
          <TableCell sx={{ fontWeight: 'bold' }} align="left">
            Type
          </TableCell>
          <TableCell sx={{ fontWeight: 'bold' }} align="left">
            Office
          </TableCell>
          <TableCell sx={{ fontWeight: 'bold' }} align="left">
            Length
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {appointments?.map((appointment, idx) => (
          <TableRow key={idx}>
            <TableCell align="left">
              {appointment.dateTime ? appointment.dateTime && formatISOStringToDateAndTime(appointment.dateTime) : '-'}
            </TableCell>
            <TableCell>
              <Link
                to={
                  appointment.serviceMode === ServiceMode.virtual
                    ? `/telemed/appointments/${appointment.appointmentId}`
                    : `/visit/${appointment.appointmentId}`
                }
                target="_blank"
              >
                {appointment.appointmentId || '-'}
              </Link>
            </TableCell>
            <TableCell align="left">
              {getVisitTypeLabelForTypeAndServiceMode({ type: appointment.type, serviceMode: appointment.serviceMode })}
            </TableCell>
            <TableCell align="left">{appointment.office || '-'}</TableCell>
            <TableCell align="left">
              {appointment.length !== undefined
                ? `${formatMinutes(appointment.length)} ${appointment.length === 1 ? 'min' : 'mins'}`
                : '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
