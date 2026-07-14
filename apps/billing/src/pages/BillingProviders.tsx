import { Add as AddIcon, ArrowBack as ArrowBackIcon, Search as SearchIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel } from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BillingProviderOption, getApiError } from 'utils';
import { deleteBillingProvider, searchBillingProviders } from '../api/api';
import { AddProviderDialog } from '../components/AddProviderDialog';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { ProviderDetailSection } from '../components/ProviderDetailSection';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';

interface ProviderRow {
  id: string;
  name: string;
  npi: string;
  taxId?: string;
  address?: string;
  isWorkingCopy: boolean;
}

const columns: GridColDef[] = [
  {
    field: 'name',
    headerName: 'Name',
    flex: 1,
    minWidth: 200,
    renderCell: (params) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
        {params.row.name}
        {params.row.isWorkingCopy && (
          <Chip label="Working copy" variant="outlined" size="small" sx={{ borderRadius: '4px', fontSize: 12 }} />
        )}
      </Box>
    ),
  },
  { field: 'npi', headerName: 'NPI', width: 130 },
  { field: 'taxId', headerName: 'Tax ID / EIN', width: 140 },
  { field: 'address', headerName: 'Address', flex: 1, minWidth: 200 },
];

export function BillingProvidersList(): ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [searchName, setSearchName] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const { debounce } = useDebounce();

  const fetchProviders = useCallback(
    async (pagination: GridPaginationModel, name?: string): Promise<void> => {
      if (!oystehrZambda) return;
      setLoading(true);
      setError(null);
      try {
        const data = await searchBillingProviders(oystehrZambda, {
          providerType: 'billing',
          pageSize: pagination.pageSize,
          offset: pagination.page * pagination.pageSize,
          ...(name ? { name } : {}),
        });
        setProviders(data.providers ?? []);
        setTotalRows(data.total ?? 0);
      } catch (err) {
        setError(getApiError({ error: err, defaultError: 'Failed to load providers' }));
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda]
  );

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!oystehrZambda || initialLoadDone.current) return;
    initialLoadDone.current = true;
    void fetchProviders(paginationModel);
  }, [oystehrZambda, fetchProviders, paginationModel]);

  const handleSearchChange = (value: string): void => {
    setSearchName(value);
    debounce(() => {
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
      void fetchProviders({ ...paginationModel, page: 0 }, value || undefined);
    }, 'search');
  };

  const handlePaginationChange = (model: GridPaginationModel): void => {
    setPaginationModel(model);
    void fetchProviders(model, searchName || undefined);
  };

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" color="primary.dark" fontWeight={600}>
          Billing Providers
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add Provider
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
        rows={providers}
        columns={columns}
        loading={loading}
        rowCount={totalRows}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationChange}
        pageSizeOptions={[25, 50, 100]}
        onRowClick={(params) => navigate(`/billing-providers/${params.id}`)}
        disableRowSelectionOnClick
        disableColumnMenu
        slots={dataGridSlots}
        pagination={true}
        sx={{ ...dataGridSx, height: 'calc(100vh - 310px)' }}
      />

      <AddProviderDialog
        open={addOpen}
        defaultRole="billing"
        onClose={() => setAddOpen(false)}
        onCreated={() => void fetchProviders(paginationModel, searchName || undefined)}
      />
    </Box>
  );
}

export function BillingProviderDetail(): ReactElement {
  const { id } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [provider, setProvider] = useState<BillingProviderOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!oystehrZambda || !id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchBillingProviders(oystehrZambda, {
        providerType: 'billing',
        providerId: id,
      });
      setProvider((data.providers ?? [])[0] ?? null);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load provider' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, id]);

  const handleDelete = async (): Promise<void> => {
    if (!oystehrZambda || !provider) return;
    if (!window.confirm(`Delete provider "${provider.name}"? This cannot be undone.`)) return;
    try {
      await deleteBillingProvider(oystehrZambda, { providerId: provider.id, kind: provider.kind });
      navigate('/billing-providers');
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to delete provider' }));
    }
  };

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  if (loading && !provider) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !provider) {
    return (
      <Box sx={{ p: 0 }}>
        <Alert severity="error">{error ?? 'Provider not found'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/billing-providers')}>
          Back to Billing Providers
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/billing-providers')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" color="primary.dark" fontWeight={600}>
          {provider.name}
        </Typography>
        {provider.isWorkingCopy && (
          <Chip label="Working copy" variant="outlined" size="small" sx={{ borderRadius: '4px', fontSize: 12 }} />
        )}
        <Box sx={{ flexGrow: 1 }} />
        {!provider.isWorkingCopy && (
          <Button color="error" onClick={() => void handleDelete()}>
            Delete
          </Button>
        )}
      </Box>
      <ProviderDetailSection provider={provider} onSaved={fetchDetail} />
    </Box>
  );
}
