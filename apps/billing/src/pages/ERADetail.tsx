import { ArrowBack as ArrowBackIcon, Search as SearchIcon } from '@mui/icons-material';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  TextField,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { chooseJson, EraDetailResponse } from 'utils';
import { useApiClients } from '../hooks/useAppClients';
import { otherColors } from '../themes/ottehr/colors';
import { formatCurrency } from '../utils/format';

const currencyCol = (field: string, headerName: string, width: number): GridColDef => ({
  field,
  headerName,
  width,
  align: 'right',
  headerAlign: 'right',
  valueFormatter: (params: { value: number }) => formatCurrency(params.value),
});

const claimColumns: GridColDef[] = [
  { field: 'claimId', headerName: 'Claim', width: 160 },
  { field: 'patientName', headerName: 'Patient', flex: 1, minWidth: 160 },
  { field: 'dos', headerName: 'Date of Service', width: 130 },
  currencyCol('billed', 'Billed', 100),
  currencyCol('allowed', 'Allowed', 100),
  currencyCol('paid', 'Ins Paid', 110),
  currencyCol('posted', 'Posted', 100),
  { field: 'source', headerName: 'Source', width: 100 },
  {
    field: 'status',
    headerName: 'Status',
    width: 140,
    renderCell: ({ value }) => (
      <Chip
        label={String(value ?? '')}
        color={value === 'Finalized Paid' ? 'success' : 'warning'}
        variant="outlined"
        size="small"
        sx={{ borderRadius: '4px', fontSize: 12 }}
      />
    ),
  },
  {
    field: 'actions',
    headerName: 'Actions',
    width: 120,
    sortable: false,
    renderCell: ({ row }) =>
      row.claimId ? (
        <Link to={`/claims/${row.claimId}`} style={{ color: '#2196F3', fontSize: 13 }}>
          View claim
        </Link>
      ) : null,
  },
];

export default function ERADetail(): ReactElement {
  const { id } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [era, setEra] = useState<EraDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('1');
  const [claimSearch, setClaimSearch] = useState('');
  const [claimStatusFilter, setClaimStatusFilter] = useState('');

  const fetchDetail = useCallback(async () => {
    if (!oystehrZambda || !id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await oystehrZambda.zambda.execute({ id: 'get-billing-era-detail', eraId: id });
      setEra(chooseJson(response));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const filteredClaims = useMemo(() => {
    if (!era) return [];
    let claims = era.claims;
    if (claimSearch) {
      const q = claimSearch.toLowerCase();
      claims = claims.filter((c) => c.patientName.toLowerCase().includes(q) || c.claimId.toLowerCase().includes(q));
    }
    if (claimStatusFilter) {
      claims = claims.filter((c) => c.status === claimStatusFilter);
    }
    return claims;
  }, [era, claimSearch, claimStatusFilter]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !era) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error ?? 'ERA not found'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/eras')}>
          Back to ERAs
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate('/eras')} size="small" sx={{ mt: 0.5 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', gap: 4, alignItems: 'baseline' }}>
            <HeaderField label="Check number" value={era.checkNumber} />
            <HeaderField label="Check date" value={era.checkDate} />
            <HeaderField label="Check amount" value={formatCurrency(era.checkAmount)} bold />
            <HeaderField label="Payer" value={era.payerName} />
          </Box>
        </Box>
        <Chip
          label={era.status}
          color={era.status === 'complete' ? 'success' : 'warning'}
          variant="outlined"
          sx={{ borderRadius: '4px' }}
        />
      </Box>

      <Box sx={{ ml: 5 }}>
        <TabContext value={tab}>
          <TabList
            onChange={(_, v) => setTab(v)}
            sx={{
              borderBottom: `1px solid ${otherColors.lightDivider}`,
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 500, fontSize: 14 },
            }}
          >
            <Tab label="Details & Claims" value="1" />
            <Tab label="Sources" value="2" />
          </TabList>

          <TabPanel value="1" sx={{ px: 0, pt: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 3 }}>
              <DetailRow label="Source" value={era.source} />
              <DetailRow label="Payee Identifier" value={era.payeeNpi ? `NPI: ${era.payeeNpi}` : ''} />
              <DetailRow label="Payment method" value={era.paymentMethod} />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" color="primary.dark" fontWeight={600}>
                Claims ({era.totalClaims})
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder="Search by patient name or claim ID"
                value={claimSearch}
                onChange={(e) => setClaimSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 280 }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Claim Status</InputLabel>
                <Select
                  value={claimStatusFilter}
                  label="Claim Status"
                  onChange={(e) => setClaimStatusFilter(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Finalized Paid">Finalized Paid</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                </Select>
              </FormControl>
              {(claimSearch || claimStatusFilter) && (
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    setClaimSearch('');
                    setClaimStatusFilter('');
                  }}
                >
                  Clear filters
                </Button>
              )}
            </Box>

            <DataGridPro
              rows={filteredClaims}
              columns={claimColumns}
              getRowId={(row) => row.claimId}
              disableRowSelectionOnClick
              disableColumnMenu
              autoHeight
              pageSizeOptions={[25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
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
              }}
            />
          </TabPanel>

          <TabPanel value="2" sx={{ px: 0, pt: 2 }}>
            <Typography color="text.secondary">No additional sources.</Typography>
          </TabPanel>
        </TabContext>
      </Box>
    </Box>
  );
}

function HeaderField({ label, value, bold }: { label: string; value: string; bold?: boolean }): ReactElement {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={bold ? 700 : 600}>
        {value || '—'}
      </Typography>
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Box sx={{ display: 'flex', py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 160, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Box>
  );
}
