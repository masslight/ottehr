import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
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
import { CancelPrescriptionsDialog } from './CancelPrescriptionsDialog';
import { isPrescriptionCancellable, prescriptionStatusView } from './prescriptionStatus';

// The chips reuse the medication status colors.
const prescriptionChipMapper = {
  Sent: medicationStatusMapper.completed,
  Sending: medicationStatusMapper.active,
  'Cancel requested': medicationStatusMapper['entered-in-error'],
  Error: medicationStatusMapper.stopped,
  Cancelled: medicationStatusMapper.cancelled,
};

const PrescriptionActions: FC<{ prescription: PrescribedMedicationDTO; onCancel: () => void }> = ({
  prescription,
  onCancel,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  return (
    <>
      <IconButton aria-label="More actions" onClick={(event) => setAnchorEl(event.currentTarget)}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem
          disabled={!isPrescriptionCancellable(prescription)}
          onClick={() => {
            setAnchorEl(null);
            onCancel();
          }}
        >
          Cancel prescription…
        </MenuItem>
      </Menu>
    </>
  );
};

const getPractitionerName = (practitioner?: Practitioner): string | undefined => {
  if (!practitioner) {
    return;
  }
  const givenName = practitioner.name?.[0]?.given?.at(0) ?? '';
  const familyName = practitioner.name?.[0]?.family ?? '';
  return `${familyName}, ${givenName}`.trim();
};

export const PrescriptionTable: FC = () => {
  const { isLoading, isFetching, error, refetch, data: chartFields } = useChartSection('plan');
  const { appointment } = useAppointmentData();
  const userTimezone = DateTime.local().zoneName;
  const appointmentStart = useMemo(
    () => formatDateToMDYWithTime(appointment?.start, userTimezone),
    [appointment?.start, userTimezone]
  );
  const prescriptions = chartFields?.prescribedMedications;
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [toCancel, setToCancel] = useState<PrescribedMedicationDTO[]>([]);
  const cancellable = useMemo(() => prescriptions?.filter(isPrescriptionCancellable) ?? [], [prescriptions]);
  // A row that stops being cancellable on a refetch leaves the selection.
  const checked = cancellable.filter((prescription) => checkedIds.includes(prescription.resourceId!));
  const toggle = (id: string): void =>
    setCheckedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

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
      {checked.length > 0 && (
        <Stack direction="row" gap={2} alignItems="center">
          <Typography variant="body2">{checked.length} selected</Typography>
          <Button size="small" variant="outlined" color="error" onClick={() => setToCancel(checked)}>
            Cancel prescriptions…
          </Button>
          <Button size="small" onClick={() => setCheckedIds([])}>
            Clear
          </Button>
        </Stack>
      )}
      {prescriptions && prescriptions.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead sx={{ '& .MuiTableCell-head': { fontWeight: 700 } }}>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    inputProps={{ 'aria-label': 'Select all cancellable prescriptions' }}
                    disabled={cancellable.length === 0}
                    checked={cancellable.length > 0 && checked.length === cancellable.length}
                    indeterminate={checked.length > 0 && checked.length < cancellable.length}
                    onChange={() =>
                      setCheckedIds(
                        checked.length === cancellable.length ? [] : cancellable.map((item) => item.resourceId!)
                      )
                    }
                  />
                </TableCell>
                <TableCell>Medication</TableCell>
                <TableCell>Visit</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {prescriptions.map((row) => {
                const { chip, detail } = prescriptionStatusView(row);
                const checkable = isPrescriptionCancellable(row);
                return (
                  // A checkable row toggles from a click anywhere on it.
                  <TableRow
                    key={row.resourceId}
                    hover
                    onClick={checkable ? () => toggle(row.resourceId!) : undefined}
                    sx={{ cursor: checkable ? 'pointer' : undefined }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        inputProps={{ 'aria-label': `Select ${row.name}` }}
                        disabled={!checkable}
                        checked={checked.includes(row)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggle(row.resourceId!)}
                      />
                    </TableCell>
                    <TableCell>{row.name}</TableCell>
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
                      {chip ? (
                        <MappedStatusChip status={chip} mapper={prescriptionChipMapper} />
                      ) : (
                        !!row.status && <MappedStatusChip status={row.status} mapper={medicationStatusMapper} />
                      )}
                      {detail && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {detail}
                        </Typography>
                      )}
                    </TableCell>
                    {/* The menu (portalled, but still a React child) doesn't toggle the row. */}
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <PrescriptionActions prescription={row} onCancel={() => setToCancel([row])} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {toCancel.length > 0 && (
        <CancelPrescriptionsDialog
          prescriptions={toCancel}
          onClose={() => setToCancel([])}
          onSent={async () => {
            setCheckedIds([]);
            await refetch();
          }}
        />
      )}
    </Stack>
  );
};
