import { Clear as ClearIcon, Search as SearchIcon } from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
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
import { BillingPatientOption, BillingPayerOption, chooseJson, ClaimsQueueItemStatuses, EraListItem } from 'utils';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { formatAntCaseString } from '../constants/claimStatus';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';
import { formatCurrency } from '../utils/format';

interface Filters {
  // ERA-level
  checkNumber?: string;
  eraId?: string;
  eraDateFrom?: string;
  eraDateTo?: string;
  eraStatus?: string;
  payerId?: string;
  // Claim-level
  searchText?: string;
  claimStatus?: string;
  dosFrom?: string;
  dosTo?: string;
  patientId?: string;
}

const columns: GridColDef[] = [
  { field: 'checkNumber', headerName: 'Check No.', width: 120 },
  { field: 'paymentDate', headerName: 'Check Date', width: 120 },
  {
    field: 'paymentAmount',
    headerName: 'Amount',
    width: 110,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: { value: number }) => formatCurrency(params.value),
  },
  { field: 'payerName', headerName: 'Payer', flex: 1, minWidth: 200 },
  { field: 'eraId', headerName: 'ERA ID', width: 180 },
  {
    field: 'status',
    headerName: 'Status',
    width: 130,
    renderCell: ({ value }) => (
      <Chip
        label={String(value ?? '')}
        color={value === 'complete' ? 'success' : 'warning'}
        variant="outlined"
        size="small"
        sx={{ borderRadius: '4px', fontSize: 12 }}
      />
    ),
  },
  { field: 'claimCount', headerName: 'Claims', width: 80, align: 'right', headerAlign: 'right' },
  { field: 'matchedCount', headerName: 'Matched', width: 90, align: 'right', headerAlign: 'right' },
  { field: 'unmatchedCount', headerName: 'Unmatched', width: 100, align: 'right', headerAlign: 'right' },
];

