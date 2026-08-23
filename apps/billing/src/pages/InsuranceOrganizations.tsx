import { Add as AddIcon, Search as SearchIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Grid,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Organization } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { ChangeEvent, ReactElement, useEffect, useMemo, useState } from 'react';
import { getPayerId } from 'utils/lib/helpers/helpers';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { AddInsuranceDialog, AddInsuranceForm, INSURANCE_ID_PREFIX } from '../components/AddInsuranceDialog';
import { useApiClients } from '../hooks/useAppClients';

export default function InsuranceOrganizations(): ReactElement {
  const { oystehr } = useApiClients();

  const [insurances, setInsurances] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [pageNumber, setPageNumber] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [addOpen, setAddOpen] = useState(false);

  // UI-only for now: adds the new insurance to the local list without persisting it.
  const handleAddInsurance = (data: AddInsuranceForm): void => {
    const newInsurance: Organization = {
      resourceType: 'Organization',
      id: `local-${Date.now()}`,
      name: data.name,
      identifier: [
        {
          system: 'https://identifiers.fhir.oystehr.com/rcm-payer-id',
          value: `${INSURANCE_ID_PREFIX}${data.idSuffix}`,
        },
      ],
    };
    setInsurances((prev) => [...prev, newInsurance]);
    enqueueSnackbar(`${data.name} added (not yet saved to the server)`, { variant: 'success' });
  };

  useEffect(() => {
    if (!oystehr) return;
    let cancelled = false;
    const fetchPayers = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const payers: Organization[] = [];
        let nextCursor: string | null = null;
        do {
          const result = await oystehr.rcm.listPayers({ limit: 200, cursor: nextCursor ?? undefined });
          payers.push(...result.data);
          nextCursor = result.metadata.nextCursor;
        } while (nextCursor);
        if (!cancelled) setInsurances(payers);
      } catch (e) {
        if (!cancelled) setError(getApiError(e) ?? 'Failed to load insurance organizations');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchPayers();
    return () => {
      cancelled = true;
    };
  }, [oystehr]);

  const filteredInsurances = useMemo(
    () =>
      insurances
        .slice()
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
        .filter((insurance) => !searchText || insurance.name?.toLowerCase().includes(searchText.toLowerCase())),
    [insurances, searchText]
  );

  const currentPageEntities = useMemo(
    () => filteredInsurances.slice(pageNumber * rowsPerPage, (pageNumber + 1) * rowsPerPage),
    [filteredInsurances, pageNumber, rowsPerPage]
  );

  const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>): void => {
    setRowsPerPage(parseInt(event.target.value));
    setPageNumber(0);
  };

  const skeletonRow = (key: string): ReactElement => (
    <TableRow key={key}>
      <TableCell>
        <Skeleton width={200} height={20} />
      </TableCell>
      <TableCell>
        <Skeleton width={60} height={20} />
      </TableCell>
    </TableRow>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" color="primary.dark" fontWeight={600}>
            Insurance Organizations
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Insurance payers configured for this project.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add Insurance
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ padding: 2, marginTop: 2 }}>
        <TableContainer>
          <Grid container spacing={2} display="flex" alignItems="center">
            <Grid item xs={12} sm={5}>
              <TextField
                fullWidth
                label="Search by name..."
                value={searchText}
                onChange={(e) => {
                  setPageNumber(0);
                  setSearchText(e.target.value);
                }}
                InputProps={{ endAdornment: <SearchIcon /> }}
                margin="dense"
              />
            </Grid>
          </Grid>

          <Table sx={{ minWidth: 650 }} aria-label="insuranceOrganizationsTable">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: '80%' }}>Official Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Payer ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && [1, 2, 3].map((id) => skeletonRow('skeleton-row-' + id))}
              {!loading &&
                currentPageEntities.map((insurance) => (
                  <TableRow key={insurance.id}>
                    <TableCell>{insurance.name}</TableCell>
                    <TableCell>{getPayerId(insurance)}</TableCell>
                  </TableRow>
                ))}
              {!loading && !error && filteredInsurances.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2}>
                    <Typography variant="body2" color="text.secondary">
                      No insurance organizations found.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={filteredInsurances.length}
            rowsPerPage={rowsPerPage}
            page={pageNumber}
            onPageChange={(_, newPage) => setPageNumber(newPage)}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      </Paper>

      <AddInsuranceDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAddInsurance} />
    </Box>
  );
}
