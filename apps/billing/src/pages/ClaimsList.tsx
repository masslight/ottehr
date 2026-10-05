import { Add as AddIcon, Clear as ClearIcon, Search as SearchIcon } from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel, GridRowSelectionModel } from '@mui/x-data-grid-pro';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { CODE_SYSTEM_CLAIM_TYPE_CODES } from 'utils/lib/helpers/rcm/constants';
import { EXPORT_CLAIMS_MATCH_LIMIT } from 'utils/lib/types/data/billing/billing.constants';
import { ExportBillingClaimsInput, SearchBillingClaimsInput } from 'utils/lib/types/data/billing/billing.schemas';
import {
  BillingClaimItem,
  BillingPatientOption,
  BillingPayerOption,
  BillingService,
} from 'utils/lib/types/data/billing/billing.types';
import {
  ALL_CLAIM_STATUS_OPTIONS_2,
  ALL_CLAIM_STATUS_OPTIONS_BY_GROUP,
  AR_STAGE,
  CLAIM_STATUS_FIELDS,
  CLAIM_STATUS_FIELDS_BY_KEY,
  CLAIM_STATUS_GROUPS,
  ClaimStatusOption,
  emptyClaimStatusValues,
  formatAntCaseString,
  formatClaimStatusValue,
} from 'utils/lib/types/data/billing/claim-status';
import { NonInsuranceOrganizationItem } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { MAX_RUN_RULES_ENGINE_CLAIMS } from 'utils/lib/types/data/billing/rules-engine.schemas';
import { formatCurrency } from 'utils/lib/utils/convert';
import {
  exportBillingClaims,
  getBillingClaimsExportStatus,
  runBillingRulesEngine,
  searchBillingClaims,
  searchBillingNonInsuranceOrgs,
  searchBillingPatients,
  searchBillingServices,
  searchBillingTags,
} from '../api/api';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DateRangeInput } from '../components/DateInput';
import InvoiceClaimsDialog from '../components/InvoiceClaimsDialog';
import { usePayerSearch } from '../components/PayerSelect';
import { WarningIconWithTooltip } from '../components/WarningIconWithTooltip';
import { claimStatusValueColor, PROVISIONAL_BALANCE_HINT } from '../constants/claimStatus';
import { useApiClients } from '../hooks/useAppClients';
import { downloadTextFile } from '../utils/downloadFile';
import { pollExportTask } from '../utils/pollExportTask';

type ClaimTypeCode = keyof typeof CODE_SYSTEM_CLAIM_TYPE_CODES;

const CLAIM_TYPE_OPTIONS: { value: ClaimTypeCode; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'institutional', label: 'Institutional' },
];

interface Filters {
  searchText?: string;
  arStage?: string[];
  status?: string[];
  tag?: string[];
  createdFrom?: string;
  createdTo?: string;
  serviceDateFrom?: string;
  serviceDateTo?: string;
  payerId?: string[];
  nonInsurancePayerId?: string[];
  patientId?: string[];
  type?: ClaimTypeCode[];
  service?: string[];
}

function toSearchParams(filters: Filters): ExportBillingClaimsInput {
  const params: ExportBillingClaimsInput = {};
  if (filters.searchText) params.searchText = filters.searchText;
  if (filters.arStage?.length) params.arStage = filters.arStage;
  if (filters.status?.length) params.status = filters.status;
  if (filters.tag?.length) params.tag = filters.tag;
  if (filters.createdFrom) params.createdFrom = filters.createdFrom;
  if (filters.createdTo) params.createdTo = filters.createdTo;
  if (filters.serviceDateFrom) params.serviceDateFrom = filters.serviceDateFrom;
  if (filters.serviceDateTo) params.serviceDateTo = filters.serviceDateTo;
  if (filters.payerId?.length) params.payerId = filters.payerId;
  if (filters.nonInsurancePayerId?.length) params.nonInsurancePayerId = filters.nonInsurancePayerId;
  if (filters.patientId?.length) params.patientId = filters.patientId;
  if (filters.type?.length) params.type = filters.type;
  if (filters.service?.length) params.service = filters.service;
  return params;
}

