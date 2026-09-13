import { Close as CloseIcon, Search as SearchIcon } from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel, GridRowSelectionModel } from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { SearchBillingClaimsInput } from 'utils/lib/types/data/billing/billing.schemas';
import { BillingClaimItem, BillingPatientOption, BillingPayerOption } from 'utils/lib/types/data/billing/billing.types';
import {
  ALL_CLAIM_STATUS_OPTIONS_2,
  CLAIM_STATUS_FIELDS,
  formatClaimStatusValue,
} from 'utils/lib/types/data/billing/claim-status';
import { formatCurrency } from 'utils/lib/utils/convert';
import { searchBillingClaims, searchBillingPatients, searchBillingPayers } from '../api/api';
import { claimStatusValueColor } from '../constants/claimStatus';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';
import { dataGridSlots, dataGridSx } from './BillingDataGrid';
import { DateRangeInput } from './DateInput';

interface Props {
  // claims already on the remit, excluded from selection
  excludeClaimIds: string[];
  onAdd: (claims: BillingClaimItem[]) => void;
  onClose: () => void;
}

const currencyCol = (field: string, headerName: string, width: number): GridColDef => ({
  field,
  headerName,
  width,
  align: 'right',
  headerAlign: 'right',
  valueFormatter: (params: { value: number }) => formatCurrency(params.value),
});

// One compact chip per set status field so a row's standing is scannable at a glance.
const statusChips = (row: BillingClaimItem): ReactElement => (
  <Box sx={{ display: 'flex', gap: 0.5, overflow: 'hidden' }}>
    {CLAIM_STATUS_FIELDS.filter((field) => row.statuses?.[field.key]).map((field) => (
      <Chip
        key={field.key}
        label={formatClaimStatusValue(field, row.statuses[field.key])}
        color={claimStatusValueColor(row.statuses[field.key])}
        variant="outlined"
        size="small"
        sx={{ borderRadius: '4px', fontSize: 11 }}
      />
    ))}
  </Box>
);

const columns: GridColDef[] = [
  { field: 'patientName', headerName: 'Patient', flex: 1, minWidth: 150 },
  { field: 'patientDob', headerName: 'DOB', width: 100 },
  { field: 'serviceDate', headerName: 'Service Date', width: 110 },
  { field: 'payerName', headerName: 'Payer', flex: 1, minWidth: 150 },
  { field: 'memberId', headerName: 'Member ID', width: 130 },
  {
    field: 'statuses',
    headerName: 'Status',
    flex: 1,
    minWidth: 200,
    sortable: false,
    renderCell: ({ row }) => statusChips(row as BillingClaimItem),
  },
  currencyCol('billed', 'Billed', 100),
  currencyCol('claimBalance', 'Balance', 100),
];

