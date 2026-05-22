import { Clear as ClearIcon, Search as SearchIcon } from '@mui/icons-material';
import { Alert, Box, Button, CircularProgress, InputAdornment, TextField, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chooseJson } from 'utils';
import { useApiClients } from '../hooks/useAppClients';
import { otherColors } from '../themes/ottehr/colors';

interface PatientRow {
  id: string;
  name: string;
  dob: string;
  gender: string;
  address: string;
  friendlyId: string;
}

const columns: GridColDef[] = [
  { field: 'name', headerName: 'Patient Name', flex: 1, minWidth: 180 },
  { field: 'dob', headerName: 'Date of Birth', width: 120 },
  { field: 'gender', headerName: 'Gender', width: 90 },
  { field: 'friendlyId', headerName: 'Friendly ID', width: 140 },
  { field: 'id', headerName: 'Patient UUID', width: 300 },
  { field: 'address', headerName: 'Address', flex: 1, minWidth: 200 },
];

interface Filters {
  name?: string;
  dob?: string;
  identifier?: string;
  uuid?: string;
}

export default function PatientsList(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();

  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchName, setSearchName] = useState('');
  const [searchDob, setSearchDob] = useState('');
  const [searchId, setSearchId] = useState('');
  const [searchUuid, setSearchUuid] = useState('');

  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uuidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return (): void => {
      if (nameTimer.current) clearTimeout(nameTimer.current);
      if (idTimer.current) clearTimeout(idTimer.current);
      if (uuidTimer.current) clearTimeout(uuidTimer.current);
    };
  }, []);

  const fetchPatients = useCallback(
    async (filters: Filters): Promise<void> => {
      if (!oystehrZambda) return;
      setLoading(true);
      setError(null);
      try {
        const hasSearch = filters.name || filters.dob || filters.identifier || filters.uuid;
        const body: Record<string, unknown> = {};
        if (hasSearch) body.includeWorkingCopies = true;
        if (filters.name) body.name = filters.name;
        if (filters.dob) body.dob = filters.dob;
        if (filters.identifier) body.identifier = filters.identifier;
        if (filters.uuid) body.uuid = filters.uuid;
        const data = chooseJson(await oystehrZambda.zambda.execute({ id: 'search-billing-patients', ...body }));
        setPatients(data?.patients ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPatients([]);
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
    void fetchPatients({});
  }, [oystehrZambda, fetchPatients]);

  const currentFilters = useCallback(
    (overrides?: Filters): Filters => ({
      name: overrides?.name ?? searchName,
      dob: overrides?.dob ?? searchDob,
      identifier: overrides?.identifier ?? searchId,
      uuid: overrides?.uuid ?? searchUuid,
    }),
    [searchName, searchDob, searchId, searchUuid]
  );

  const applyFilters = useCallback(
    (overrides?: Filters): void => {
      void fetchPatients(currentFilters(overrides));
    },
    [fetchPatients, currentFilters]
  );

  const handleNameChange = (value: string): void => {
    setSearchName(value);
    if (nameTimer.current) clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(() => applyFilters({ name: value }), 400);
  };

  const handleUuidChange = (value: string): void => {
    setSearchUuid(value);
    if (uuidTimer.current) clearTimeout(uuidTimer.current);
    uuidTimer.current = setTimeout(() => applyFilters({ uuid: value }), 400);
  };

  const handleIdChange = (value: string): void => {
    setSearchId(value);
    if (idTimer.current) clearTimeout(idTimer.current);
    idTimer.current = setTimeout(() => applyFilters({ identifier: value }), 400);
  };

  const clearFilters = (): void => {
    setSearchName('');
    setSearchDob('');
    setSearchId('');
    setSearchUuid('');
    void fetchPatients({});
  };

  const hasFilters = searchName || searchDob || searchId || searchUuid;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" color="primary.dark" fontWeight={600} sx={{ mb: 3 }}>
        Patients
      </Typography>

      <TextField
        fullWidth
        size="small"
        placeholder="Search by name..."
        value={searchName}
        onChange={(e) => handleNameChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          type="date"
          label="Date of Birth"
          value={searchDob}
          onChange={(e) => {
            setSearchDob(e.target.value);
            applyFilters({ dob: e.target.value });
          }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 160 }}
        />

        <TextField
          size="small"
          label="Patient UUID"
          placeholder="Patient UUID..."
          value={searchUuid}
          onChange={(e) => handleUuidChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 300 }}
        />

        <TextField
          size="small"
          label="Friendly ID"
          placeholder="Friendly ID..."
          value={searchId}
          onChange={(e) => handleIdChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 180 }}
        />

        {hasFilters && (
          <Button variant="text" size="small" startIcon={<ClearIcon />} onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <DataGridPro
        rows={patients}
        columns={columns}
        loading={loading}
        onRowClick={(params) => navigate(`/patients/${params.id}`)}
        disableRowSelectionOnClick
        disableColumnMenu
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        slots={{
          noRowsOverlay: () => (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Typography color="text.secondary">{loading ? '' : 'No patients found.'}</Typography>
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
          height: 'calc(100vh - 310px)',
        }}
      />
    </Box>
  );
}