// Status options in play for the chosen AR stages: the union of their groups' statuses, or every
// status when no stage (or a stage without a group, such as "none") is chosen.
function statusOptionsForArStages(arStages: string[]): ClaimStatusOption[] {
  const groupKeys = arStages.map((stage) => CLAIM_STATUS_GROUPS.find((g) => g.arStageCode === stage)?.key);
  if (groupKeys.length === 0 || groupKeys.some((key) => !key)) {
    return ALL_CLAIM_STATUS_OPTIONS_2;
  }
  return groupKeys.reduce((acc, key) => {
    if (!key) return acc;
    acc.push(...ALL_CLAIM_STATUS_OPTIONS_BY_GROUP[key].filter((o) => !acc.some((ao) => ao.code === o.code)));
    return acc;
  }, [] as ClaimStatusOption[]);
}

const CLAIMS_LIST_FILTERS_STORAGE_KEY = 'billing.claimsListFilters';

// Only the minimum needed to restore the patient filter and re-render the Autocomplete's closed
// display — never persist the rest of BillingPatientOption (dob, address, gender, clinical IDs, etc.)
// to browser storage.
interface StoredPatientOption {
  id: string | undefined;
  name: string;
}

interface StoredClaimsListFilters {
  searchText: string;
  arStageFilter: string[];
  statusFilter: string[];
  tagFilter: string[];
  createdFrom: string;
  createdTo: string;
  serviceDateFrom: string;
  serviceDateTo: string;
  selectedPayers: BillingPayerOption[];
  selectedPatients: StoredPatientOption[];
  typeFilter: ClaimTypeCode[];
  selectedServices: BillingService[];
  paginationModel: GridPaginationModel;
}

const STORED_LIST_FILTER_KEYS: (keyof StoredClaimsListFilters)[] = [
  'arStageFilter',
  'statusFilter',
  'tagFilter',
  'selectedPayers',
  'selectedPatients',
  'typeFilter',
  'selectedServices',
];

function loadStoredClaimsListFilters(): StoredClaimsListFilters | null {
  try {
    const raw = sessionStorage.getItem(CLAIMS_LIST_FILTERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Record<keyof StoredClaimsListFilters, unknown>> | null;
    // Filters saved before they became lists (single values) have the wrong shape — ignore them.
    if (!parsed || STORED_LIST_FILTER_KEYS.some((key) => !Array.isArray(parsed[key]))) return null;
    return parsed as StoredClaimsListFilters;
  } catch {
    return null;
  }
}

function toBillingPatientOption(stored: StoredPatientOption): BillingPatientOption {
  return {
    id: stored.id,
    name: stored.name,
    firstName: '',
    lastName: '',
    dob: '',
    gender: '',
    address: '',
    clinicalId: '',
    clinicalFriendlyId: '',
  };
}

interface MultiSelectFilterProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (value: T[]) => void;
  minWidth: number;
  disabled?: boolean;
}

// An empty selection means "All". Styled like the searchable filters (Service, Payer, ...).
function MultiSelectFilter<T extends string>({
  label,
  options,
  value,
  onChange,
  minWidth,
  disabled,
}: MultiSelectFilterProps<T>): ReactElement {
  // A chosen value can be missing from the options (e.g. a restored tag before the tags load), so
  // fall back to showing the raw value rather than dropping it.
  const selected = value.map((v) => options.find((o) => o.value === v) ?? { value: v, label: v });
  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      limitTags={1}
      size="small"
      options={options}
      getOptionLabel={(o) => o.label}
      value={selected}
      onChange={(_, v) => onChange(v.map((o) => o.value))}
      renderInput={(params) => <TextField {...params} label={label} />}
      isOptionEqualToValue={(o, v) => o.value === v.value}
      disabled={disabled}
      sx={{ minWidth, maxWidth: 300 }}
    />
  );
}

const patientIds = (patients: BillingPatientOption[]): string[] =>
  patients.map((p) => p.id).filter((id): id is string => !!id);

