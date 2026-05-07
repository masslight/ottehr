import { Add as AddIcon, Clear as ClearIcon, Search as SearchIcon } from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel } from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chooseJson, ClaimsQueueItemStatuses } from 'utils';
import { CLAIM_STATUS_COLORS, formatClaimStatus } from '../constants/claimStatus';
import { useApiClients } from '../hooks/useAppClients';
import { otherColors } from '../themes/ottehr/colors';
import { formatCurrency } from '../utils/format';

interface ClaimRow {
  id: string;
  status: string;
  patientName: string;
  patientDob: string;
  payerName: string;
  payerId: string;
  memberId: string;
  serviceDate: string;
  facility: string;
  renderingProvider: string;
  billed: number;
  allowed: number;
  insurancePaid: number;
  patientResp: number;
  patientPaid: number;
  claimBalance: number;
  responsibleParty: string;
}

interface PayerOption {
  id: string;
  name: string;
  payerId: string;
}

interface PatientOption {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
}

interface Filters {
  searchText?: string;
  status?: string;
  dosFrom?: string;
  dosTo?: string;
  payerId?: string;
  patientId?: string;
}

const currencyCol = (field: string, headerName: string, width: number): GridColDef => ({
  field,
  headerName,
  width,
  align: 'right',
  headerAlign: 'right',
  valueFormatter: (params: { value: number }) => formatCurrency(params.value),
});

const columns: GridColDef[] = [
  { field: 'patientName', headerName: 'Patient Name', flex: 1, minWidth: 150 },
  { field: 'serviceDate', headerName: 'Service Date', width: 120 },
  { field: 'payerName', headerName: 'Payer Name', flex: 1, minWidth: 160 },
  { field: 'payerId', headerName: 'Payer ID', width: 100 },
  {
    field: 'status',
    headerName: 'Status',
    width: 130,
    renderCell: ({ value }) => {
      const color = CLAIM_STATUS_COLORS[value as string] ?? 'default';
      const label = formatClaimStatus(value as string);
      return (
        <Chip label={label} color={color} variant="outlined" size="small" sx={{ borderRadius: '4px', fontSize: 12 }} />
      );
    },
  },
  currencyCol('billed', 'Billed', 100),
  currencyCol('allowed', 'Allowed', 100),
  currencyCol('insurancePaid', 'Insurance Paid', 120),
  currencyCol('patientResp', 'Patient Resp', 110),
  currencyCol('patientPaid', 'Patient Paid', 110),
  currencyCol('claimBalance', 'Claim Balance', 120),
  { field: 'facility', headerName: 'Facility', width: 140 },
  { field: 'renderingProvider', headerName: 'Provider', width: 140 },
  { field: 'responsibleParty', headerName: 'Responsible Party', width: 140 },
];

