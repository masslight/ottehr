import { Add as AddIcon, ArrowBack as ArrowBackIcon, Search as SearchIcon } from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel } from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import {
  NIO_COVERAGE_CATEGORY_LABELS,
  NonInsuranceOrganizationItem,
} from 'utils/lib/types/data/billing/non-insurance-org.types';
import { deleteBillingNonInsuranceOrg, searchBillingNonInsuranceOrgs } from '../api/api';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { NonInsuranceOrgDetailSection } from '../components/nio/NonInsuranceOrgDetailSection';
import { NonInsuranceOrgDialog } from '../components/nio/NonInsuranceOrgDialog';
import { formatNioAddress } from '../constants/nonInsuranceOrg';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';

interface NioRow extends NonInsuranceOrganizationItem {
  employerDisplay: string;
  coversDisplay: string;
  addressDisplay: string;
}

function toRow(item: NonInsuranceOrganizationItem): NioRow {
  return {
    ...item,
    employerDisplay: item.employer ? 'Yes' : '—',
    coversDisplay: item.covers.map((coverage) => NIO_COVERAGE_CATEGORY_LABELS[coverage.category]).join(', '),
    addressDisplay: formatNioAddress(item.address),
  };
}

const columns: GridColDef[] = [
  {
    field: 'name',
    headerName: 'Name',
    flex: 1,
    minWidth: 220,
  },
  {
    field: 'employerDisplay',
    headerName: 'Employer',
    width: 110,
  },
  {
    field: 'coversDisplay',
    headerName: 'Covers',
    flex: 1,
    minWidth: 240,
  },
  {
    field: 'addressDisplay',
    headerName: 'Address',
    flex: 1,
    minWidth: 240,
  },
];

export function NonInsuranceOrganizationsList(): ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [rows, setRows] = useState<NioRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [searchName, setSearchName] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const { debounce } = useDebounce();

  const fetchOrganizations = useCallback(
    async (pagination: GridPaginationModel, name?: string): Promise<void> => {
      if (!oystehrZambda) return;
      setLoading(true);
      setError(null);
      try {
        const data = await searchBillingNonInsuranceOrgs(oystehrZambda, {
          pageSize: pagination.pageSize,
          offset: pagination.page * pagination.pageSize,
          ...(name ? { name } : {}),
        });
        setRows((data.organizations ?? []).map(toRow));
        setTotalRows(data.total ?? 0);
      } catch (err) {
        setError(getApiError({ error: err, defaultError: 'Failed to load non-insurance organizations' }));
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
    void fetchOrganizations(paginationModel);
  }, [oystehrZambda, fetchOrganizations, paginationModel]);

  const handleSearchChange = (value: string): void => {
    setSearchName(value);
    debounce(() => {
      setPaginationModel((prev) => {
        const next = {
          ...prev,
          page: 0,
        };
        void fetchOrganizations(next, value || undefined);
        return next;
      });
    }, 'search');
  };

  const handlePaginationChange = (model: GridPaginationModel): void => {
    setPaginationModel(model);
    void fetchOrganizations(model, searchName || undefined);
  };

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
        <Typography variant="h4" color="primary.dark" fontWeight={600}>
          Non-Insurance Organizations
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
        loading={loading}
        rowCount={totalRows}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationChange}
        pageSizeOptions={[25, 50, 100]}
        onRowClick={(params) => navigate(`/non-insurance-organizations/${params.id}`)}
        disableRowSelectionOnClick
        disableColumnMenu
        slots={dataGridSlots()}
        pagination={true}
        sx={{
          ...dataGridSx,
          height: 'calc(100vh - 310px)',
        }}
      />

      <NonInsuranceOrgDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => void fetchOrganizations(paginationModel, searchName || undefined)}
      />
    </Box>
  );
}

export function NonInsuranceOrganizationDetail(): ReactElement {
  const { id } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [item, setItem] = useState<NonInsuranceOrganizationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!oystehrZambda || !id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchBillingNonInsuranceOrgs(oystehrZambda, { nioId: id });
      setItem((data.organizations ?? [])[0] ?? null);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load non-insurance organization' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleDelete = async (): Promise<void> => {
    if (!oystehrZambda || !item) return;
    if (!window.confirm(`Delete non-insurance organization "${item.name}"?`)) return;
    try {
      await deleteBillingNonInsuranceOrg(oystehrZambda, { nioId: item.id });
      navigate('/non-insurance-organizations');
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to delete non-insurance organization' }));
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
        <Alert severity="error">{error ?? 'Non-insurance organization not found'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/non-insurance-organizations')}>
          Back to Non-Insurance Organizations
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/non-insurance-organizations')} size="small">
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
      <NonInsuranceOrgDetailSection item={item} onSaved={fetchDetail} />
    </Box>
  );
}
