import { Add as AddIcon, ArrowBack as ArrowBackIcon, Search as SearchIcon } from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { BillingPayerOption } from 'utils/lib/types/data/billing/billing.types';
import { InsuranceOrganizationItem } from 'utils/lib/types/data/billing/insurance-org.types';
import { deleteBillingInsuranceOrg, searchBillingInsuranceOrgs, searchBillingPayers } from '../api/api';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { InsuranceOrgDetailSection } from '../components/insurance-org/InsuranceOrgDetailSection';
import { InsuranceOrgDialog } from '../components/insurance-org/InsuranceOrgDialog';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';

interface InsuranceOrgRow {
  rowId: string;
  id: string;
  source: 'rcm' | 'custom';
  name: string;
  payerId: string;
}

function payerToRow(payer: BillingPayerOption): InsuranceOrgRow {
  return {
    rowId: `rcm-${payer.id}`,
    id: payer.id,
    source: 'rcm',
    name: payer.name,
    payerId: payer.payerId,
  };
}

function customOrgToRow(item: InsuranceOrganizationItem): InsuranceOrgRow {
  return {
    rowId: `custom-${item.id}`,
    id: item.id,
    source: 'custom',
    name: item.name,
    // Custom orgs have no RCM payer id — their "OTR-" org id fills the same column.
    payerId: item.orgId,
  };
}

const columns: GridColDef<InsuranceOrgRow>[] = [
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 240 },
  { field: 'payerId', headerName: 'Payer Id', width: 160 },
];

export function InsuranceOrganizationsList(): ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [payers, setPayers] = useState<BillingPayerOption[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [customOrgs, setCustomOrgs] = useState<InsuranceOrganizationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchName, setSearchName] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const { debounce } = useDebounce();

  const fetchAll = useCallback(
    async (name?: string): Promise<void> => {
      if (!oystehrZambda) return;
      setLoading(true);
      setError(null);
      try {
        const [payersData, customData] = await Promise.all([
          searchBillingPayers(oystehrZambda, { ...(name ? { name } : {}), limit: 50 }),
          searchBillingInsuranceOrgs(oystehrZambda, { ...(name ? { name } : {}), pageSize: 100 }),
        ]);
        setPayers(payersData.payers ?? []);
        setNextCursor(payersData.nextCursor ?? null);
        setCustomOrgs(customData.organizations ?? []);
      } catch (err) {
        setError(getApiError({ error: err, defaultError: 'Failed to load insurance organizations' }));
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda]
  );

  const loadMore = async (): Promise<void> => {
    if (!oystehrZambda || !nextCursor) return;
    setLoadingMore(true);
    setError(null);
    try {
      const data = await searchBillingPayers(oystehrZambda, { cursor: nextCursor, limit: 50 });
      setPayers((prev) => [...prev, ...(data.payers ?? [])]);
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load more insurance organizations' }));
    } finally {
      setLoadingMore(false);
    }
  };

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!oystehrZambda || initialLoadDone.current) return;
    initialLoadDone.current = true;
    void fetchAll();
  }, [oystehrZambda, fetchAll]);

  const handleSearchChange = (value: string): void => {
    setSearchName(value);
    debounce(() => void fetchAll(value || undefined), 'search');
  };

  const rows: InsuranceOrgRow[] = [...customOrgs.map(customOrgToRow), ...payers.map(payerToRow)];

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
        <Typography variant="h4" color="primary.dark" fontWeight={600}>
          Insurance Organizations
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add Organization
        </Button>
      </Box>

      <TextField
        fullWidth
        size="small"
        placeholder="Search by name..."
        value={searchName}
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

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <DataGridPro
        rows={rows}
        columns={columns}
        getRowId={(row) => row.rowId}
        loading={loading}
        disableRowSelectionOnClick
        disableColumnMenu
        hideFooter
        onRowClick={(params) => {
          if (params.row.source === 'custom') navigate(`/insurance-organizations/${params.row.id}`);
        }}
        getRowClassName={(params) => (params.row.source === 'custom' ? 'clickable-row' : '')}
        sx={{
          ...dataGridSx,
          height: 'calc(100vh - 360px)',
          '& .clickable-row': { cursor: 'pointer' },
        }}
        slots={dataGridSlots()}
      />

      {!searchName && nextCursor && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button variant="outlined" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </Box>
      )}

      <InsuranceOrgDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => void fetchAll(searchName || undefined)}
      />
    </Box>
  );
}

export function InsuranceOrganizationDetail(): ReactElement {
  const { id } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [item, setItem] = useState<InsuranceOrganizationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!oystehrZambda || !id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchBillingInsuranceOrgs(oystehrZambda, { insuranceOrgId: id });
      setItem((data.organizations ?? [])[0] ?? null);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load insurance organization' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleDelete = async (): Promise<void> => {
    if (!oystehrZambda || !item) return;
    if (!window.confirm(`Delete insurance organization "${item.name}"?`)) return;
    try {
      await deleteBillingInsuranceOrg(oystehrZambda, { insuranceOrgId: item.id });
      navigate('/insurance-organizations');
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to delete insurance organization' }));
    }
  };

  if (loading && !item) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '50vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error || !item) {
    return (
      <Box sx={{ p: 0 }}>
        <Alert severity="error">{error ?? 'Insurance organization not found'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/insurance-organizations')}>
          Back to Insurance Organizations
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/insurance-organizations')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" color="primary.dark" fontWeight={600}>
          {item.name}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button color="error" onClick={() => void handleDelete()}>
          Delete
        </Button>
      </Box>
      <InsuranceOrgDetailSection item={item} onSaved={fetchDetail} />
    </Box>
  );
}