// UI-only prototype rows so the "Invoice claims" flow can be demonstrated without backend data.
const demoNioClaim = (
  id: string,
  patientName: string,
  nonInsurancePayerName: string,
  serviceDate: string,
  service: string,
  billed: number
): BillingClaimItem => ({
  id,
  type: 'professional',
  status: '',
  statuses: {
    ...emptyClaimStatusValues(),
    arStage: AR_STAGE.nonInsurancePayer,
    nonInsuranceArStatus: 'ready-to-invoice',
  },
  rulesEngine: 'non-insurance-payer-pre-invoice',
  patientName,
  patientDob: '',
  payerName: '',
  payerId: '',
  nonInsurancePayerName,
  memberId: '',
  service,
  serviceDate,
  facility: 'Downtown Clinic',
  renderingProvider: 'Dr. Dana Reyes',
  billed,
  allowed: billed,
  insurancePaid: 0,
  patientResp: 0,
  patientPaid: 0,
  claimBalance: billed,
  adjudicated: true,
  responsibleParty: nonInsurancePayerName,
  tags: ['demo'],
});

const DEMO_NIO_CLAIMS: BillingClaimItem[] = [
  demoNioClaim('demo-nio-1', 'Jordan Pruitt (demo)', 'Acme Health Services', '2026-09-14', 'office-visit', 180),
  demoNioClaim('demo-nio-2', 'Maya Collins (demo)', 'Acme Health Services', '2026-09-18', 'sports-physical', 95),
  demoNioClaim('demo-nio-3', 'Leo Marsh (demo)', 'Acme Health Services', '2026-09-21', 'drug-screening', 140),
  demoNioClaim('demo-nio-4', 'Priya Natarajan (demo)', 'Lakeside School District', '2026-09-25', 'sports-physical', 95),
  // Document Requestor (law firm) — billed amounts match the per-claim/document/page pricing demo.
  demoNioClaim('demo-doc-1', 'Omar Reyes (demo)', 'Harrington & Lowe LLP', '2026-09-08', 'medical-records', 76),
  demoNioClaim('demo-doc-2', 'Lily Chang (demo)', 'Harrington & Lowe LLP', '2026-09-12', 'medical-records', 41),
  demoNioClaim('demo-doc-3', 'Marcus Webb (demo)', 'Harrington & Lowe LLP', '2026-09-19', 'medical-records', 58.5),
  // Document Requestor (life underwriter) — $15/claim + $5/document + $0.25/page.
  demoNioClaim('demo-doc-4', 'Nina Petrov (demo)', 'Meridian Life Underwriting', '2026-09-16', 'medical-records', 29.5),
  demoNioClaim('demo-doc-5', 'Caleb Stone (demo)', 'Meridian Life Underwriting', '2026-09-23', 'medical-records', 27.5),
];

const isDemoClaimId = (id: unknown): boolean => String(id).startsWith('demo-nio-');

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
  { field: 'nonInsurancePayerName', headerName: 'Non-insurance Organization', width: 200 },
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
  {
    ...currencyCol('claimBalance', 'Claim Balance', 120),
    renderCell: ({ value, row }) => (
      <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.5} sx={{ width: '100%' }}>
        {!(row as BillingClaimItem).adjudicated && <WarningIconWithTooltip tooltipText={PROVISIONAL_BALANCE_HINT} />}
        <span>{formatCurrency(value as number)}</span>
      </Stack>
    ),
  },
  { field: 'facility', headerName: 'Facility', width: 140 },
  { field: 'renderingProvider', headerName: 'Provider', width: 140 },
  { field: 'responsibleParty', headerName: 'Responsible Party', width: 140 },
];

