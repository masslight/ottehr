import { Add as AddIcon, ArrowBack as ArrowBackIcon, Search as SearchIcon } from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel } from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getApiError, ServiceFacilityItem } from 'utils';
import { deleteBillingServiceFacility, searchBillingServiceFacilities } from '../api/api';
import { AddServiceFacilityDialog } from '../components/AddServiceFacilityDialog';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { ServiceFacilityDetailSection } from '../components/ServiceFacilityDetailSection';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';
import { formatFacilityAddress, placeOfServiceLabel } from '../utils/format';

interface FacilityRow extends ServiceFacilityItem {
  posDisplay: string;
  address: string;
}

function toRow(facility: ServiceFacilityItem): FacilityRow {
  return {
    ...facility,
    posDisplay: placeOfServiceLabel(facility.posCode),
    address: formatFacilityAddress(facility),
  };
}

const columns: GridColDef[] = [
  {
    field: 'name',
    headerName: 'Name',
    flex: 1,
    minWidth: 200,
  },
  {
    field: 'npi',
    headerName: 'NPI',
    width: 130,
  },
  {
    field: 'clia',
    headerName: 'CLIA Number',
    width: 140,
  },
  {
    field: 'posDisplay',
    headerName: 'Place of Service',
    width: 220,
  },
  {
    field: 'address',
    headerName: 'Address',
    flex: 1,
    minWidth: 240,
  },
];

export function ServiceFacilitiesList(): ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [searchName, setSearchName] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const { debounce } = useDebounce();

  const fetchFacilities = useCallback(
    async (pagination: GridPaginationModel, name?: string): Promise<void> => {
      if (!oystehrZambda) return;
      setLoading(true);
      setError(null);
      try {
        const data = await searchBillingServiceFacilities(oystehrZambda, {
          pageSize: pagination.pageSize,
          offset: pagination.page * pagination.pageSize,
          ...(name ? { name } : {}),
        });
        setFacilities((data.facilities ?? []).map(toRow));
        setTotalRows(data.total ?? 0);
      } catch (err) {
        setError(getApiError({ error: err, defaultError: 'Failed to load service facilities' }));
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
    void fetchFacilities(paginationModel);
  }, [oystehrZambda, fetchFacilities, paginationModel]);

  const handleSearchChange = (value: string): void => {
    setSearchName(value);
    debounce(() => {
      setPaginationModel((prev) => {
        const next = {
          ...prev,
          page: 0,
        };
        void fetchFacilities(next, value || undefined);
        return next;
      });
    }, 'search');
  };

  const handlePaginationChange = (model: GridPaginationModel): void => {
    setPaginationModel(model);
    void fetchFacilities(model, searchName || undefined);
  };

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
        <Typography variant="h4" color="primary.dark" fontWeight={600}>
          Service Facilities
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add Service Facility
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
        rows={facilities}
        columns={columns}
        loading={loading}
        rowCount={totalRows}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationChange}
        pageSizeOptions={[25, 50, 100]}
        onRowClick={(params) => navigate(`/service-facilities/${params.id}`)}
        disableRowSelectionOnClick
        disableColumnMenu
        slots={dataGridSlots}
        pagination={true}
        sx={{
          ...dataGridSx,
          height: 'calc(100vh - 310px)',
        }}
      />

      <AddServiceFacilityDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => void fetchFacilities(paginationModel, searchName || undefined)}
      />
    </Box>
  );
}

export function ServiceFacilityDetail(): ReactElement {
  const { id } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [facility, setFacility] = useState<ServiceFacilityItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!oystehrZambda || !id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchBillingServiceFacilities(oystehrZambda, { facilityId: id });
      setFacility((data.facilities ?? [])[0] ?? null);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load service facility' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleDelete = async (): Promise<void> => {
    if (!oystehrZambda || !facility) return;
    if (!window.confirm(`Delete service facility "${facility.name}"? It will no longer match new claims.`)) return;
    try {
      await deleteBillingServiceFacility(oystehrZambda, { facilityId: facility.id });
      navigate('/service-facilities');
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to delete service facility' }));
    }
  };

  if (loading && !facility) {
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

  if (error || !facility) {
    return (
      <Box sx={{ p: 0 }}>
        <Alert severity="error">{error ?? 'Service facility not found'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/service-facilities')}>
          Back to Service Facilities
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/service-facilities')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" color="primary.dark" fontWeight={600}>
          {facility.name}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button color="error" onClick={() => void handleDelete()}>
          Delete
        </Button>
      </Box>
      <ServiceFacilityDetailSection facility={facility} onSaved={fetchDetail} />
    </Box>
  );
}
