import { ArrowBack as ArrowBackIcon, Search as SearchIcon } from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel } from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { chooseJson, CMS_PLACE_OF_SERVICE_CODES, ServiceFacilityItem } from 'utils';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { DetailRow } from '../components/DetailRow';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';

const POS_LABEL_BY_CODE = new Map(CMS_PLACE_OF_SERVICE_CODES.map((pos) => [pos.code, pos.display]));

function placeOfServiceLabel(code: string): string {
  if (!code) return '';
  const display = POS_LABEL_BY_CODE.get(code);
  return display ? `${code} - ${display}` : code;
}

function formatFacilityAddress(facility: ServiceFacilityItem): string {
  const zip = facility.zipPlus4 ? `${facility.zip}-${facility.zipPlus4}` : facility.zip;
  return [facility.addressLine1, facility.addressLine2, facility.city, facility.state, zip].filter(Boolean).join(', ');
}

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
  const { debounce } = useDebounce();

  const fetchFacilities = useCallback(
    async (pagination: GridPaginationModel, name?: string): Promise<void> => {
      if (!oystehrZambda) return;
      setLoading(true);
      setError(null);
      try {
        // todo replace with billing api layer when merged into develop
        const response = await oystehrZambda.zambda.execute({
          id: 'search-billing-service-facilities',
          pageSize: pagination.pageSize,
          offset: pagination.page * pagination.pageSize,
          ...(name ? { name } : {}),
        });
        const data = chooseJson(response);
        setFacilities((data.facilities ?? []).map(toRow));
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
    void fetchFacilities(paginationModel);
  }, [oystehrZambda, fetchFacilities, paginationModel]);

  const handleSearchChange = (value: string): void => {
    setSearchName(value);
    debounce(() => {
      setPaginationModel((prev) => ({
        ...prev,
        page: 0,
      }));
      void fetchFacilities(
        {
          ...paginationModel,
          page: 0,
        },
        value || undefined
      );
    }, 'search');
  };

  const handlePaginationChange = (model: GridPaginationModel): void => {
    setPaginationModel(model);
    void fetchFacilities(model, searchName || undefined);
  };

  return (
    <Box sx={{ p: 0 }}>
      <Typography variant="h4" color="primary.dark" fontWeight={600} sx={{ mb: 3 }}>
        Service Facilities
      </Typography>

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
        sx={{
          ...dataGridSx,
          height: 'calc(100vh - 310px)',
        }}
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
      // todo replace with billing api layer when merged into develop
      const response = await oystehrZambda.zambda.execute({
        id: 'search-billing-service-facilities',
        facilityId: id,
      });
      const data = chooseJson(response);
      setFacility((data.facilities ?? [])[0] ?? null);
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
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <DetailRow label="Name" value={facility.name} />
        <DetailRow label="NPI" value={facility.npi} />
        <DetailRow label="CLIA Number" value={facility.clia} />
        <DetailRow label="Place of Service" value={placeOfServiceLabel(facility.posCode)} />
        <DetailRow label="Address" value={formatFacilityAddress(facility)} />
      </Box>
    </Box>
  );
}
