import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GetBillingProductivityReportResponse,
  ProductivityReportRow,
} from 'utils/lib/types/data/billing/billing.types';
import { CLAIM_PROVENANCE_ACTIVITY } from 'utils/lib/types/data/billing/claim-history';
import { getBillingProductivityReport } from '../api/api';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { ReportStatusBar } from '../components/ReportStatusBar';
import { useBillingReport } from '../hooks/useBillingReport';
import { otherColors } from '../themes/ottehr/colors';

type WindowPreset = '7d' | '30d' | '90d' | 'all';
type ActorTypeFilter = 'all' | 'human' | 'system';

const WINDOW_LABELS: Record<WindowPreset, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  all: 'All time',
};

const windowDateFrom = (preset: WindowPreset): string | undefined => {
  if (preset === 'all') return undefined;
  const days = { '7d': 7, '30d': 30, '90d': 90 }[preset];
  return DateTime.now().minus({ days }).toISODate() ?? undefined;
};

// column per activity, in workflow order
const ACTIVITY_COLUMNS: { code: string; label: string }[] = [
  { code: CLAIM_PROVENANCE_ACTIVITY.create.code ?? '', label: 'Created' },
  { code: CLAIM_PROVENANCE_ACTIVITY.update.code ?? '', label: 'Updates' },
  { code: CLAIM_PROVENANCE_ACTIVITY.statusChange.code ?? '', label: 'Status Changes' },
  { code: CLAIM_PROVENANCE_ACTIVITY.tagChange.code ?? '', label: 'Tag Changes' },
  { code: CLAIM_PROVENANCE_ACTIVITY.submit.code ?? '', label: 'Submits' },
  { code: CLAIM_PROVENANCE_ACTIVITY.note.code ?? '', label: 'Notes' },
];

const columns: GridColDef[] = [
  {
    field: 'actorName',
    headerName: 'User',
    flex: 1,
    minWidth: 200,
    renderCell: (params) => {
      const row = params.row as ProductivityReportRow;
      return (
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="body2" fontWeight={500}>
            {row.actorName}
          </Typography>
          {row.actorType === 'system' && <Chip size="small" label="System" variant="outlined" />}
        </Stack>
      );
    },
  },
  ...ACTIVITY_COLUMNS.map(
    (activity): GridColDef => ({
      field: activity.code,
      headerName: activity.label,
      width: 130,
      align: 'right',
      headerAlign: 'right',
      sortable: true,
      valueGetter: (params) => (params.row as ProductivityReportRow).actionsByActivity[activity.code] ?? 0,
      renderCell: (params) => {
        const count = (params.row as ProductivityReportRow).actionsByActivity[activity.code] ?? 0;
        return count > 0 ? count.toLocaleString('en-US') : '—';
      },
    })
  ),
  {
    field: 'totalActions',
    headerName: 'Total Actions',
    width: 130,
    align: 'right',
    headerAlign: 'right',
    renderCell: (params) => (
      <Typography variant="body2" fontWeight={600}>
        {(params.row as ProductivityReportRow).totalActions.toLocaleString('en-US')}
      </Typography>
    ),
  },
  {
    field: 'claimsTouched',
    headerName: 'Claims Touched',
    width: 140,
    align: 'right',
    headerAlign: 'right',
    valueGetter: (params) => (params.row as ProductivityReportRow).claimsTouched,
  },
  {
    field: 'lastActionAt',
    headerName: 'Last Action',
    width: 170,
    valueGetter: (params) => (params.row as ProductivityReportRow).lastActionAt,
    renderCell: (params) => {
      const value = (params.row as ProductivityReportRow).lastActionAt;
      return value ? DateTime.fromISO(value).toLocaleString(DateTime.DATETIME_MED) : '—';
    },
  },
];

