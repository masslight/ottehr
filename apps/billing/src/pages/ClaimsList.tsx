import { Add as AddIcon, Clear as ClearIcon, Search as SearchIcon } from '@mui/icons-material';
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
import {
  BillingClaimItem,
  BillingPatientOption,
  BillingPayerOption,
  chooseJson,
  CLAIM_STATUS_FIELDS,
  CLAIM_STATUS_FIELDS_BY_KEY,
  formatClaimStatusValue,
} from 'utils';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { claimStatusValueColor } from '../constants/claimStatus';
import { useApiClients } from '../hooks/useAppClients';
import { formatCurrency } from '../utils/format';

interface Filters {
  searchText?: string;
  arStage?: string;
  tag?: string;
  createdFrom?: string;
  createdTo?: string;
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

// One column per claim-status indicator, generated from the shared registry. AR Stage replaces the
// former single "Status" column; the remaining indicators follow it.
const statusColumns: GridColDef[] = CLAIM_STATUS_FIELDS.map((field) => ({
  field: field.key,
  headerName: field.label,
  width: field.key === 'arStage' ? 170 : 160,
  sortable: false,
  valueGetter: (params) => (params.row as BillingClaimItem).statuses?.[field.key] ?? '',
  renderCell: ({ value }) => {
    const code = value as string;
    if (!code) return null;
    return (
      <Chip
        label={formatClaimStatusValue(field, code)}
        color={claimStatusValueColor(code)}
        variant="outlined"
        size="small"
        sx={{ borderRadius: '4px', fontSize: 12 }}
      />
    );
  },
}));

const columns: GridColDef[] = [
  { field: 'patientName', headerName: 'Patient Name', flex: 1, minWidth: 150 },
  { field: 'serviceDate', headerName: 'Service Date', width: 120 },
  { field: 'payerName', headerName: 'Payer Name', flex: 1, minWidth: 160 },
  { field: 'payerId', headerName: 'Payer ID', width: 100 },
  ...statusColumns,
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

  const [claims, setClaims] = useState<BillingClaimItem[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });

  const [payerOptions, setPayerOptions] = useState<BillingPayerOption[]>([]);
  const [patientOptions, setPatientOptions] = useState<BillingPatientOption[]>([]);

  const [searchText, setSearchText] = useState('');
  const [arStageFilter, setArStageFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [tagOptions, setTagOptions] = useState<{ id: string; name: string }[]>([]);
  const [createdFrom, setDosFrom] = useState('');
  const [createdTo, setDosTo] = useState('');
  const [selectedPayer, setSelectedPayer] = useState<BillingPayerOption | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<BillingPatientOption | null>(null);

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
        if (filters.arStage) body.arStage = filters.arStage;
        if (filters.tag) body.tag = filters.tag;
        if (filters.createdFrom) body.createdFrom = filters.createdFrom;
        if (filters.createdTo) body.createdTo = filters.createdTo;
        if (filters.payerId) body.payerId = filters.payerId;
        if (filters.patientId) body.patientId = filters.patientId;

        const response = await oystehrZambda.zambda.execute({ id: 'search-billing-claims', ...body });
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
          id: 'search-billing-payers',
          ...(query ? { name: query } : {}),
        });
        setPayerOptions(chooseJson(res).payers ?? []);
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
    const loadTags = async (): Promise<void> => {
      try {
        const res = await oystehrZambda.zambda.execute({ id: 'search-billing-tags' });
        setTagOptions(chooseJson(res).tags ?? []);
      } catch (err) {
        console.error('Failed to load tags:', err);
        setTagOptions([]);
      }
    };
    void loadTags();
  }, [oystehrZambda, fetchClaims, paginationModel]);

  const currentFilters = useCallback(
    (overrides?: Filters): Filters => ({
      searchText: overrides?.searchText ?? searchText,
      arStage: overrides?.arStage ?? arStageFilter,
      tag: overrides?.tag ?? tagFilter,
      createdFrom: overrides?.createdFrom ?? createdFrom,
      createdTo: overrides?.createdTo ?? createdTo,
      payerId: overrides?.payerId ?? selectedPayer?.payerId,
      patientId: overrides?.patientId ?? selectedPatient?.id,
    }),
    [searchText, arStageFilter, tagFilter, createdFrom, createdTo, selectedPayer, selectedPatient]
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
    setArStageFilter('');
    setTagFilter('');
    setDosFrom('');
    setDosTo('');
    setSelectedPayer(null);
    setSelectedPatient(null);
    const resetPage = { ...paginationModel, page: 0 };
    setPaginationModel(resetPage);
    void fetchClaims({}, resetPage);
  };

  const hasFilters =
    searchText || arStageFilter || tagFilter || createdFrom || createdTo || selectedPayer || selectedPatient;

  return (
    <Box sx={{ p: 0 }}>
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
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>AR Stage</InputLabel>
          <Select
            value={arStageFilter}
            label="AR Stage"
            onChange={(e) => {
              setArStageFilter(e.target.value);
              applyFilters({ arStage: e.target.value });
            }}
          >
            <MenuItem value="">All</MenuItem>
            {CLAIM_STATUS_FIELDS_BY_KEY.arStage.options.map((o) => (
              <MenuItem key={o.code} value={o.code}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }} disabled={tagOptions.length === 0}>
          <InputLabel>Tag</InputLabel>
          <Select
            value={tagFilter}
            label="Tag"
            onChange={(e) => {
              setTagFilter(e.target.value);
              applyFilters({ tag: e.target.value });
            }}
          >
            <MenuItem value="">All</MenuItem>
            {tagOptions.map((t) => (
              <MenuItem key={t.id} value={t.name}>
                {t.name}
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
          isOptionEqualToValue={(o, v) => o.payerId === v.payerId}
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
          label="Created From"
          value={createdFrom}
          onChange={(e) => {
            setDosFrom(e.target.value);
            applyFilters({ createdFrom: e.target.value });
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />

        <TextField
          size="small"
          type="date"
          label="Created To"
          value={createdTo}
          onChange={(e) => {
            setDosTo(e.target.value);
            applyFilters({ createdTo: e.target.value });
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
        slots={dataGridSlots}
        sx={{ ...dataGridSx, height: 'calc(100vh - 310px)' }}
      />
    </Box>
  );
}
