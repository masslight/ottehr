import {
  Alert,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Stack } from '@mui/system';
import { Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FC, useMemo } from 'react';
import { MappedStatusChip } from 'src/components/MappedStatusChip';
import { formatDateToMDYWithTime } from 'utils/lib/utils/date';
import { medicationStatusMapper } from '../../../shared/components/plan-tab/ERxContainer';
import { useChartSection } from '../../../shared/hooks/useChartSection';
import { useAppointmentData } from '../../../shared/stores/appointment/appointment.store';

const getPractitionerName = (practitioner?: Practitioner): string | undefined => {
  if (!practitioner) {
    return;
  }
  const givenName = practitioner.name?.[0]?.given?.at(0) ?? '';
  const familyName = practitioner.name?.[0]?.family ?? '';
  return `${familyName}, ${givenName}`.trim();
};

export const PrescriptionTable: FC = () => {
  const { isLoading, isFetching, error, data: chartFields } = useChartSection('plan');
  const { appointment } = useAppointmentData();
  const userTimezone = DateTime.local().zoneName;
  const appointmentStart = useMemo(
    () => formatDateToMDYWithTime(appointment?.start, userTimezone),
    [appointment?.start, userTimezone]
  );
  const prescriptions = chartFields?.prescribedMedications;

  return (
    <Stack spacing={1}>
      <Stack direction="row" gap={1} alignItems="center">
        <Typography variant="h6" color="primary.dark">
          Ordered prescriptions
        </Typography>
        {(isLoading || isFetching) && <CircularProgress size={16} />}
      </Stack>
      {!!error && <Alert severity="error">Unable to load ordered prescriptions. Please try again later.</Alert>}
      {prescriptions && prescriptions.length === 0 && (
        <Typography variant="body2">No prescriptions have been ordered.</Typography>
      )}
      {prescriptions && prescriptions.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead sx={{ '& .MuiTableCell-head': { fontWeight: 700 } }}>
              <TableRow>
                <TableCell>Medication</TableCell>
                <TableCell>Patient instructions (SIG)</TableCell>
                <TableCell>Visit</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Order added</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prescriptions.map((row) => {
                const rowAdded = formatDateToMDYWithTime(row.added, userTimezone);
                return (
                  <TableRow key={row.resourceId}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.instructions}</TableCell>
                    <TableCell>
                      {appointmentStart && (
                        <>
                          <Typography variant="body2">{appointmentStart.date}</Typography>
                          <Typography variant="body2">{appointmentStart.time}</Typography>
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      {getPractitionerName(
                        chartFields?.prescribedMedicationsRequesterPractitioners?.find(
                          (practitioner) => practitioner.id === row.provider
                        )
                      )}
                    </TableCell>
                    <TableCell>
                      {rowAdded && (
                        <>
                          <Typography variant="body2">{rowAdded.date}</Typography>
                          <Typography variant="body2">{rowAdded.time}</Typography>
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      {!!row.status && <MappedStatusChip status={row.status} mapper={medicationStatusMapper} />}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
};
