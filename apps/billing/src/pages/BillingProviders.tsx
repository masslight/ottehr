import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, IconButton, Typography } from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel } from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { chooseJson } from 'utils';
import { useApiClients } from '../hooks/useAppClients';
import { otherColors } from '../themes/ottehr/colors';

interface ProviderRow {
  id: string;
  name: string;
  npi: string;
  taxId?: string;
  clia?: string;
  address?: string;
}

const columns: GridColDef[] = [
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
  { field: 'npi', headerName: 'NPI', width: 130 },
  { field: 'taxId', headerName: 'Tax ID / EIN', width: 140 },
  { field: 'clia', headerName: 'CLIA Number', width: 140 },
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

  const fetchProviders = useCallback(
    async (pagination: GridPaginationModel): Promise<void> => {
      if (!oystehrZambda) return;
      setLoading(true);
      setError(null);
      try {
        const response = await oystehrZambda.zambda.execute({
          id: 'search-billing-providers',
          providerType: 'billing',
          pageSize: pagination.pageSize,
          offset: pagination.page * pagination.pageSize,
        });
        const data = chooseJson(response);
        setProviders(data.providers ?? []);
        setTotalRows(data.total ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
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

  const handlePaginationChange = (model: GridPaginationModel): void => {
    setPaginationModel(model);
    void fetchProviders(model);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" color="primary.dark" fontWeight={600} sx={{ mb: 3 }}>
        Billing Providers
      </Typography>

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
        slots={{
          noRowsOverlay: () => (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Typography color="text.secondary">{loading ? '' : 'No billing providers found.'}</Typography>
            </Box>
          ),
          loadingOverlay: () => (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress size={32} />
            </Box>
          ),
        }}
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
          height: 'calc(100vh - 240px)',
        }}
      />
    </Box>
  );
}

export function BillingProviderDetail(): ReactElement {
  const { id } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [provider, setProvider] = useState<ProviderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!oystehrZambda || !id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await oystehrZambda.zambda.execute({
        id: 'search-billing-providers',
        providerType: 'billing',
        providerId: id,
      });
      const data = chooseJson(response);
      setProvider((data.providers ?? [])[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !provider) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error ?? 'Provider not found'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/billing-providers')}>
          Back to Billing Providers
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/billing-providers')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" color="primary.dark" fontWeight={600}>
          {provider.name}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Row label="Name" value={provider.name} />
        <Row label="NPI" value={provider.npi} />
        <Row label="Tax ID / EIN" value={provider.taxId ?? ''} />
        <Row label="CLIA Number" value={provider.clia ?? ''} />
        <Row label="Address" value={provider.address ?? ''} />
      </Box>
    </Box>
  );
}

function Row({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Box sx={{ display: 'flex', py: 0.75 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 140, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Box>
  );
}
