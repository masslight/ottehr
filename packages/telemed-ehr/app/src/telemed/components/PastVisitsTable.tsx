import { FC } from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { Link } from 'react-router-dom';
import { AppointmentHistoryRow } from '../../hooks/useGetPatient';
import { formatISOStringToDateAndTime } from '../../helpers/formatDateTime';
import { formatMinutes } from '../../helpers/visitDurationUtils';

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
              {appointment.dateTime ? formatISOStringToDateAndTime(appointment.dateTime) : '-'}
            </TableCell>
            <TableCell>
              <Link
                to={
                  appointment.type === 'Telemed'
                    ? `/telemed/appointments/${appointment.id}`
                    : `/visit/${appointment.id}`
                }
                target="_blank"
              >
                {appointment.id || '-'}
              </Link>
            </TableCell>
            <TableCell align="left">{appointment.type || '-'}</TableCell>
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
