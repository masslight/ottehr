import BlockIcon from '@mui/icons-material/Block';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import { Alert, Box, Button, CircularProgress, IconButton, Paper, Tooltip, Typography } from '@mui/material';
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
import { PrescriptionHistoryButton } from './PrescriptionHistory';
import { compoundIngredientText } from './prescriptionLines';
import {
  isPrescriptionActionAvailable,
  PrescriptionAction,
  prescriptionActionUnavailableText,
  prescriptionStatusView,
} from './prescriptionStatus';
import { SendToAnotherPharmacyDialog } from './SendToAnotherPharmacyDialog';

// The chips reuse the medication status colors.
const prescriptionChipMapper = {
  Sent: medicationStatusMapper.completed,
  Sending: medicationStatusMapper.active,
  'Cancel requested': medicationStatusMapper['entered-in-error'],
  Error: medicationStatusMapper.stopped,
  Cancelled: medicationStatusMapper.cancelled,
};

const ROW_ACTIONS: { action: PrescriptionAction; label: string; icon: JSX.Element }[] = [
  { action: 'sendToAnotherPharmacy', label: 'Send to another pharmacy', icon: <LocalPharmacyIcon fontSize="small" /> },
  { action: 'cancel', label: 'Cancel prescription', icon: <BlockIcon fontSize="small" /> },
];

/** A row's action buttons; one that doesn't apply to the row is disabled and says why. */
const PrescriptionActionButtons: FC<{
  prescription: PrescribedMedicationDTO;
  onAction: (action: PrescriptionAction) => void;
}> = ({ prescription, onAction }) => (
  <>
    {ROW_ACTIONS.map(({ action, label, icon }) => {
      const unavailable = prescriptionActionUnavailableText(action, [prescription]);
      return (
        <Tooltip key={action} title={unavailable ?? label}>
          <span>
            <IconButton aria-label={label} size="small" disabled={!!unavailable} onClick={() => onAction(action)}>
              {icon}
            </IconButton>
          </span>
        </Tooltip>
      );
    })}
  </>
);

const isRowSelectable = (prescription: PrescribedMedicationDTO): boolean =>
  isPrescriptionActionAvailable('cancel', prescription) ||
  isPrescriptionActionAvailable('sendToAnotherPharmacy', prescription);

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
  const [toSendElsewhere, setToSendElsewhere] = useState<PrescribedMedicationDTO[]>([]);
  // A row that stops qualifying for any action on a refetch leaves the selection.
  const selected = prescriptions.filter(
    (prescription) => isRowSelectable(prescription) && selectedIds.includes(prescription.resourceId!)
  );
  // An action applies to a selection only if it applies to every ticked row; otherwise it says why not.
  const unavailable = (action: PrescriptionAction): string | undefined =>
    selected.length ? prescriptionActionUnavailableText(action, selected) : undefined;
  const cancelUnavailable = unavailable('cancel');
  const sendElsewhereUnavailable = unavailable('sendToAnotherPharmacy');

  const columns = useMemo(
    (): GridColDef<PrescribedMedicationDTO>[] => [
      {
        sortable: false,
        field: 'name',
        headerName: 'Medication',
        flex: 1,
        minWidth: 200,
        // A compound reads as its name with its dosage form and the amount of each ingredient underneath.
        renderCell: ({ row }) =>
          row.order?.compound ? (
            <Box sx={{ py: 1, whiteSpace: 'normal' }}>
              Compound: {row.name}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                {[row.order.compound.dosageForm, ...row.order.compound.ingredients.map(compoundIngredientText)]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            </Box>
          ) : (
            row.name
          ),
      },
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
        headerName: 'Actions',
        width: 130,
        // The buttons and the history dialog (portalled, but still a React child) don't change the selection.
        renderCell: ({ row }) => (
          <Box onClick={(event) => event.stopPropagation()}>
            <PrescriptionHistoryButton
              prescription={row}
              practitionerName={getPractitionerName}
              practitioners={chartFields?.prescribedMedicationsRequesterPractitioners}
              visitDate={appointmentStart?.date}
            />
            <PrescriptionActionButtons
              prescription={row}
              onAction={(action) => (action === 'cancel' ? setToCancel : setToSendElsewhere)([row])}
            />
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
            <Tooltip title={cancelUnavailable ?? ''}>
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<BlockIcon />}
                  disabled={selected.length === 0 || !!cancelUnavailable}
                  onClick={() => setToCancel(selected)}
                >
                  Cancel prescriptions…
                </Button>
              </span>
            </Tooltip>
            <Tooltip title={sendElsewhereUnavailable ?? ''}>
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LocalPharmacyIcon />}
                  disabled={selected.length === 0 || !!sendElsewhereUnavailable}
                  onClick={() => setToSendElsewhere(selected)}
                >
                  Send to another pharmacy…
                </Button>
              </span>
            </Tooltip>
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
              // A compound's ingredients line makes its row taller.
              getRowHeight={({ model }) => (model.order?.compound ? 'auto' : undefined)}
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              autoHeight
              pagination
              hideFooter={prescriptions.length <= 10}
              disableColumnMenu
              pageSizeOptions={[10]}
              checkboxSelection
              isRowSelectable={({ row }) => isRowSelectable(row)}
              // A click anywhere on a selectable row selects it.
              getRowClassName={({ row }) => (isRowSelectable(row) ? 'selectable' : '')}
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
      {toSendElsewhere.length > 0 && (
        <SendToAnotherPharmacyDialog
          prescriptions={toSendElsewhere}
          onClose={() => setToSendElsewhere([])}
          onSent={async () => {
            setSelectedIds([]);
            await refetch();
          }}
        />
      )}
    </Stack>
  );
};