export default function ERAList(): ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [eras, setEras] = useState<EraListItem[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });

  // ERA-level filters
  const [checkNumber, setCheckNumber] = useState('');
  const [eraId, setEraId] = useState('');
  const [eraDateFrom, setEraDateFrom] = useState('');
  const [eraDateTo, setEraDateTo] = useState('');
  const [eraStatus, setEraStatus] = useState('');
  const [selectedPayer, setSelectedPayer] = useState<BillingPayerOption | null>(null);
  const [payerOptions, setPayerOptions] = useState<BillingPayerOption[]>([]);

  // Claim-level filters
  const [searchText, setSearchText] = useState('');
  const [claimStatus, setClaimStatus] = useState('');
  const [dosFrom, setDosFrom] = useState('');
  const [dosTo, setDosTo] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<BillingPatientOption | null>(null);
  const [patientOptions, setPatientOptions] = useState<BillingPatientOption[]>([]);

  const { debounce } = useDebounce();

  const fetchEras = useCallback(
    async (filters: Filters, pagination: GridPaginationModel): Promise<void> => {
      if (!oystehrZambda) return;
      setLoading(true);
      setError(null);
      try {
        const body: Record<string, unknown> = {
          pageSize: pagination.pageSize,
          offset: pagination.page * pagination.pageSize,
        };
        if (filters.checkNumber) body.checkNumber = filters.checkNumber;
        if (filters.eraId) body.eraId = filters.eraId;
        if (filters.eraDateFrom) body.eraDateFrom = filters.eraDateFrom;
        if (filters.eraDateTo) body.eraDateTo = filters.eraDateTo;
        if (filters.eraStatus) body.eraStatus = filters.eraStatus;
        if (filters.payerId) body.payerId = filters.payerId;
        if (filters.searchText) body.searchText = filters.searchText;
        if (filters.claimStatus) body.claimStatus = filters.claimStatus;
        if (filters.dosFrom) body.dosFrom = filters.dosFrom;
        if (filters.dosTo) body.dosTo = filters.dosTo;
        if (filters.patientId) body.patientId = filters.patientId;
        const response = await oystehrZambda.zambda.execute({ id: 'search-billing-eras', ...body });
        const data = chooseJson(response);
        setEras(data.eras ?? []);
        setTotalRows(data.total ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda]
  );

  const searchPayers = useCallback(
    (query: string): void => {
      if (!oystehrZambda) return;
      debounce(async () => {
        try {
          const res = await oystehrZambda.zambda.execute({
            id: 'search-billing-payers',
            ...(query ? { name: query } : {}),
          });
          setPayerOptions(chooseJson(res).payers ?? []);
        } catch {
          setPayerOptions([]);
        }
      }, 'payer');
    },
    [oystehrZambda, debounce]
  );

  const searchPatients = useCallback(
    (query: string): void => {
      if (!oystehrZambda) return;
      debounce(async () => {
        try {
          const res = await oystehrZambda.zambda.execute({
            id: 'search-billing-patients',
            ...(query ? { name: query, includeWorkingCopies: true } : {}),
          });
          setPatientOptions(chooseJson(res).patients ?? []);
        } catch {
          setPatientOptions([]);
        }
      }, 'patient');
    },
    [oystehrZambda, debounce]
  );

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!oystehrZambda || initialLoadDone.current) return;
    initialLoadDone.current = true;
    void fetchEras({}, paginationModel);
  }, [oystehrZambda, fetchEras, paginationModel]);

  const currentFilters = useCallback(
    (overrides?: Filters): Filters => ({
      checkNumber: overrides?.checkNumber ?? checkNumber,
      eraId: overrides?.eraId ?? eraId,
      eraDateFrom: overrides?.eraDateFrom ?? eraDateFrom,
      eraDateTo: overrides?.eraDateTo ?? eraDateTo,
      eraStatus: overrides?.eraStatus ?? eraStatus,
      payerId: overrides?.payerId ?? selectedPayer?.payerId,
      searchText: overrides?.searchText ?? searchText,
      claimStatus: overrides?.claimStatus ?? claimStatus,
      dosFrom: overrides?.dosFrom ?? dosFrom,
      dosTo: overrides?.dosTo ?? dosTo,
      patientId: overrides?.patientId ?? selectedPatient?.id,
    }),
    [
      checkNumber,
      eraId,
      eraDateFrom,
      eraDateTo,
      eraStatus,
      selectedPayer,
      searchText,
      claimStatus,
      dosFrom,
      dosTo,
      selectedPatient,
    ]
  );

  const applyFilters = useCallback(
    (overrides?: Filters): void => {
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
      void fetchEras(currentFilters(overrides), { ...paginationModel, page: 0 });
    },
    [fetchEras, currentFilters, paginationModel]
  );

  const handlePaginationChange = (model: GridPaginationModel): void => {
    setPaginationModel(model);
    void fetchEras(currentFilters(), model);
  };

  const handleDebouncedFilter =
    (setter: (v: string) => void, key: keyof Filters) =>
    (value: string): void => {
      setter(value);
      debounce(() => applyFilters({ [key]: value }), key);
    };

  const clearFilters = (): void => {
    setCheckNumber('');
    setEraId('');
    setEraDateFrom('');
    setEraDateTo('');
    setEraStatus('');
    setSelectedPayer(null);
    setSearchText('');
    setClaimStatus('');
    setDosFrom('');
    setDosTo('');
    setSelectedPatient(null);
    const resetPage = { ...paginationModel, page: 0 };
    setPaginationModel(resetPage);
    void fetchEras({}, resetPage);
  };

  const hasFilters =
    checkNumber ||
    eraId ||
    eraDateFrom ||
    eraDateTo ||
    eraStatus ||
    selectedPayer ||
    searchText ||
    claimStatus ||
    dosFrom ||
    dosTo ||
    selectedPatient;

  return (
    <Box sx={{ p: 0 }}>
      <Typography variant="h4" color="primary.dark" fontWeight={600} sx={{ mb: 3 }}>
        ERAs
      </Typography>

      <TextField
        fullWidth
        size="small"
        placeholder="Search by patient name..."
        value={searchText}
        onChange={(e) => handleDebouncedFilter(setSearchText, 'searchText')(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
        ERA Filters
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          label="Check Number"
          value={checkNumber}
          onChange={(e) => handleDebouncedFilter(setCheckNumber, 'checkNumber')(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 140 }}
        />
        <TextField
          size="small"
          label="ERA ID"
          value={eraId}
          onChange={(e) => handleDebouncedFilter(setEraId, 'eraId')(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>ERA Status</InputLabel>
          <Select
            value={eraStatus}
            label="ERA Status"
            onChange={(e) => {
              setEraStatus(e.target.value);
              applyFilters({ eraStatus: e.target.value });
            }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="queued">Queued</MenuItem>
            <MenuItem value="complete">Complete</MenuItem>
            <MenuItem value="error">Error</MenuItem>
            <MenuItem value="partial">Partial</MenuItem>
          </Select>
        </FormControl>
        <Autocomplete
          size="small"
          options={payerOptions}
          getOptionLabel={(o) => o.name}
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
          isOptionEqualToValue={(o, v) => o.payerId === v.payerId}
          sx={{ minWidth: 200 }}
        />
        <TextField
          size="small"
          type="date"
          label="ERA Date From"
          value={eraDateFrom}
          onChange={(e) => {
            setEraDateFrom(e.target.value);
            applyFilters({ eraDateFrom: e.target.value });
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
        <TextField
          size="small"
          type="date"
          label="ERA Date To"
          value={eraDateTo}
          onChange={(e) => {
            setEraDateTo(e.target.value);
            applyFilters({ eraDateTo: e.target.value });
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
      </Box>

      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: 'block' }}>
        Claim Filters (matched ERAs only)
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Claim Status</InputLabel>
          <Select
            value={claimStatus}
            label="Claim Status"
            onChange={(e) => {
              setClaimStatus(e.target.value);
              applyFilters({ claimStatus: e.target.value });
            }}
          >
            <MenuItem value="">All</MenuItem>
            {ClaimsQueueItemStatuses.map((s) => (
              <MenuItem key={s} value={s}>
                {formatAntCaseString(s)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
          label="DOS From"
          value={dosFrom}
          onChange={(e) => {
            setDosFrom(e.target.value);
            applyFilters({ dosFrom: e.target.value });
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
        />
        <TextField
          size="small"
          type="date"
          label="DOS To"
          value={dosTo}
          onChange={(e) => {
            setDosTo(e.target.value);
            applyFilters({ dosTo: e.target.value });
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 150 }}
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
        rows={eras}
        columns={columns}
        loading={loading}
        rowCount={totalRows}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationChange}
        onRowClick={(params) => navigate(`/eras/${params.id}`)}
        disableRowSelectionOnClick
        disableColumnMenu
        pageSizeOptions={[25, 50, 100]}
        slots={dataGridSlots}
        sx={{ ...dataGridSx, height: 'calc(100vh - 430px)' }}
      />
    </Box>
  );
}