export default function ClaimsList(): ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });

  const [payerOptions, setPayerOptions] = useState<PayerOption[]>([]);
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([]);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dosFrom, setDosFrom] = useState('');
  const [dosTo, setDosTo] = useState('');
  const [selectedPayer, setSelectedPayer] = useState<PayerOption | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const payerDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patientDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return (): void => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (payerDebounce.current) clearTimeout(payerDebounce.current);
      if (patientDebounce.current) clearTimeout(patientDebounce.current);
    };
  }, []);

  const fetchClaims = useCallback(
    async (filters: Filters, pagination: GridPaginationModel): Promise<void> => {
      if (!oystehrZambda) return;
      setLoading(true);
      setError(null);
      try {
        const body: Record<string, unknown> = {
          pageSize: pagination.pageSize,
          offset: pagination.page * pagination.pageSize,
        };
        if (filters.searchText) body.searchText = filters.searchText;
        if (filters.status) body.status = filters.status;
        if (filters.dosFrom) body.dosFrom = filters.dosFrom;
        if (filters.dosTo) body.dosTo = filters.dosTo;
        if (filters.payerId) body.payerId = filters.payerId;
        if (filters.patientId) body.patientId = filters.patientId;

        const response = await oystehrZambda.zambda.execute({ id: 'get-billing-claims', ...body });
        const data = chooseJson(response);
        setClaims(data.claims ?? []);
        setTotalRows(data.total ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setClaims([]);
        setTotalRows(0);
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda]
  );

  const searchPayers = useCallback(
    (query: string): void => {
      if (!oystehrZambda) return;
      if (payerDebounce.current) clearTimeout(payerDebounce.current);
      payerDebounce.current = setTimeout(async () => {
        const res = await oystehrZambda.zambda.execute({
          id: 'search-billing-organizations',
          type: 'pay',
          ...(query ? { name: query } : {}),
        });
        setPayerOptions(chooseJson(res).organizations ?? []);
      }, 300);
    },
    [oystehrZambda]
  );

  const searchPatients = useCallback(
    (query: string): void => {
      if (!oystehrZambda) return;
      if (patientDebounce.current) clearTimeout(patientDebounce.current);
      patientDebounce.current = setTimeout(async () => {
        const res = await oystehrZambda.zambda.execute({
          id: 'search-billing-patients',
          ...(query ? { name: query } : {}),
        });
        setPatientOptions(chooseJson(res).patients ?? []);
      }, 300);
    },
    [oystehrZambda]
  );

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!oystehrZambda || initialLoadDone.current) return;
    initialLoadDone.current = true;
    void fetchClaims({}, paginationModel);
  }, [oystehrZambda, fetchClaims, paginationModel]);

  const currentFilters = useCallback(
    (overrides?: Filters): Filters => ({
      searchText: overrides?.searchText ?? searchText,
      status: overrides?.status ?? statusFilter,
      dosFrom: overrides?.dosFrom ?? dosFrom,
      dosTo: overrides?.dosTo ?? dosTo,
      payerId: overrides?.payerId ?? selectedPayer?.payerId,
      patientId: overrides?.patientId ?? selectedPatient?.id,
    }),
    [searchText, statusFilter, dosFrom, dosTo, selectedPayer, selectedPatient]
  );

  const applyFilters = useCallback(
    (overrides?: Filters): void => {
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
      void fetchClaims(currentFilters(overrides), { ...paginationModel, page: 0 });
    },
    [fetchClaims, currentFilters, paginationModel]
  );

  const handleSearchChange = (value: string): void => {
    setSearchText(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => applyFilters({ searchText: value }), 400);
  };

  const handlePaginationChange = (model: GridPaginationModel): void => {
    setPaginationModel(model);
    void fetchClaims(currentFilters(), model);
  };

  const clearFilters = (): void => {
    setSearchText('');
    setStatusFilter('');
    setDosFrom('');
    setDosTo('');
    setSelectedPayer(null);
    setSelectedPatient(null);
    const resetPage = { ...paginationModel, page: 0 };
    setPaginationModel(resetPage);
    void fetchClaims({}, resetPage);
  };

  const hasFilters = searchText || statusFilter || dosFrom || dosTo || selectedPayer || selectedPatient;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" color="primary.dark" fontWeight={600}>
          Claims
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => navigate('/claims/new')}>
          Create
        </Button>
      </Box>

      <TextField
        fullWidth
        size="small"
        placeholder="Search by patient name..."
        value={searchText}
        onChange={(e) => handleSearchChange(e.target.value)}
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
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Claim Status</InputLabel>
          <Select
            value={statusFilter}
            label="Claim Status"
            onChange={(e) => {
              setStatusFilter(e.target.value);
              applyFilters({ status: e.target.value });
            }}
          >
            <MenuItem value="">All</MenuItem>
            {ClaimsQueueItemStatuses.map((s) => (
              <MenuItem key={s} value={s}>
                {formatClaimStatus(s)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Autocomplete
          size="small"
          options={payerOptions}
          getOptionLabel={(o) => `${o.name} (${o.payerId})`}
          onInputChange={(_, value, reason) => {
            if (reason === 'input') searchPayers(value);
          }}
          onOpen={() => searchPayers('')}
          filterOptions={(x) => x}
          value={selectedPayer}
          onChange={(_, v) => {
            setSelectedPayer(v);
            applyFilters({ payerId: v?.payerId ?? '' });
          }}
          renderInput={(params) => <TextField {...params} label="Payer" />}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          sx={{ minWidth: 200 }}
        />

        <Autocomplete
          size="small"
          options={patientOptions}
          getOptionLabel={(o) => o.name || `${o.firstName} ${o.lastName}`}
          onInputChange={(_, value, reason) => {
            if (reason === 'input') searchPatients(value);
          }}
          onOpen={() => searchPatients('')}
          filterOptions={(x) => x}
          value={selectedPatient}
          onChange={(_, v) => {
            setSelectedPatient(v);
            applyFilters({ patientId: v?.id ?? '' });
          }}
          renderInput={(params) => <TextField {...params} label="Patient" />}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          sx={{ minWidth: 200 }}
        />

        <TextField
          size="small"
          type="date"
          label="Service Date From"
          value={dosFrom}
          onChange={(e) => {
            setDosFrom(e.target.value);
            applyFilters({ dosFrom: e.target.value });
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />

        <TextField
          size="small"
          type="date"
          label="Service Date To"
          value={dosTo}
          onChange={(e) => {
            setDosTo(e.target.value);
            applyFilters({ dosTo: e.target.value });
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />

        {hasFilters && (
          <Button variant="text" size="small" startIcon={<ClearIcon />} onClick={clearFilters}>
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
        rows={claims}
        columns={columns}
        loading={loading}
        rowCount={totalRows}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationChange}
        pageSizeOptions={[25, 50, 100]}
        onRowClick={(params) => navigate(`/claims/${params.id}`)}
        disableRowSelectionOnClick
        disableColumnMenu
        checkboxSelection
        slots={{
          noRowsOverlay: () => (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Typography color="text.secondary">{loading ? '' : 'No claims found.'}</Typography>
            </Box>
          ),
          loadingOverlay: () => (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress size={32} />
            </Box>
          ),
        }}
        sx={{
          bgcolor: 'background.paper',
          border: 'none',
          borderRadius: 1,
          fontSize: 14,
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: '#FAFAFA',
            borderBottom: `1px solid ${otherColors.lightDivider}`,
          },
          '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600, fontSize: 13, color: 'primary.dark' },
          '& .MuiDataGrid-cell': {
            borderBottom: `1px solid ${otherColors.lightDivider}`,
            fontSize: 14,
            color: otherColors.tableRow,
          },
          '& .MuiDataGrid-row': { cursor: 'pointer' },
          '& .MuiDataGrid-row:hover': { bgcolor: otherColors.apptHover },
          height: 'calc(100vh - 310px)',
        }}
      />
    </Box>
  );
}
