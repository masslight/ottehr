import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import Oystehr from '@oystehr/sdk';
import { ReactElement, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GetBillingAgingReceivablesReportResponse } from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import { getBillingAgingReceivablesReport } from '../api/api';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { ReportStatusBar } from '../components/ReportStatusBar';
import { useBillingReport } from '../hooks/useBillingReport';
import { useBillingReportHistory } from '../hooks/useBillingReportHistory';
import { otherColors } from '../themes/ottehr/colors';

const currencyCol = (field: string, headerName: string, width = 160): GridColDef => ({
  field,
  headerName,
  width,
  align: 'right',
  headerAlign: 'right',
  valueFormatter: (params: { value: number }) => formatCurrency(params.value),
});

const payerColumns: GridColDef[] = [
  { field: 'payerName', headerName: 'Payer', flex: 1, minWidth: 220 },
  { field: 'payerId', headerName: 'Payer ID', width: 120 },
  { field: 'claimCount', headerName: 'Claims', width: 100, align: 'right', headerAlign: 'right' },
  currencyCol('totalBilled', 'Total Charged'),
];

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }): ReactElement {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 160,
        bgcolor: 'background.paper',
        border: `1px solid ${otherColors.lightDivider}`,
        borderRadius: 2,
        px: 2.5,
        py: 2,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Typography>
      <Typography variant="h5" fontWeight={600} sx={{ mt: 0.5, color: 'primary.dark' }} component="div">
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" component="div">
          {hint}
        </Typography>
      )}
    </Box>
  );
}

export default function AgingReceivablesReport(): ReactElement {
  const navigate = useNavigate();

  const { entries: history, reload: reloadHistory } = useBillingReportHistory('aging-receivables');
  const { report, status, loading, error, clearError, refresh } =
    useBillingReport<GetBillingAgingReceivablesReportResponse>({
      fetch: useCallback(
        (client: Oystehr, refresh?: boolean) => getBillingAgingReceivablesReport(client, undefined, refresh),
        []
      ),
      errorMessage: 'Failed to load aging receivables report',
    });

  const insurance = report?.insurance ?? { claimCount: 0, totalBilled: 0 };
  const patient = report?.patient ?? { invoiceCount: 0, amountDue: 0 };

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
            Aging Receivables Report
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Outstanding AR: claims submitted to insurance awaiting an ERA, and patient invoices sent but unpaid.
          </Typography>
        </Box>
        <ReportStatusBar
          status={status}
          loading={loading}
          history={{
            entries: history,
            onOpen: reloadHistory,
            onView: () => undefined,
            onRun: () => refresh(),
            windowed: false,
          }}
        />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={clearError}>
          {error}
        </Alert>
      )}

      <Typography variant="h5" color="primary.dark" fontWeight={600} sx={{ mb: 1.5 }}>
        Insurance Receivables
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} mb={2.5}>
        <StatCard
          label="Claims Awaiting ERA"
          value={insurance.claimCount.toLocaleString('en-US')}
          hint="submitted, no remittance posted"
        />
        <StatCard label="Total Charged" value={formatCurrency(insurance.totalBilled)} hint="charge-master amounts" />
      </Stack>
      <DataGridPro
        autoHeight
        rows={report?.payerRows ?? []}
        getRowId={(row) => row.payerRef || 'unknown'}
        columns={payerColumns}
        loading={loading}
        disableRowSelectionOnClick
        disableColumnMenu
        hideFooter
        sx={{ ...dataGridSx, mb: 4, '& .MuiDataGrid-row': { cursor: 'default' } }}
        slots={dataGridSlots()}
      />

      <Typography variant="h5" color="primary.dark" fontWeight={600} sx={{ mb: 1.5 }}>
        Patient Receivables
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} mb={2.5}>
        <StatCard
          label="Unpaid Invoices"
          value={patient.invoiceCount.toLocaleString('en-US')}
          hint="sent, not yet paid"
        />
        <StatCard label="Outstanding Amount" value={formatCurrency(patient.amountDue)} hint="remaining balances" />
      </Stack>
    </Box>
  );
}
