import { Add as AddIcon, Search as SearchIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
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
import { AddNonInsuranceForm, AddNonInsuranceDialog } from '../components/AddNonInsuranceDialog';
import { useApiClients } from '../hooks/useAppClients';

interface NonInsuranceRow {
  id: string;
  name: string;
  employer: boolean;
  covers: string[];
}

// Fake data until a backend exists for non-insurance payers.
const FAKE_NON_INSURANCE_PAYERS: NonInsuranceRow[] = [
  { id: 'fake-1', name: 'Acme Manufacturing', employer: true, covers: ['Workers Comp', 'Occupational Medicine'] },
  { id: 'fake-2', name: 'City Transit Authority', employer: true, covers: ['Workers Comp', 'Medical Clearance'] },
  { id: 'fake-3', name: 'Harbor Logistics Group', employer: true, covers: ['Occupational Medicine'] },
  { id: 'fake-4', name: 'Bright Path Staffing', employer: false, covers: ['Medical Clearance', 'Other'] },
  { id: 'fake-5', name: 'Summit Construction Co.', employer: true, covers: ['Workers Comp'] },
];

const coversLabels = (data: AddNonInsuranceForm): string[] => {
  const labels: string[] = [];
  if (data.covers.workersComp) labels.push('Workers Comp');
  if (data.covers.occMed) labels.push('Occupational Medicine');
  if (data.covers.medicalClearance) labels.push('Medical Clearance');
  if (data.covers.other) labels.push('Other');
  return labels;
};

export default function NonInsuranceOrganizations(): ReactElement {
  const { oystehr } = useApiClients();

  const [rows, setRows] = useState<NonInsuranceRow[]>(FAKE_NON_INSURANCE_PAYERS);
  const [insuranceOptions, setInsuranceOptions] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [pageNumber, setPageNumber] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [addOpen, setAddOpen] = useState(false);

  // Load payer names so the Workers Comp "Bill Insurance" search has real options.
  useEffect(() => {
    if (!oystehr) return;
    let cancelled = false;
    const fetchPayers = async (): Promise<void> => {
      try {
        const payers: Organization[] = [];
        let nextCursor: string | null = null;
        do {
          const result = await oystehr.rcm.listPayers({ limit: 200, cursor: nextCursor ?? undefined });
          payers.push(...result.data);
          nextCursor = result.metadata.nextCursor;
        } while (nextCursor);
        if (!cancelled) {
          setInsuranceOptions(
            payers
              .map((p) => p.name)
              .filter((name): name is string => !!name)
              .sort((a, b) => a.localeCompare(b))
          );
        }
      } catch {
        // Options list is best-effort; the dialog still works without it.
      }
    };
    void fetchPayers();
    return () => {
      cancelled = true;
    };
  }, [oystehr]);

  const handleAdd = (data: AddNonInsuranceForm): void => {
    setRows((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, name: data.name, employer: data.employer, covers: coversLabels(data) },
    ]);
    enqueueSnackbar(`${data.name} added (not yet saved to the server)`, { variant: 'success' });
  };

  const filteredRows = useMemo(
    () =>
      rows
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter((row) => !searchText || row.name.toLowerCase().includes(searchText.toLowerCase())),
    [rows, searchText]
  );

  const currentPageRows = useMemo(
    () => filteredRows.slice(pageNumber * rowsPerPage, (pageNumber + 1) * rowsPerPage),
    [filteredRows, pageNumber, rowsPerPage]
  );

  const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>): void => {
    setRowsPerPage(parseInt(event.target.value));
    setPageNumber(0);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" color="primary.dark" fontWeight={600}>
            Non-Insurance Organizations
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Employers and other non-insurance payers.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add Organization
        </Button>
      </Box>

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

          <Table sx={{ minWidth: 650 }} aria-label="nonInsuranceOrganizationsTable">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '15%' }}>Employer</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '45%' }}>Covers</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentPageRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.employer ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                      {row.covers.map((label) => (
                        <Chip key={label} label={label} size="small" />
                      ))}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography variant="body2" color="text.secondary">
                      No non-insurance organizations found.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={filteredRows.length}
            rowsPerPage={rowsPerPage}
            page={pageNumber}
            onPageChange={(_, newPage) => setPageNumber(newPage)}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      </Paper>

      <AddNonInsuranceDialog
        open={addOpen}
        insuranceOptions={insuranceOptions}
        onClose={() => setAddOpen(false)}
        onAdd={handleAdd}
      />
    </Box>
  );
}
