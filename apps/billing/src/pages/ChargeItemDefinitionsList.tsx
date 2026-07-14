import { Add as AddIcon, ArrowBack as ArrowBackIcon, Search as SearchIcon } from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import { DataGridPro, GridColDef, GridPaginationModel } from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BillingChargeItemDefinition, ChargeItemDefinitionType, getApiError } from 'utils';
import { deleteChargeItemDefinition, getChargeItemDefinition, searchChargeItemDefinitions } from '../api/api';
import { AddChargeItemDefinitionDialog } from '../components/AddChargeItemDefinitionDialog';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { ChargeItemDefinitionDetailSection } from '../components/ChargeItemDefinitionDetailSection';
import { ChargeItemDefinitionLabels, formatChargeItemDefinitionDefault } from '../constants/chargeItemDefinition';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';

interface CIDRow {
  id: string;
  name: string;
  description?: string;
  default?: string;
  status: 'active' | 'retired';
  effectiveDate?: string;
}

const columns: GridColDef[] = [
  {
    field: 'name',
    headerName: 'Name',
    flex: 1,
    minWidth: 200,
  },
  {
    field: 'description',
    headerName: 'Description',
    width: 130,
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 140,
  },
  {
    field: 'default',
    headerName: 'Is Default For',
    width: 220,
  },
  {
    field: 'effectiveDate',
    headerName: 'Effective Date',
    flex: 1,
    minWidth: 240,
  },
];

export function ChargeItemDefinitionList({ type }: { type: ChargeItemDefinitionType }): ReactElement {
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [cids, setCIDs] = useState<CIDRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [searchName, setSearchName] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const { debounce } = useDebounce();

  const fetchCIDs = useCallback(
    async (pagination: GridPaginationModel, name?: string): Promise<void> => {
      if (!oystehrZambda) return;
      setLoading(true);
      setError(null);
      try {
        const data = await searchChargeItemDefinitions(oystehrZambda, {
          type,
          pageSize: pagination.pageSize,
          offset: pagination.page * pagination.pageSize,
          ...(name ? { name } : {}),
        });
        setCIDs(data.items.map((cid) => ({ ...cid, default: formatChargeItemDefinitionDefault(cid.default) })));
        setTotalRows(data.total ?? 0);
      } catch (err) {
        setError(
          getApiError({ error: err, defaultError: `Failed to load ${ChargeItemDefinitionLabels[type].listText}` })
        );
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda, type]
  );

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!oystehrZambda || initialLoadDone.current) return;
    initialLoadDone.current = true;
    void fetchCIDs(paginationModel);
  }, [oystehrZambda, fetchCIDs, paginationModel]);

  const handleSearchChange = (value: string): void => {
    setSearchName(value);
    debounce(() => {
      setPaginationModel((prev) => {
        const next = {
          ...prev,
          page: 0,
        };
        void fetchCIDs(next, value || undefined);
        return next;
      });
    }, 'search');
  };

  const handlePaginationChange = (model: GridPaginationModel): void => {
    setPaginationModel(model);
    void fetchCIDs(model, searchName || undefined);
  };

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" color="primary.dark" fontWeight={600}>
          {ChargeItemDefinitionLabels[type].listTitle}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          {ChargeItemDefinitionLabels[type].addButton}
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
        rows={cids}
        columns={columns}
        loading={loading}
        rowCount={totalRows}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationChange}
        pageSizeOptions={[25, 50, 100]}
        onRowClick={(params) => navigate(`/${ChargeItemDefinitionLabels[type].pathComponent}/${params.id}`)}
        disableRowSelectionOnClick
        disableColumnMenu
        slots={dataGridSlots}
        pagination={true}
        sx={{
          ...dataGridSx,
          height: 'calc(100vh - 310px)',
        }}
      />

      <AddChargeItemDefinitionDialog
        type={type}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => void fetchCIDs(paginationModel, searchName || undefined)}
      />
    </Box>
  );
}

export function ChargeItemDefinitionDetail({ type }: { type: ChargeItemDefinitionType }): ReactElement {
  const { id } = useParams();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

  const [cid, setCid] = useState<BillingChargeItemDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!oystehrZambda || !id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getChargeItemDefinition(oystehrZambda, { type, chargeItemDefinitionId: id });
      setCid(data);
    } catch (err) {
      setError(getApiError({ error: err, defaultError: `Failed to load ${type}` }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, id, type]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleDelete = async (): Promise<void> => {
    if (!oystehrZambda || !id || !cid) return;
    if (
      !window.confirm(
        `Delete ${ChargeItemDefinitionLabels[type].singularText} "${cid.name}"? It will no longer be used for new claims.`
      )
    )
      return;
    try {
      await deleteChargeItemDefinition(oystehrZambda, { type, chargeItemDefinitionId: id });
      navigate(`/${ChargeItemDefinitionLabels[type].pathComponent}`);
    } catch (err) {
      setError(
        getApiError({ error: err, defaultError: `Failed to delete ${ChargeItemDefinitionLabels[type].singularText}` })
      );
    }
  };

  if (loading && !cid) {
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

  if (error || !cid) {
    return (
      <Box sx={{ p: 0 }}>
        <Alert severity="error">{error ?? `${ChargeItemDefinitionLabels[type].singularText} not found`}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate(`/${ChargeItemDefinitionLabels[type].pathComponent}`)}>
          Back to {ChargeItemDefinitionLabels[type].listTitle}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate(`/${ChargeItemDefinitionLabels[type].pathComponent}`)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" color="primary.dark" fontWeight={600}>
          {cid.name}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button color="error" onClick={() => void handleDelete()}>
          Delete
        </Button>
      </Box>
      <ChargeItemDefinitionDetailSection type={type} cid={cid} onSaved={fetchDetail} />
    </Box>
  );
}
