import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  SelectChangeEvent,
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
import React, { ReactElement } from 'react';
import { BooleanStateChip } from 'src/components/BooleanStateChip';
import { useEmployersQuery } from 'src/rcm/state/employers';
import EmployerDialog from './EmployerDialog';

enum EmployerActiveStatus {
  active,
  inactive,
}

export default function EmployersTab(): ReactElement {
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [pageNumber, setPageNumber] = React.useState(0);
  const [searchText, setSearchText] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<EmployerActiveStatus | ''>('');
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedEmployer, setSelectedEmployer] = React.useState<Organization | null>(null);

  const { data, isLoading, isFetching } = useEmployersQuery();

  const employers = React.useMemo(
    () => (data || []).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [data]
  );

  const filteredEmployers = React.useMemo(() => {
    return employers.filter((employer) => {
      const isActive = employer.active !== false;
      if (activeFilter === EmployerActiveStatus.active && !isActive) return false;
      if (activeFilter === EmployerActiveStatus.inactive && isActive) return false;
      if (searchText && !employer.name?.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [activeFilter, employers, searchText]);

  const currentPageEmployers = React.useMemo(
    () => filteredEmployers.slice(pageNumber * rowsPerPage, (pageNumber + 1) * rowsPerPage),
    [filteredEmployers, pageNumber, rowsPerPage]
  );

  React.useEffect(() => {
    if (filteredEmployers.length === 0 || pageNumber * rowsPerPage >= filteredEmployers.length) {
      setPageNumber(0);
    }
  }, [filteredEmployers.length, pageNumber, rowsPerPage]);

  return (
    <Paper sx={{ padding: 2, marginTop: 2 }}>
      <TableContainer>
        <Grid container spacing={2} display="flex" alignItems="center">
          <Grid item xs={12} sm={5}>
            <TextField
              fullWidth
              label="Employer"
              onChange={(e) => {
                if (pageNumber !== 0) setPageNumber(0);
                setSearchText(e.target.value);
              }}
              InputProps={{ endAdornment: <SearchIcon /> }}
              margin="dense"
            />
          </Grid>
          <Grid item xs={12} sm={5}>
            <FormControl fullWidth>
              <InputLabel id="select-employer-status-filter">Status</InputLabel>
              <Select
                labelId="select-employer-status-filter"
                margin="dense"
                value={activeFilter}
                input={<OutlinedInput label="Status" />}
                onChange={(ev: SelectChangeEvent<EmployerActiveStatus | ''>) => {
                  setActiveFilter(ev.target.value as EmployerActiveStatus | '');
                }}
              >
                <MenuItem value={''}>None</MenuItem>
                <MenuItem value={EmployerActiveStatus.active}>Active</MenuItem>
                <MenuItem value={EmployerActiveStatus.inactive}>Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2} display={'flex'}>
            <Button
              sx={{
                borderRadius: 100,
                textTransform: 'none',
                width: '100%',
                fontWeight: 600,
              }}
              color="primary"
              variant="contained"
              onClick={() => {
                setSelectedEmployer(null);
                setIsDialogOpen(true);
              }}
            >
              <AddIcon />
              <Typography fontWeight="bold">Add new</Typography>
            </Button>
          </Grid>
        </Grid>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table sx={{ minWidth: 700 }} aria-label="Employers table">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', width: '45%' }}>Display name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '35%' }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="left">
                    Status
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentPageEmployers.map((employer: Organization) => {
                  const isActive = employer.active !== false;
                  const isActiveLabel = isActive ? 'ACTIVE' : 'INACTIVE';
                  const category = employer.type?.[0]?.text || '—';

                  return (
                    <TableRow
                      key={employer.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedEmployer(employer);
                        setIsDialogOpen(true);
                      }}
                    >
                      <TableCell>{employer.name || '—'}</TableCell>
                      <TableCell>{category}</TableCell>
                      <TableCell align="left">
                        <BooleanStateChip label={isActiveLabel} state={isActive} />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!isFetching && currentPageEmployers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      <Typography color="text.secondary">No employers found.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={filteredEmployers.length}
              rowsPerPage={rowsPerPage}
              page={pageNumber}
              onPageChange={(_, newPage) => setPageNumber(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value));
                setPageNumber(0);
              }}
            />
          </>
        )}
      </TableContainer>

      <EmployerDialog
        open={isDialogOpen}
        employer={selectedEmployer}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedEmployer(null);
        }}
      />
    </Paper>
  );
}