export default function ClaimsList(): ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [storedFilters] = useState(() => loadStoredClaimsListFilters());

  const [claims, setClaims] = useState<BillingClaimItem[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incomplete, setIncomplete] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>(
    storedFilters?.paginationModel ?? { page: 0, pageSize: 25 }
  );
  const [serviceOptions, setServiceOptions] = useState<BillingService[]>([]);

  const [selected, setSelected] = useState<GridRowSelectionModel>([]);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [invoicingClaims, setInvoicingClaims] = useState(false);

  const { options: payerOptions, search: searchPayers } = usePayerSearch();
  const [nioOptions, setNioOptions] = useState<NonInsuranceOrganizationItem[]>([]);
  const [patientOptions, setPatientOptions] = useState<BillingPatientOption[]>([]);

  const [searchText, setSearchText] = useState(storedFilters?.searchText ?? '');
  const [arStageFilter, setArStageFilter] = useState<string[]>(storedFilters?.arStageFilter ?? []);
  const [statusFilter, setStatusFilter] = useState<string[]>(storedFilters?.statusFilter ?? []);
  const [tagFilter, setTagFilter] = useState<string[]>(storedFilters?.tagFilter ?? []);
  const [tagOptions, setTagOptions] = useState<{ id: string; name: string }[]>([]);
  const [createdFrom, setCreatedFrom] = useState(storedFilters?.createdFrom ?? '');
  const [createdTo, setCreatedTo] = useState(storedFilters?.createdTo ?? '');
  const [serviceDateFrom, setServiceDateFrom] = useState(storedFilters?.serviceDateFrom ?? '');
  const [serviceDateTo, setServiceDateTo] = useState(storedFilters?.serviceDateTo ?? '');
  const [selectedPayers, setSelectedPayers] = useState<BillingPayerOption[]>(storedFilters?.selectedPayers ?? []);
  const [selectedNios, setSelectedNios] = useState<NonInsuranceOrganizationItem[]>([]);
  const [selectedPatients, setSelectedPatients] = useState<BillingPatientOption[]>(
    (storedFilters?.selectedPatients ?? []).filter((p) => p.id).map(toBillingPatientOption)
  );
  const [typeFilter, setTypeFilter] = useState<ClaimTypeCode[]>(storedFilters?.typeFilter ?? []);
  const [selectedServices, setSelectedServices] = useState<BillingService[]>(storedFilters?.selectedServices ?? []);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serviceDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nioDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patientDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const statusOptions = useMemo(() => statusOptionsForArStages(arStageFilter), [arStageFilter]);

  useEffect(() => {
    return (): void => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (serviceDebounce.current) clearTimeout(serviceDebounce.current);
      if (patientDebounce.current) clearTimeout(patientDebounce.current);
    };
  }, []);

  const fetchClaims = useCallback(
    async (filters: Filters, pagination: GridPaginationModel): Promise<void> => {
      if (!oystehrZambda) return;
      setLoading(true);
      setError(null);
      setIncomplete(false);
      setSelected([]);
      try {
        const params: SearchBillingClaimsInput = {
          ...toSearchParams(filters),
          pageSize: pagination.pageSize,
          offset: pagination.page * pagination.pageSize,
        };

        const data = await searchBillingClaims(oystehrZambda, params);
        // Prototype: prepend demo NIO rows so the "Invoice claims" flow is demonstrable.
        setClaims([...DEMO_NIO_CLAIMS, ...(data.claims ?? [])]);
        setTotalRows(data.total ?? 0);
        setIncomplete(Boolean(data.incomplete));
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
  useEffect(() => searchServices(''), [searchServices]);

  useEffect(() => searchPayers(''), [searchPayers]);

  const searchNios = useCallback(
    (query: string): void => {
      if (!oystehrZambda) return;
      if (nioDebounce.current) clearTimeout(nioDebounce.current);
      nioDebounce.current = setTimeout(async () => {
        const res = await searchBillingNonInsuranceOrgs(oystehrZambda, query ? { name: query } : {});
        setNioOptions(res.organizations ?? []);
      }, 300);
    },
    [oystehrZambda]
  );
  useEffect(() => searchNios(''), [searchNios]);

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
  useEffect(() => searchPatients(''), [searchPatients]);

  const currentFilters = useCallback(
    (overrides?: Filters): Filters => ({
      searchText: overrides?.searchText ?? searchText,
      arStage: overrides?.arStage ?? arStageFilter,
      status: overrides?.status ?? statusFilter,
      tag: overrides?.tag ?? tagFilter,
      createdFrom: overrides?.createdFrom ?? createdFrom,
      createdTo: overrides?.createdTo ?? createdTo,
      serviceDateFrom: overrides?.serviceDateFrom ?? serviceDateFrom,
      serviceDateTo: overrides?.serviceDateTo ?? serviceDateTo,
      payerId: overrides?.payerId ?? selectedPayers.map((p) => p.payerId),
      nonInsurancePayerId: overrides?.nonInsurancePayerId ?? selectedNios.map((n) => n.id),
      patientId: overrides?.patientId ?? patientIds(selectedPatients),
      type: overrides?.type ?? typeFilter,
      service: overrides?.service ?? selectedServices.map((sv) => sv.name),
    }),
    [
      searchText,
      arStageFilter,
      statusFilter,
      tagFilter,
      createdFrom,
      createdTo,
      serviceDateFrom,
      serviceDateTo,
      selectedPayers,
      selectedNios,
      selectedPatients,
      typeFilter,
      selectedServices,
    ]
  );

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!oystehrZambda || initialLoadDone.current) return;
    initialLoadDone.current = true;
    void fetchClaims(currentFilters(), paginationModel);
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
  }, [oystehrZambda, fetchClaims, currentFilters, paginationModel]);

  useEffect(() => {
    const toStore: StoredClaimsListFilters = {
      searchText,
      arStageFilter,
      statusFilter,
      tagFilter,
      createdFrom,
      createdTo,
      serviceDateFrom,
      serviceDateTo,
      selectedPayers,
      selectedPatients: selectedPatients.filter((p) => p.id).map((p) => ({ id: p.id, name: p.name })),
      typeFilter,
      selectedServices,
      paginationModel,
    };

    const timeout = window.setTimeout(() => {
      try {
        sessionStorage.setItem(CLAIMS_LIST_FILTERS_STORAGE_KEY, JSON.stringify(toStore));
      } catch {
        // ignore storage errors (e.g. private browsing / quota exceeded)
      }
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [
    searchText,
    arStageFilter,
    statusFilter,
    tagFilter,
    createdFrom,
    createdTo,
    serviceDateFrom,
    serviceDateTo,
    selectedPayers,
    selectedPatients,
    typeFilter,
    selectedServices,
    paginationModel,
  ]);

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
    setArStageFilter([]);
    setStatusFilter([]);
    setTagFilter([]);
    setCreatedFrom('');
    setCreatedTo('');
    setServiceDateFrom('');
    setServiceDateTo('');
    setSelectedPayers([]);
    setSelectedNios([]);
    setSelectedPatients([]);
    setTypeFilter([]);
    setSelectedServices([]);
    const resetPage = { ...paginationModel, page: 0 };
    setPaginationModel(resetPage);
    void fetchClaims({}, resetPage);
  };

  const hasFilters =
    searchText ||
    arStageFilter.length ||
    statusFilter.length ||
    tagFilter.length ||
    createdFrom ||
    createdTo ||
    serviceDateFrom ||
    serviceDateTo ||
    selectedPayers.length ||
    selectedNios.length ||
    selectedPatients.length ||
    typeFilter.length ||
    selectedServices.length;

  const selectedClaims = useMemo(() => claims.filter((c) => selected.includes(c.id)), [claims, selected]);

  // "Invoice claims" is only actionable when every selected claim is Non-insurance Payer AR and
  // all are payable by the same non-insurance organization.
  const invoiceEligible =
    selectedClaims.length > 0 &&
    selectedClaims.every((c) => c.statuses?.arStage === AR_STAGE.nonInsurancePayer) &&
    !!selectedClaims[0].nonInsurancePayerName &&
    selectedClaims.every((c) => c.nonInsurancePayerName === selectedClaims[0].nonInsurancePayerName);

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

  const handleExport = useCallback(async (): Promise<void> => {
    if (!oystehrZambda) return;
    setExporting(true);
    try {
      const { taskId } = await exportBillingClaims(oystehrZambda, toSearchParams(currentFilters()));
      const result = await pollExportTask({
        checkStatus: () => getBillingClaimsExportStatus(oystehrZambda, { taskId }),
      });

      if (result.status !== 'completed' || !result.downloadUrl) {
        enqueueSnackbar(result.error ?? 'Failed to export claims', { variant: 'error' });
        return;
      }

      const download = await fetch(result.downloadUrl);
      if (!download.ok) throw new Error(`Failed to download the export: ${download.status}`);
      downloadTextFile(`claims-${DateTime.now().toISODate()}.csv`, await download.text());

      if (result.incomplete) {
        enqueueSnackbar(
          'Some claims may be missing from this export. Narrow the search, or use the filters to export the rest.',
          { variant: 'warning' }
        );
      }
    } catch (err) {
      enqueueSnackbar(
        getApiError({
          error: err,
          defaultError: 'Failed to export claims',
        }),
        { variant: 'error' }
      );
    } finally {
      setExporting(false);
    }
  }, [oystehrZambda, currentFilters]);

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
                invoiceEligible
                  ? ''
                  : 'Enabled when every selected claim is in Non-insurance Payer AR and payable by the same ' +
                    'non-insurance organization'
              }
            >
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!invoiceEligible}
                  onClick={() => setInvoicingClaims(true)}
                >
                  Invoice claims ({selected.length})
                </Button>
              </span>
            </Tooltip>
          )}
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
        placeholder="Search by patient name, provider name, patient ID, PCN, or claim ID..."
        helperText="Names match from the start. Patient ID, PCN, and claim ID must be entered in full."
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
        <MultiSelectFilter
          label="AR Stage"
          options={CLAIM_STATUS_FIELDS_BY_KEY.arStage.options.map((o) => ({ value: o.code, label: o.label }))}
          value={arStageFilter}
          minWidth={180}
          onChange={(value) => {
            // Drop chosen statuses the new stages no longer offer, so no hidden filter lingers.
            const nextStatusCodes = statusOptionsForArStages(value).map((o) => o.code);
            const nextStatus = statusFilter.filter((code) => nextStatusCodes.includes(code));
            setArStageFilter(value);
            setStatusFilter(nextStatus);
            applyFilters({ arStage: value, status: nextStatus });
          }}
        />

        <MultiSelectFilter
          label="Status"
          options={statusOptions.map((o) => ({ value: o.code, label: o.label }))}
          value={statusFilter}
          minWidth={180}
          onChange={(value) => {
            setStatusFilter(value);
            applyFilters({ status: value });
          }}
        />

        <MultiSelectFilter
          label="Claim Type"
          options={CLAIM_TYPE_OPTIONS}
          value={typeFilter}
          minWidth={160}
          onChange={(value) => {
            setTypeFilter(value);
            applyFilters({ type: value });
          }}
        />

        <Autocomplete
          multiple
          disableCloseOnSelect
          limitTags={1}
          size="small"
          options={serviceOptions}
          getOptionLabel={(o) => `${formatAntCaseString(o.name)}`}
          onInputChange={(_, value, reason) => {
            if (reason === 'input') searchServices(value);
          }}
          onOpen={() => searchServices('')}
          filterOptions={(x) => x}
          value={selectedServices}
          onChange={(_, v) => {
            setSelectedServices(v);
            applyFilters({ service: v.map((sv) => sv.name) });
          }}
          renderInput={(params) => <TextField {...params} label="Service" />}
          isOptionEqualToValue={(o, v) => o.name === v.name}
          sx={{ minWidth: 180, maxWidth: 300 }}
        />

        <MultiSelectFilter
          label="Tag"
          options={tagOptions.map((t) => ({ value: t.name, label: t.name }))}
          value={tagFilter}
          minWidth={140}
          disabled={tagOptions.length === 0}
          onChange={(value) => {
            setTagFilter(value);
            applyFilters({ tag: value });
          }}
        />

        <Autocomplete
          multiple
          disableCloseOnSelect
          limitTags={1}
          size="small"
          options={payerOptions}
          getOptionLabel={(o) => `${o.name} (${o.payerId})`}
          onInputChange={(_, value, reason) => {
            if (reason === 'input') searchPayers(value);
          }}
          onOpen={() => searchPayers('')}
          filterOptions={(x) => x}
          value={selectedPayers}
          onChange={(_, v) => {
            setSelectedPayers(v);
            applyFilters({ payerId: v.map((p) => p.payerId) });
          }}
          renderInput={(params) => <TextField {...params} label="Payer" />}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          sx={{ minWidth: 200, maxWidth: 320 }}
        />

        <Autocomplete
          multiple
          disableCloseOnSelect
          limitTags={1}
          size="small"
          options={nioOptions}
          getOptionLabel={(o) => o.name}
          onInputChange={(_, value, reason) => {
            if (reason === 'input') searchNios(value);
          }}
          onOpen={() => searchNios('')}
          filterOptions={(x) => x}
          value={selectedNios}
          onChange={(_, v) => {
            setSelectedNios(v);
            applyFilters({ nonInsurancePayerId: v.map((n) => n.id) });
          }}
          renderInput={(params) => <TextField {...params} label="Non-insurance Organization" />}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          sx={{ minWidth: 230, maxWidth: 340 }}
        />

        <Autocomplete
          multiple
          disableCloseOnSelect
          limitTags={1}
          size="small"
          options={patientOptions}
          getOptionLabel={(o) => o.name || `${o.firstName} ${o.lastName}`}
          onInputChange={(_, value, reason) => {
            if (reason === 'input') searchPatients(value);
          }}
          onOpen={() => searchPatients('')}
          filterOptions={(x) => x}
          value={selectedPatients}
          onChange={(_, v) => {
            setSelectedPatients(v);
            applyFilters({ patientId: patientIds(v) });
          }}
          renderInput={(params) => <TextField {...params} label="Patient" />}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          sx={{ minWidth: 200, maxWidth: 320 }}
        />

        <DateRangeInput
          label="Service Date"
          valueFrom={serviceDateFrom}
          valueTo={serviceDateTo}
          onChange={(from, to) => {
            setServiceDateFrom(from);
            setServiceDateTo(to);
            applyFilters({
              serviceDateFrom: from,
              serviceDateTo: to,
            });
          }}
        />

        <DateRangeInput
          label="Claim Creation Date"
          valueFrom={createdFrom}
          valueTo={createdTo}
          onChange={(from, to) => {
            setCreatedFrom(from);
            setCreatedTo(to);
            applyFilters({
              createdFrom: from,
              createdTo: to,
            });
          }}
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

      {incomplete && !error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Some claims may be missing from these results. Narrow the search, or use the filters to find a claim you
          expected to see.
        </Alert>
      )}

      {totalRows > EXPORT_CLAIMS_MATCH_LIMIT && !error && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This search matches {totalRows.toLocaleString()} claims, but an export includes at most{' '}
          {EXPORT_CLAIMS_MATCH_LIMIT.toLocaleString()} records. Narrow the search to export the rest.
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
        onRowClick={(params) => {
          // Demo rows have no backing claim to navigate to.
          if (!isDemoClaimId(params.id)) navigate(`/claims/${params.id}`);
        }}
        disableRowSelectionOnClick
        disableColumnMenu
        checkboxSelection
        isRowSelectable={(params) => !!(params.row as BillingClaimItem).rulesEngine}
        rowSelectionModel={selected}
        onRowSelectionModelChange={setSelected}
        slots={dataGridSlots({
          onExportCsv: () => void handleExport(),
          exporting,
        })}
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
        Run rules for {selected.length} claim(s)? Each claim runs its AR stage's rules engine — when every rule passes,
        Insurance Payer AR claims are submitted to the payer and pre-invoice claims are made ready to invoice; a Hold
        keeps a claim for review.
      </ConfirmDialog>

      <InvoiceClaimsDialog open={invoicingClaims} claims={selectedClaims} onClose={() => setInvoicingClaims(false)} />
    </Box>
  );
}
