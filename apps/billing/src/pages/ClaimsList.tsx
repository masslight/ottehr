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
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel, GridRowSelectionModel } from '@mui/x-data-grid-pro';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BillingClaimItem,
  BillingPatientOption,
  BillingPayerOption,
  BillingService,
  CLAIM_STATUS_FIELDS,
  CLAIM_STATUS_FIELDS_BY_KEY,
  CODE_SYSTEM_CLAIM_TYPE_CODES,
  formatClaimStatusValue,
  getApiError,
  MAX_RUN_RULES_ENGINE_CLAIMS,
  SearchBillingClaimsInput,
} from 'utils';
import {
  runBillingRulesEngine,
  searchBillingClaims,
  searchBillingPatients,
  searchBillingPayers,
  searchBillingServices,
  searchBillingTags,
} from '../api/api';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { claimStatusValueColor, formatAntCaseString } from '../constants/claimStatus';
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
  type?: keyof typeof CODE_SYSTEM_CLAIM_TYPE_CODES | '';
  service?: string;
}

const currencyCol = (field: string, headerName: string, width: number): GridColDef => ({
  field,
  headerName,
  width,
  align: 'right',
  headerAlign: 'right',
  valueFormatter: (params: { value: number }) => formatCurrency(params.value),
});

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
  {
    field: 'type',
    headerName: 'Claim Type',
    minWidth: 130,
    valueFormatter: (params: { value: string }) => formatAntCaseString(params.value),
  },
  {
    field: 'service',
    headerName: 'Service',
    minWidth: 130,
    valueFormatter: (params: { value: string }) => formatAntCaseString(params.value),
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

  const [claims, setClaims] = useState<BillingClaimItem[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [serviceOptions, setServiceOptions] = useState<BillingService[]>([]);

  const [selected, setSelected] = useState<GridRowSelectionModel>([]);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
  const [typeFilter, setTypeFilter] = useState<keyof typeof CODE_SYSTEM_CLAIM_TYPE_CODES | ''>('');
  const [selectedService, setSelectedService] = useState<BillingService | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serviceDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const payerDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patientDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return (): void => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (serviceDebounce.current) clearTimeout(serviceDebounce.current);
      if (payerDebounce.current) clearTimeout(payerDebounce.current);
      if (patientDebounce.current) clearTimeout(patientDebounce.current);
    };
  }, []);

  const fetchClaims = useCallback(
    async (filters: Filters, pagination: GridPaginationModel): Promise<void> => {
      if (!oystehrZambda) return;
      setLoading(true);
      setError(null);
      setSelected([]);
      try {
        const params: SearchBillingClaimsInput = {
          pageSize: pagination.pageSize,
          offset: pagination.page * pagination.pageSize,
        };
        if (filters.searchText) params.searchText = filters.searchText;
        if (filters.arStage) params.arStage = filters.arStage;
        if (filters.tag) params.tag = filters.tag;
        if (filters.createdFrom) params.createdFrom = filters.createdFrom;
        if (filters.createdTo) params.createdTo = filters.createdTo;
        if (filters.payerId) params.payerId = filters.payerId;
        if (filters.patientId) params.patientId = filters.patientId;
        if (filters.type) params.type = filters.type;
        if (filters.service) params.service = filters.service;

        const data = await searchBillingClaims(oystehrZambda, params);
        setClaims(data.claims ?? []);
        setTotalRows(data.total ?? 0);
      } catch (err) {
        setError(getApiError({ error: err, defaultError: 'Failed to load claims' }));
        setClaims([]);
        setTotalRows(0);
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda]
  );

  const searchServices = useCallback(
    (query: string): void => {
      if (!oystehrZambda) return;
      if (serviceDebounce.current) clearTimeout(serviceDebounce.current);
      serviceDebounce.current = setTimeout(async () => {
        const res = await searchBillingServices(oystehrZambda, query ? { name: query } : {});
        setServiceOptions(res.services ?? []);
      }, 300);
    },
    [oystehrZambda]
  );

  const searchPayers = useCallback(
    (query: string): void => {
      if (!oystehrZambda) return;
      if (payerDebounce.current) clearTimeout(payerDebounce.current);
      payerDebounce.current = setTimeout(async () => {
        const res = await searchBillingPayers(oystehrZambda, query ? { name: query } : {});
        setPayerOptions(res.payers ?? []);
      }, 300);
    },
    [oystehrZambda]
  );

  const searchPatients = useCallback(
    (query: string): void => {
      if (!oystehrZambda) return;
      if (patientDebounce.current) clearTimeout(patientDebounce.current);
      patientDebounce.current = setTimeout(async () => {
        const res = await searchBillingPatients(oystehrZambda, query ? { name: query } : {});
        setPatientOptions(res.patients ?? []);
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
        const res = await searchBillingTags(oystehrZambda);
        setTagOptions(res.tags ?? []);
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
      type: overrides?.type ?? typeFilter,
      service: overrides?.service ?? selectedService?.name,
    }),
    [
      searchText,
      arStageFilter,
      tagFilter,
      createdFrom,
      createdTo,
      selectedPayer,
      selectedPatient,
      typeFilter,
      selectedService,
    ]
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
    setTypeFilter('');
    setSelectedService(null);
    const resetPage = { ...paginationModel, page: 0 };
    setPaginationModel(resetPage);
    void fetchClaims({}, resetPage);
  };

  const hasFilters =
    searchText ||
    arStageFilter ||
    tagFilter ||
    createdFrom ||
    createdTo ||
    selectedPayer ||
    selectedPatient ||
    typeFilter ||
    selectedService;

  // Selection is limited to rows a rules engine applies to (any AR stage), and the backend picks
  // each claim's engine from its AR stage: one engine run is kicked off per claim, and each run
  // applies the configured rules, then performs its engine's success effect — submit to the payer
  // or make ready to invoice — or holds its claim, in the background.
  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!oystehrZambda || selected.length === 0) return;
    setSubmitting(true);
    try {
      await runBillingRulesEngine(oystehrZambda, { claimIds: selected.map(String) });
      enqueueSnackbar(
        `Rules started for ${selected.length} claim(s) — each claim will be submitted, made ready to invoice, ` +
          'or held shortly. Refresh to see the results.',
        { variant: 'info' }
      );
      setSelected([]);
    } catch (err) {
      enqueueSnackbar(
        getApiError({
          error: err,
          defaultError: 'Failed to submit claims',
        }),
        { variant: 'error' }
      );
    } finally {
      setSubmitting(false);
      setConfirmingSubmit(false);
      void fetchClaims(currentFilters(), paginationModel);
    }
  }, [oystehrZambda, selected, fetchClaims, currentFilters, paginationModel]);

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Typography variant="h4" color="primary.dark" fontWeight={600}>
          Claims
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {selected.length > 0 && (
            <Tooltip
              title={
                selected.length > MAX_RUN_RULES_ENGINE_CLAIMS
                  ? `Select up to ${MAX_RUN_RULES_ENGINE_CLAIMS} claims to run rules on at once`
                  : ''
              }
            >
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={selected.length > MAX_RUN_RULES_ENGINE_CLAIMS}
                  onClick={() => setConfirmingSubmit(true)}
                >
                  Run rules ({selected.length})
                </Button>
              </span>
            </Tooltip>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/claims/new')}>
            Add Claim
          </Button>
        </Box>
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

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Claim Type</InputLabel>
          <Select
            value={typeFilter}
            label="Claim Type"
            onChange={(e) => {
              const value = e.target.value as '' | keyof typeof CODE_SYSTEM_CLAIM_TYPE_CODES;
              setTypeFilter(value);
              applyFilters({ type: value });
            }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem key={'professional'} value={'professional'}>
              Professional
            </MenuItem>
            <MenuItem key={'institutional'} value={'institutional'}>
              Institutional
            </MenuItem>
          </Select>
        </FormControl>

        <Autocomplete
          size="small"
          options={serviceOptions}
          getOptionLabel={(o) => `${formatAntCaseString(o.name)}`}
          onInputChange={(_, value, reason) => {
            if (reason === 'input') searchServices(value);
          }}
          onOpen={() => searchServices('')}
          filterOptions={(x) => x}
          value={selectedService}
          onChange={(_, v) => {
            setSelectedService(v);
            applyFilters({ service: v?.name ?? '' });
          }}
          renderInput={(params) => <TextField {...params} label="Service" />}
          isOptionEqualToValue={(o, v) => o.name === v.name}
          sx={{ minWidth: 150 }}
        />

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
          label="Service Date From"
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
          label="Service Date To"
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
        isRowSelectable={(params) => !!(params.row as BillingClaimItem).rulesEngine}
        rowSelectionModel={selected}
        onRowSelectionModelChange={setSelected}
        slots={dataGridSlots}
        pagination={true}
        sx={{ ...dataGridSx, height: 'calc(100vh - 310px)' }}
      />

      <ConfirmDialog
        open={confirmingSubmit}
        title="Run claim rules"
        confirmLabel="Run rules"
        loading={submitting}
        onConfirm={() => void handleSubmit()}
        onCancel={() => setConfirmingSubmit(false)}
      >
        Run rules for {selected.length} claim(s)? Each claim runs its AR stage&apos;s rules engine — when every rule
        passes, Insurance Payer AR claims are submitted to the payer and pre-invoice claims are made ready to invoice; a
        Hold keeps a claim for review.
      </ConfirmDialog>
    </Box>
  );
}