function StatCard({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Box
      sx={{
        flex: 1,
        bgcolor: 'background.paper',
        border: `1px solid ${otherColors.lightDivider}`,
        borderRadius: 2,
        px: 2.5,
        py: 2,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" color="primary.dark" fontWeight={600} sx={{ mt: 0.5 }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function ProductivityReport(): ReactElement {
  const navigate = useNavigate();

  const [window, setWindow] = useState<WindowPreset>('30d');
  const [actorTypeFilter, setActorTypeFilter] = useState<ActorTypeFilter>('all');
  const [selectedActors, setSelectedActors] = useState<ProductivityReportRow[]>([]);

  const { report, status, loading, error, clearError, refresh } =
    useBillingReport<GetBillingProductivityReportResponse>({
      fetch: useCallback(
        (client: Oystehr, refresh?: boolean) => {
          const dateFrom = windowDateFrom(window);
          return getBillingProductivityReport(client, dateFrom ? { dateFrom } : {}, refresh);
        },
        [window]
      ),
      errorMessage: 'Failed to load productivity report',
    });

  const filteredRows = useMemo(() => {
    let rows = report?.rows ?? [];
    if (actorTypeFilter !== 'all') rows = rows.filter((row) => row.actorType === actorTypeFilter);
    if (selectedActors.length > 0) {
      const refs = new Set(selectedActors.map((actor) => actor.actorRef));
      rows = rows.filter((row) => refs.has(row.actorRef));
    }
    return rows;
  }, [report, actorTypeFilter, selectedActors]);

  const filtersActive = actorTypeFilter !== 'all' || selectedActors.length > 0;
  // when filtered, claims touched is summed per actor, so shared claims count once per user
  const stats = useMemo(() => {
    if (!filtersActive) {
      return {
        actions: report?.totals.actions ?? 0,
        claimsTouched: report?.totals.claimsTouched ?? 0,
        actors: report?.totals.actors ?? 0,
      };
    }
    return {
      actions: filteredRows.reduce((sum, row) => sum + row.totalActions, 0),
      claimsTouched: filteredRows.reduce((sum, row) => sum + row.claimsTouched, 0),
      actors: filteredRows.length,
    };
  }, [report, filteredRows, filtersActive]);

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/reports')}
        sx={{ mb: 1.5, color: 'text.secondary', textTransform: 'none' }}
      >
        Reports
      </Button>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1.5} mb={3}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" color="primary.dark" fontWeight={600}>
            Productivity Report
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Claim actions by user, from the claim change history — {WINDOW_LABELS[window].toLowerCase()}.
          </Typography>
        </Box>
        <ReportStatusBar status={status} loading={loading} onRefresh={refresh} />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
          {error}
        </Alert>
      )}

      <Stack direction="row" alignItems="center" gap={1} mb={2} flexWrap="wrap">
        <Typography variant="body2" color="text.secondary">
          Window:
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={window}
          onChange={(_e, value: WindowPreset | null) => {
            if (!value) return;
            setWindow(value);
          }}
        >
          {(Object.keys(WINDOW_LABELS) as WindowPreset[]).map((preset) => (
            <ToggleButton key={preset} value={preset} sx={{ px: 1.5, py: 0.5, textTransform: 'none' }}>
              {WINDOW_LABELS[preset]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          Show:
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={actorTypeFilter}
          onChange={(_e, value: ActorTypeFilter | null) => value && setActorTypeFilter(value)}
        >
          <ToggleButton value="all" sx={{ px: 1.5, py: 0.5, textTransform: 'none' }}>
            All
          </ToggleButton>
          <ToggleButton value="human" sx={{ px: 1.5, py: 0.5, textTransform: 'none' }}>
            Users only
          </ToggleButton>
          <ToggleButton value="system" sx={{ px: 1.5, py: 0.5, textTransform: 'none' }}>
            System only
          </ToggleButton>
        </ToggleButtonGroup>
        <Autocomplete
          multiple
          size="small"
          sx={{ minWidth: 260, ml: 1 }}
          options={report?.rows ?? []}
          getOptionLabel={(option) => option.actorName}
          isOptionEqualToValue={(option, value) => option.actorRef === value.actorRef}
          value={selectedActors}
          onChange={(_e, value) => setSelectedActors(value)}
          renderInput={(params) => <TextField {...params} placeholder="Filter to specific users…" />}
        />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} mb={2.5}>
        <StatCard label="Total Actions" value={stats.actions.toLocaleString('en-US')} />
        <StatCard label="Claims Touched" value={stats.claimsTouched.toLocaleString('en-US')} />
        <StatCard label="Active Users" value={stats.actors.toLocaleString('en-US')} />
      </Stack>

      <DataGridPro
        // remount on filter change so pagination resets to the first page
        key={`${actorTypeFilter}|${selectedActors.map((actor) => actor.actorRef).join(',')}`}
        autoHeight
        rows={filteredRows}
        getRowId={(row) => (row as ProductivityReportRow).actorRef}
        columns={columns}
        loading={loading}
        disableRowSelectionOnClick
        disableColumnMenu
        pagination
        initialState={{
          pagination: { paginationModel: { pageSize: 50 } },
          sorting: { sortModel: [{ field: 'totalActions', sort: 'desc' }] },
        }}
        pageSizeOptions={[25, 50, 100]}
        sx={dataGridSx}
        slots={dataGridSlots()}
      />
    </Box>
  );
}
