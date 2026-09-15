import { Search as SearchIcon } from '@mui/icons-material';
import { Alert, Box, Button, InputAdornment, TextField, Typography } from '@mui/material';
import { DataGridPro, GridColDef } from '@mui/x-data-grid-pro';
import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { BillingPayerOption } from 'utils/lib/types/data/billing/billing.types';
import { searchBillingPayers } from '../api/api';
import { dataGridSlots, dataGridSx } from '../components/BillingDataGrid';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';

const columns: GridColDef<BillingPayerOption>[] = [
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 240 },
  { field: 'payerId', headerName: 'Payer ID', width: 160 },
];

export function InsuranceOrganizationsList(): ReactElement {
  const { oystehrZambda } = useApiClients();

  const [payers, setPayers] = useState<BillingPayerOption[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchName, setSearchName] = useState('');
  const { debounce } = useDebounce();

  const fetchPayers = useCallback(
    async (name?: string): Promise<void> => {
      if (!oystehrZambda) return;
      setLoading(true);
      setError(null);
      try {
        const data = await searchBillingPayers(oystehrZambda, { ...(name ? { name } : {}), limit: 50 });
        setPayers(data.payers ?? []);
        setNextCursor(data.nextCursor ?? null);
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
    void fetchPayers();
  }, [oystehrZambda, fetchPayers]);

  const handleSearchChange = (value: string): void => {
    setSearchName(value);
    debounce(() => void fetchPayers(value || undefined), 'search');
  };

  return (
    <Box sx={{ p: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Typography variant="h4" color="primary.dark" fontWeight={600}>
          Insurance Organizations
        </Typography>
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
        rows={payers}
        columns={columns}
        loading={loading}
        disableRowSelectionOnClick
        disableColumnMenu
        hideFooter
        slots={dataGridSlots()}
        sx={{ ...dataGridSx, height: 'calc(100vh - 360px)' }}
      />

      {!searchName && nextCursor && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button variant="outlined" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </Box>
      )}
    </Box>
  );
}
