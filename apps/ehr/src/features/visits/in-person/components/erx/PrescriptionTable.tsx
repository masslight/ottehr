import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import {
  Alert,
  Box,
  CircularProgress,
  Collapse,
  IconButton,
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
import { FC, useMemo, useState } from 'react';
import { MappedStatusChip } from 'src/components/MappedStatusChip';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
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

type StatusDescription = { label: string; colors: keyof typeof medicationStatusMapper };

// How an event code describes a prescription ordered through Surescripts
const EVENT_STATUS_DESCRIPTIONS: Record<string, StatusDescription> = {
  ordered: { label: 'Ordered', colors: 'draft' },
  accepted: { label: 'Accepted', colors: 'active' },
  dispensed: { label: 'Dispensed', colors: 'completed' },
  partiallydispensed: { label: 'Partially dispensed', colors: 'active' },
  notdispensed: { label: 'Not dispensed', colors: 'stopped' },
  transferred: { label: 'Transferred', colors: 'on-hold' },
};

const getEventStatus = (code: string): StatusDescription | undefined => {
  const lowercaseCode = code.toLowerCase();
  return lowercaseCode.startsWith('error')
    ? { label: 'Error', colors: 'entered-in-error' }
    : EVENT_STATUS_DESCRIPTIONS[lowercaseCode];
};

// Describes a prescription by its latest event. Prescriptions without a known event keep their status
const getStatusDescription = (row: PrescribedMedicationDTO): StatusDescription | undefined => {
  const latestCode = row.events?.at(-1)?.code;
  return latestCode ? getEventStatus(latestCode) : undefined;
};

const StatusDescriptionChip: FC<{ statusDescription: StatusDescription }> = ({ statusDescription }) => (
  <MappedStatusChip
    status={statusDescription.label}
    mapper={{ [statusDescription.label]: medicationStatusMapper[statusDescription.colors] }}
  />
);

const PrescriptionRow: FC<{
  row: PrescribedMedicationDTO;
  appointmentStart?: { date: string; time: string };
  userTimezone: string;
  practitioners?: Practitioner[];
}> = ({ row, appointmentStart, userTimezone, practitioners }) => {
  const [open, setOpen] = useState(false);
  const rowAdded = formatDateToMDYWithTime(row.added, userTimezone);
  const events = row.events ?? [];
  const statusDescription = getStatusDescription(row);

  return (
    <>
      <TableRow sx={{ '& > td': { borderBottom: events.length > 0 ? 'none' : undefined } }}>
        <TableCell padding="checkbox">
          {events.length > 0 && (
            <IconButton
              size="small"
              aria-label={open ? 'Hide order history' : 'Show order history'}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          )}
        </TableCell>
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
          {getPractitionerName(practitioners?.find((practitioner) => practitioner.id === row.provider))}
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
          {statusDescription ? (
            <StatusDescriptionChip statusDescription={statusDescription} />
          ) : (
            !!row.status && <MappedStatusChip status={row.status} mapper={medicationStatusMapper} />
          )}
        </TableCell>
      </TableRow>
      {events.length > 0 && (
        <TableRow>
          <TableCell colSpan={7} sx={{ py: 0 }}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ py: 1, pl: 6 }}>
                <Typography variant="subtitle2" color="primary.dark">
                  Order history
                </Typography>
                {events.map((event, index) => {
                  const recorded = formatDateToMDYWithTime(event.recorded, userTimezone);
                  const source =
                    event.source ??
                    getPractitionerName(
                      practitioners?.find((practitioner) => practitioner.id === event.practitionerId)
                    );
                  return (
                    <Stack key={`${event.code}-${index}`} direction="row" gap={2}>
                      <Typography variant="body2" sx={{ minWidth: 160 }}>
                        {recorded ? `${recorded.date} ${recorded.time}` : ''}
                      </Typography>
                      <Typography variant="body2">{event.description}</Typography>
                      {source && (
                        <Typography variant="body2" color="text.secondary">
                          {source}
                        </Typography>
                      )}
                    </Stack>
                  );
                })}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
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
                <TableCell padding="checkbox" />
                <TableCell>Medication</TableCell>
                <TableCell>Patient instructions (SIG)</TableCell>
                <TableCell>Visit</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Order added</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prescriptions.map((row) => (
                <PrescriptionRow
                  key={row.resourceId}
                  row={row}
                  appointmentStart={appointmentStart}
                  userTimezone={userTimezone}
                  practitioners={chartFields?.prescribedMedicationsRequesterPractitioners}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
};
