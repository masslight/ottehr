import { Clear as ClearIcon, Search as SearchIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  ChipProps,
  FormControl,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel } from '@mui/x-data-grid-pro';
import { DateTime } from 'luxon';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import {
  BILLING_INVOICE_LIST_STATUSES,
  BillingInvoiceListStatus,
} from 'utils/lib/types/data/billing/billing.constants';
import { BillingInvoiceListItem } from 'utils/lib/types/data/billing/billing.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import { searchBillingInvoices } from '../api/api';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { DateRangeInput } from '../components/DateInput';
import { FacilitySelect } from '../components/FacilitySelect';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';

const STATUS_CHIPS: Record<BillingInvoiceListStatus, { label: string; color: ChipProps['color'] }> = {
  issued: { label: 'Open', color: 'info' },
  balanced: { label: 'Paid', color: 'success' },
  cancelled: { label: 'Void', color: 'default' },
};

// Disable local sorting because only one page is loaded.
const columns = (
  [
    { field: 'patientName', headerName: 'Patient', flex: 1, minWidth: 180 },
    { field: 'serviceDate', headerName: 'Date of Service', width: 130 },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (params: { value: number }) => formatCurrency(params.value),
    },
    {
      field: 'issueDate',
      headerName: 'Issued',
      width: 120,
      valueFormatter: (params: { value: string }) => (params.value ? DateTime.fromISO(params.value).toISODate() : ''),
    },
    { field: 'dueDate', headerName: 'Due', width: 120 },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: ({ row }) => (
        <Chip
          label={STATUS_CHIPS[row.status].label}
          color={STATUS_CHIPS[row.status].color}
          variant="outlined"
          size="small"
          sx={{ borderRadius: '4px', fontSize: 12 }}
        />
      ),
    },
    {
      field: 'hostedInvoiceUrl',
      headerName: 'Invoice',
      width: 100,
      renderCell: ({ row }) =>
        row.hostedInvoiceUrl ? (
          <Link
            href={row.hostedInvoiceUrl}
            target="_blank"
            rel="noopener"
            underline="hover"
            onClick={(event) => event.stopPropagation()}
          >
            View
          </Link>
        ) : (
          '—'
        ),
    },
  ] satisfies GridColDef<BillingInvoiceListItem>[]
).map((column) => ({ ...column, sortable: false }));

interface Filters {
  searchText: string;
  status: BillingInvoiceListStatus | '';
  // The facility's reference, Location/<id>.
  facility: string;
  issuedFrom: string;
  issuedTo: string;
}

const NO_FILTERS: Filters = { searchText: '', status: '', facility: '', issuedFrom: '', issuedTo: '' };

export default function InvoicesList(): ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const { debounce, clear } = useDebounce();

  const [invoices, setInvoices] = useState<BillingInvoiceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const latestRequest = useRef(0);

  const fetchInvoices = useCallback(
    async (next: Filters, pagination: GridPaginationModel): Promise<void> => {
      if (!oystehrZambda) return;
      // Cancel pending searches that use older filters.
      clear();
      const requestId = ++latestRequest.current;
      setLoading(true);
      setError(null);
      try {
        const data = await searchBillingInvoices(oystehrZambda, {
          status: next.status || undefined,
          searchText: next.searchText.trim() || undefined,
          facilityId: next.facility.replace('Location/', '') || undefined,
          issuedFrom: next.issuedFrom || undefined,
          issuedTo: next.issuedTo || undefined,
          offset: pagination.page * pagination.pageSize,
          pageSize: pagination.pageSize,
        });
        if (requestId !== latestRequest.current) return;
        setInvoices(data.invoices);
        setTotal(data.total);
      } catch (err) {
        if (requestId !== latestRequest.current) return;
        setError(getApiError({ error: err, defaultError: 'Failed to load invoices' }));
        setInvoices([]);
      } finally {
        if (requestId === latestRequest.current) setLoading(false);
      }
    },
    [oystehrZambda, clear]
  );

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!oystehrZambda || initialLoadDone.current) return;
    initialLoadDone.current = true;
    void fetchInvoices(NO_FILTERS, paginationModel);
  }, [oystehrZambda, fetchInvoices, paginationModel]);

  const applyFilters = (next: Filters): void => {
    setFilters(next);
    const firstPage = { ...paginationModel, page: 0 };
    setPaginationModel(firstPage);
    void fetchInvoices(next, firstPage);
  };

  const handleSearchTextChange = (searchText: string): void => {
    const next = { ...filters, searchText };
    setFilters(next);
    debounce(() => applyFilters(next), 'searchText');
  };

  return (
    <Box sx={{ p: 0 }}>
      <Typography variant="h4" color="primary.dark" fontWeight={600} sx={{ mb: 3 }}>
        Invoices
      </Typography>

      <TextField
        fullWidth
        size="small"
        placeholder="Search by patient name or claim ID..."
        helperText="Names match from the start. Claim IDs must be entered in full."
        value={filters.searchText}
        onChange={(event) => handleSearchTextChange(event.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="invoice-status-label">Status</InputLabel>
          <Select
            labelId="invoice-status-label"
            value={filters.status}
            label="Status"
            onChange={(event) => applyFilters({ ...filters, status: event.target.value as Filters['status'] })}
          >
            <MenuItem value="">All</MenuItem>
            {BILLING_INVOICE_LIST_STATUSES.map((status) => (
              <MenuItem key={status} value={status}>
                {STATUS_CHIPS[status].label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FacilitySelect
          multiple={false}
          value={filters.facility}
          onChange={(facility) => applyFilters({ ...filters, facility: facility as string })}
        />
        <DateRangeInput
          label="Issued Date"
          valueFrom={filters.issuedFrom}
          valueTo={filters.issuedTo}
          onChange={(issuedFrom, issuedTo) => applyFilters({ ...filters, issuedFrom, issuedTo })}
        />
        {(filters.searchText || filters.status || filters.facility || filters.issuedFrom || filters.issuedTo) && (
          <Button variant="text" size="small" startIcon={<ClearIcon />} onClick={() => applyFilters(NO_FILTERS)}>
            Clear filters
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <DataGridPro
        rows={invoices}
        columns={columns}
        loading={loading}
        rowCount={total}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={(model) => {
          setPaginationModel(model);
          void fetchInvoices(filters, model);
        }}
        onRowClick={({ row }) => row.claimId && navigate(`/claims/${row.claimId}`)}
        disableRowSelectionOnClick
        disableColumnMenu
        pageSizeOptions={[25, 50, 100]}
        slots={dataGridSlots()}
        pagination={true}
        sx={{ ...dataGridSx, height: 'calc(100vh - 330px)' }}
      />
    </Box>
  );
}
