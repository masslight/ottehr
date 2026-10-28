import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import { Stack } from '@mui/system';
import { DataGridPro, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid-pro';
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
  // Newest sent first
  const prescriptions = useMemo(
    () => [...(chartFields?.prescribedMedications ?? [])].sort((a, b) => (b.sent ?? '').localeCompare(a.sent ?? '')),
    [chartFields?.prescribedMedications]
  );
  const [selectedIds, setSelectedIds] = useState<GridRowSelectionModel>([]);
  const [toCancel, setToCancel] = useState<PrescribedMedicationDTO[]>([]);
  // A row that stops being cancellable on a refetch leaves the selection.
  const selected = prescriptions.filter(
    (prescription) => isPrescriptionCancellable(prescription) && selectedIds.includes(prescription.resourceId!)
  );

  const columns = useMemo(
    (): GridColDef<PrescribedMedicationDTO>[] => [
      { sortable: false, field: 'name', headerName: 'Medication', flex: 1, minWidth: 200 },
      {
        sortable: false,
        field: 'visit',
        headerName: 'Visit',
        width: 120,
        // The date only, in the browser's timezone
        valueGetter: () => appointmentStart?.date,
      },
      {
        sortable: false,
        field: 'provider',
        headerName: 'Provider',
        width: 160,
        valueGetter: ({ row }) =>
          getPractitionerName(
            chartFields?.prescribedMedicationsRequesterPractitioners?.find(
              (practitioner) => practitioner.id === row.provider
            )
          ),
      },
      {
        sortable: false,
        field: 'status',
        headerName: 'Status',
        flex: 1,
        minWidth: 200,
        renderCell: ({ row }) => {
          const { chip, detail } = prescriptionStatusView(row);
          const statusChip = chip ? (
            <MappedStatusChip status={chip} mapper={prescriptionChipMapper} />
          ) : (
            !!row.status && <MappedStatusChip status={row.status} mapper={medicationStatusMapper} />
          );
          // The latest event shows on hover; describeChild keeps the chip's text as its name and the event as its
          // description.
          return detail ? (
            <Tooltip title={detail} describeChild>
              <span>{statusChip}</span>
            </Tooltip>
          ) : (
            statusChip
          );
        },
      },
      {
        sortable: false,
        field: 'actions',
        headerName: '',
        width: 60,
        // The menu (portalled, but still a React child) doesn't change the selection.
        renderCell: ({ row }) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <PrescriptionActions prescription={row} onCancel={() => setToCancel([row])} />
          </Box>
        ),
      },
    ],
    [appointmentStart, chartFields?.prescribedMedicationsRequesterPractitioners]
  );

  return (
    <Stack spacing={1}>
      <Stack direction="row" gap={1} alignItems="center">
        <Typography variant="h6" color="primary.dark">
          Ordered prescriptions
        </Typography>
        {(isLoading || isFetching) && <CircularProgress size={16} />}
      </Stack>
      {!!error && <Alert severity="error">Unable to load ordered prescriptions. Please try again later.</Alert>}
      {chartFields && prescriptions.length === 0 && (
        <Typography variant="body2">No prescriptions have been ordered.</Typography>
      )}
      {prescriptions.length > 0 && (
        <>
          {/* Always there, so the table doesn't move when rows are selected. */}
          <Stack direction="row" gap={2} alignItems="center" sx={{ minHeight: 32 }}>
            {selected.length > 0 && <Typography variant="body2">{selected.length} selected</Typography>}
            <Button
              size="small"
              variant="outlined"
              color="error"
              disabled={selected.length === 0}
              onClick={() => setToCancel(selected)}
            >
              Cancel prescriptions…
            </Button>
            {selected.length > 0 && (
              <Button size="small" onClick={() => setSelectedIds([])}>
                Clear
              </Button>
            )}
          </Stack>
          <Paper>
            <DataGridPro
              rows={prescriptions}
              columns={columns}
              getRowId={(row) => row.resourceId!}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              autoHeight
              pagination
              hideFooter={prescriptions.length <= 10}
              disableColumnMenu
              pageSizeOptions={[10]}
              checkboxSelection
              isRowSelectable={({ row }) => isPrescriptionCancellable(row)}
              // A click anywhere on a selectable row selects it.
              getRowClassName={({ row }) => (isPrescriptionCancellable(row) ? 'selectable' : '')}
              rowSelectionModel={selected.map((prescription) => prescription.resourceId!)}
              onRowSelectionModelChange={setSelectedIds}
              sx={{
                border: 0,
                '.selectable': { cursor: 'pointer' },
                '.MuiDataGrid-columnHeaderTitle': {
                  fontWeight: 500,
                },
              }}
            />
          </Paper>
        </>
      )}
      {toCancel.length > 0 && (
        <CancelPrescriptionsDialog
          prescriptions={toCancel}
          onClose={() => setToCancel([])}
          onSent={async () => {
            setSelectedIds([]);
            await refetch();
          }}
        />
      )}
    </Stack>
  );
};
