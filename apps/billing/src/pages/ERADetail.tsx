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
import { useNavigate, useParams } from 'react-router-dom';
import { EraDetailResponse, getApiError } from 'utils';
import { getBillingEraDetail } from '../api/api';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { MatchClaimDialog } from '../components/MatchClaimDialog';
import { Row } from '../components/Row';
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
  const [claimResponseToMatch, setClaimResponseToMatch] = useState<string | null>(null);

  const claimColumns: GridColDef[] = [
    {
      field: 'claimId',
      headerName: 'Claim ID',
      width: 320,
      renderCell: ({ value, row }) => {
        if (!row.matched) {
          return (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setClaimResponseToMatch(row.claimResponseIds[0]);
              }}
            >
              Match
            </Button>
          );
        } else {
          return <>{value}</>;
        }
      },
    },
    { field: 'patientName', headerName: 'Patient', flex: 1, minWidth: 150 },
    { field: 'dos', headerName: 'Date of Service', width: 130 },
    currencyCol('billed', 'Billed', 100),
    currencyCol('allowed', 'Allowed', 100),
    currencyCol('paid', 'Ins Paid', 110),
    currencyCol('posted', 'Posted', 100),
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      renderCell: ({ value, row }) =>
        value ? (
          <Chip
            label={!row.matched ? 'unmatched' : String(value)}
            color={value === 'complete' && row.matched ? 'success' : 'warning'}
            variant="outlined"
            size="small"
            sx={{ borderRadius: '4px', fontSize: 12 }}
          />
        ) : (
          '—'
        ),
    },
  ];

  const fetchDetail = useCallback(async () => {
    if (!oystehrZambda || !id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBillingEraDetail(oystehrZambda, { eraId: id });
      setEra(data);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load ERA' }));
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
      <Box sx={{ p: 0 }}>
        <Alert severity="error">{error ?? 'ERA not found'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/eras')}>
          Back to ERAs
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 0 }}>
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
          </TabList>

          <TabPanel value="1" sx={{ px: 0, pt: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 3 }}>
              {era.paymentMethod && <Row label="Payment method" value={era.paymentMethod} hideBorder />}
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
                  <MenuItem value="complete">Complete</MenuItem>
                  <MenuItem value="queued">Queued</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
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
              onRowClick={(params) => (params.row.matched ? navigate(`/claims/${params.id}`) : {})}
              disableRowSelectionOnClick
              disableColumnMenu
              autoHeight
              pageSizeOptions={[25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              slots={dataGridSlots}
              sx={{ ...dataGridSx }}
            />
          </TabPanel>
        </TabContext>
      </Box>
      {claimResponseToMatch && (
        <MatchClaimDialog
          claimResponseId={claimResponseToMatch}
          onMatched={() => fetchDetail()}
          onClose={() => setClaimResponseToMatch(null)}
        />
      )}
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