export function AddClaimsDialog({ excludeClaimIds, onAdd, onClose }: Props): ReactElement {
  const { oystehrZambda } = useApiClients();
  const { debounce } = useDebounce();

  const [claims, setClaims] = useState<BillingClaimItem[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [selected, setSelected] = useState<GridRowSelectionModel>([]);

  const [searchText, setSearchText] = useState('');
  const [selectedPayer, setSelectedPayer] = useState<BillingPayerOption | null>(null);
  const [payerOptions, setPayerOptions] = useState<BillingPayerOption[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<BillingPatientOption | null>(null);
  const [patientOptions, setPatientOptions] = useState<BillingPatientOption[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [dosFrom, setDosFrom] = useState('');
  const [dosTo, setDosTo] = useState('');

  // ref so debounced fetches always see the latest filters without re-creating callbacks
  const filtersRef = useRef<SearchBillingClaimsInput>({});
  filtersRef.current = {
    ...(searchText ? { searchText } : {}),
    ...(selectedPayer ? { payerId: selectedPayer.payerId } : {}),
    ...(selectedPatient?.id ? { patientId: selectedPatient.id } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(dosFrom ? { serviceDateFrom: dosFrom } : {}),
    ...(dosTo ? { serviceDateTo: dosTo } : {}),
  };

  const fetchClaims = useCallback(
    async (pagination: GridPaginationModel): Promise<void> => {
      if (!oystehrZambda) return;
      setLoading(true);
      setError(null);
      try {
        const data = await searchBillingClaims(oystehrZambda, {
          ...filtersRef.current,
          pageSize: pagination.pageSize,
          offset: pagination.page * pagination.pageSize,
        });
        setClaims((data.claims ?? []).filter((claim) => !excludeClaimIds.includes(claim.id)));
        setTotalRows(data.total ?? 0);
      } catch (err) {
        setError(getApiError({ error: err, defaultError: 'Failed to load claims' }));
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda, excludeClaimIds]
  );

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!oystehrZambda || initialLoadDone.current) return;
    initialLoadDone.current = true;
    void fetchClaims(paginationModel);
  }, [oystehrZambda, fetchClaims, paginationModel]);

  const applyFilters = useCallback((): void => {
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
    void fetchClaims({ ...paginationModel, page: 0 });
  }, [fetchClaims, paginationModel]);

  const searchPayers = (query: string): void => {
    if (!oystehrZambda) return;
    debounce(async () => {
      try {
        const res = await searchBillingPayers(oystehrZambda, query ? { name: query } : {});
        setPayerOptions(res.payers ?? []);
      } catch {
        setPayerOptions([]);
      }
    }, 'add-claims-payer');
  };

  const searchPatients = (query: string): void => {
    if (!oystehrZambda || !query) return;
    debounce(async () => {
      try {
        const res = await searchBillingPatients(oystehrZambda, { name: query });
        setPatientOptions(res.patients ?? []);
      } catch {
        setPatientOptions([]);
      }
    }, 'add-claims-patient');
  };

  const handleAdd = (): void => {
    onAdd(claims.filter((claim) => selected.includes(claim.id)));
  };

  return (
    <Dialog open onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 1100, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Add Claims to Remit</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 0 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by patient name or claim ID..."
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            debounce(applyFilters, 'add-claims-search');
          }}
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
              applyFilters();
            }}
            renderInput={(params) => <TextField {...params} label="Payer" />}
            isOptionEqualToValue={(o, v) => o.payerId === v.payerId}
            sx={{ minWidth: 200 }}
          />
          <Autocomplete
            size="small"
            options={patientOptions}
            getOptionLabel={(o) => o.name}
            onInputChange={(_, value, reason) => {
              if (reason === 'input') searchPatients(value);
            }}
            filterOptions={(x) => x}
            value={selectedPatient}
            onChange={(_, v) => {
              setSelectedPatient(v);
              applyFilters();
            }}
            renderInput={(params) => <TextField {...params} label="Patient" />}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => {
                setStatusFilter(e.target.value);
                applyFilters();
              }}
            >
              <MenuItem value="">All</MenuItem>
              {ALL_CLAIM_STATUS_OPTIONS_2.map((option) => (
                <MenuItem key={option.code} value={option.code}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <DateRangeInput
            label="Service Date"
            valueFrom={dosFrom}
            valueTo={dosTo}
            onChange={(from, to) => {
              setDosFrom(from);
              setDosTo(to);
              applyFilters();
            }}
          />
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
          onPaginationModelChange={(model) => {
            setPaginationModel(model);
            void fetchClaims(model);
          }}
          checkboxSelection
          keepNonExistentRowsSelected
          rowSelectionModel={selected}
          onRowSelectionModelChange={setSelected}
          disableRowSelectionOnClick={false}
          disableColumnMenu
          pageSizeOptions={[25, 50]}
          slots={dataGridSlots()}
          pagination
          sx={{ ...dataGridSx, height: 420 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleAdd} disabled={selected.length === 0}>
          Add {selected.length > 0 ? `${selected.length} ` : ''}Claim{selected.length === 1 ? '' : 's'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
