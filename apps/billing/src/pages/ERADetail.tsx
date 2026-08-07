import {
  ArrowBack as ArrowBackIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  UnfoldLess as UnfoldLessIcon,
  UnfoldMore as UnfoldMoreIcon,
} from '@mui/icons-material';
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
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Popover,
  Select,
  Stack,
  Tab,
  TextField,
  Typography,
} from '@mui/material';
import {
  DataGridPro,
  GRID_DETAIL_PANEL_TOGGLE_FIELD,
  GridColDef,
  GridRowId,
  GridRowParams,
} from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  carcDescription,
  EraClaimListItem,
  EraDetailResponse,
  formatCurrency,
  getApiError,
  X12_ADJUSTMENT_GROUP_LABELS,
  X12AdjustmentGroupCode,
} from 'utils';
import { getBillingEraDetail, unmatchClaimResponse } from '../api/api';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EraClaimDetailPanel } from '../components/EraClaimDetailPanel';
import { MatchClaimDialog } from '../components/MatchClaimDialog';
import { ReadOnlySection } from '../components/ReadOnlySection';
import { Row } from '../components/Row';
import { useApiClients } from '../hooks/useAppClients';
import { otherColors } from '../themes/ottehr/colors';
import { formatDate, formatTaxId } from '../utils/format';

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
  const [claimResponsesToUnmatch, setClaimResponsesToUnmatch] = useState<string[] | null>(null);
  const [unmatching, setUnmatching] = useState(false);
  const [moreActionsPopoverData, setMoreActionsPopoverData] = useState<{
    element: HTMLButtonElement;
    claimResponseIds: string[];
  } | null>(null);
  const [expandedRowIds, setExpandedRowIds] = useState<GridRowId[]>([]);

  const getDetailPanelContent = useCallback(
    ({ row }: GridRowParams) => <EraClaimDetailPanel claim={row as EraClaimListItem} />,
    []
  );
  const getDetailPanelHeight = useCallback(() => 'auto' as const, []);

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
    currencyCol('patientResp', 'Patient Resp', 110),
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      renderCell: ({ value, row }) =>
        value ? (
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Chip
              label={!row.matched ? 'unmatched' : String(value)}
              color={value === 'complete' && row.matched ? 'success' : 'warning'}
              variant="outlined"
              size="small"
              sx={{ borderRadius: '4px', fontSize: 12 }}
            />
            {row.matched && (
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  setMoreActionsPopoverData({ element: e.currentTarget, claimResponseIds: row.claimResponseIds });
                }}
              >
                <MoreVertIcon fontSize="medium" />
              </IconButton>
            )}
          </Stack>
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
            <HeaderField label="Check date" value={formatDate(era.checkDate)} />
            <HeaderField label="Check amount" value={formatCurrency(era.checkAmount)} bold />
            <HeaderField label="Created" value={formatDate(era.createdDate)} />
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

            {era.payee && (
              <ReadOnlySection title="Payee">
                <Row label="Name" value={era.payee.name} />
                <Row label="NPI" value={era.payee.npi} />
                <Row label="Tax ID" value={era.payee.taxId ? formatTaxId(era.payee.taxId) : ''} hideBorder />
              </ReadOnlySection>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" color="primary.dark" fontWeight={600}>
                Claims ({era.totalClaims})
              </Typography>
              <Button
                variant="text"
                size="small"
                startIcon={expandedRowIds.length > 0 ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
                onClick={() =>
                  setExpandedRowIds(expandedRowIds.length > 0 ? [] : filteredClaims.map((claim) => claim.claimId))
                }
              >
                {expandedRowIds.length > 0 ? 'Collapse all' : 'Expand all'}
              </Button>
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
              onCellClick={(params) => {
                if (params.field === GRID_DETAIL_PANEL_TOGGLE_FIELD) return;
                if (params.row.matched) navigate(`/claims/${params.id}`);
              }}
              getDetailPanelContent={getDetailPanelContent}
              getDetailPanelHeight={getDetailPanelHeight}
              detailPanelExpandedRowIds={expandedRowIds}
              onDetailPanelExpandedRowIdsChange={(ids) => setExpandedRowIds(ids)}
              disableRowSelectionOnClick
              disableColumnMenu
              autoHeight
              pageSizeOptions={[25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              slots={dataGridSlots()}
              sx={{ ...dataGridSx }}
            />

            <CarcGlossary claims={era.claims} />
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
      {claimResponsesToUnmatch && (
        <ConfirmDialog
          open={true}
          title="Unmatch"
          confirmLabel="Unmatch"
          loading={unmatching}
          onConfirm={async () => {
            if (!oystehrZambda) return;
            setUnmatching(true);
            try {
              for (const claimResponseId of claimResponsesToUnmatch) {
                await unmatchClaimResponse(oystehrZambda, {
                  claimResponseId,
                });
              }
            } finally {
              setUnmatching(false);
              setClaimResponsesToUnmatch(null);
              await fetchDetail();
            }
          }}
          onCancel={() => setClaimResponsesToUnmatch(null)}
        >
          Do you really want to unmatch?
        </ConfirmDialog>
      )}
      {moreActionsPopoverData ? (
        <Popover
          open={true}
          anchorEl={moreActionsPopoverData.element}
          onClose={() => setMoreActionsPopoverData(null)}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          <List>
            <ListItem disablePadding>
              <ListItemButton
                onClick={async () => {
                  setMoreActionsPopoverData(null);
                  setClaimResponsesToUnmatch(moreActionsPopoverData.claimResponseIds);
                }}
              >
                <ListItemText primary="Unmatch" />
              </ListItemButton>
            </ListItem>
          </List>
        </Popover>
      ) : null}
    </Box>
  );
}

// Every distinct adjustment code used on this ERA with its human-readable explanation — the
// paper-EOB style glossary of why the payer adjudicated the way it did.
function CarcGlossary({ claims }: { claims: EraClaimListItem[] }): ReactElement | null {
  const { reasonCodes, groupCodes } = useMemo(() => {
    const reasons = new Set<string>();
    const groups = new Set<X12AdjustmentGroupCode>();
    for (const claim of claims) {
      for (const remit of claim.remits) {
        const adjustments = [
          ...remit.patientRespAdjustments,
          ...remit.serviceLines.flatMap((line) => line.adjustments),
        ];
        for (const adjustment of adjustments) {
          if (adjustment.reasonCode) reasons.add(adjustment.reasonCode);
          groups.add(adjustment.groupCode);
        }
      }
    }
    const sorted = [...reasons].sort((a, b) => {
      const numA = Number.parseInt(a, 10);
      const numB = Number.parseInt(b, 10);
      if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB;
      if (!Number.isNaN(numA)) return -1;
      if (!Number.isNaN(numB)) return 1;
      return a.localeCompare(b);
    });
    return { reasonCodes: sorted, groupCodes: [...groups].sort() };
  }, [claims]);

  if (reasonCodes.length === 0 && groupCodes.length === 0) return null;

  return (
    <Box sx={{ mt: 3 }}>
      <ReadOnlySection title="Adjustment reason codes (CARC)">
        {groupCodes.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {groupCodes.map((code) => `${code} = ${X12_ADJUSTMENT_GROUP_LABELS[code]}`).join(' · ')}
          </Typography>
        )}
        {reasonCodes.map((code) => (
          <Box
            key={code}
            sx={{
              display: 'flex',
              gap: 2,
              py: 0.75,
              borderBottom: `1px solid ${otherColors.lightDivider}`,
              '&:last-child': { borderBottom: 'none' },
            }}
          >
            <Typography variant="body2" fontWeight={600} sx={{ minWidth: 48 }}>
              {code}
            </Typography>
            <Typography variant="body2">{carcDescription(code) ?? 'No description available'}</Typography>
          </Box>
        ))}
      </ReadOnlySection>
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
