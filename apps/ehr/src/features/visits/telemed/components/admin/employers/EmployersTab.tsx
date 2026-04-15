import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
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
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { BooleanStateChip } from 'src/components/BooleanStateChip';
import { useEmployersQuery } from 'src/rcm/state/employers';
import EmployerDialog from './EmployerDialog';

enum EmployerActiveStatus {
  active,
  inactive,
}

export default function EmployersTab(): ReactElement {
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [pageNumber, setPageNumber] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [activeFilter, setActiveFilter] = useState<EmployerActiveStatus | ''>(EmployerActiveStatus.active);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmployer, setSelectedEmployer] = useState<Organization | null>(null);

  const { data, isLoading, isFetching } = useEmployersQuery();

  const employers = useMemo(() => [...(data || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '')), [data]);

  const filteredEmployers = useMemo(() => {
    return employers.filter((employer) => {
      const isActive = employer.active !== false;
      if (activeFilter === EmployerActiveStatus.active && !isActive) return false;
      if (activeFilter === EmployerActiveStatus.inactive && isActive) return false;
      if (searchText && !employer.name?.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [activeFilter, employers, searchText]);

  const currentPageEmployers = useMemo(
    () => filteredEmployers.slice(pageNumber * rowsPerPage, (pageNumber + 1) * rowsPerPage),
    [filteredEmployers, pageNumber, rowsPerPage]
  );

  useEffect(() => {
    if (filteredEmployers.length === 0 || pageNumber * rowsPerPage >= filteredEmployers.length) {
      setPageNumber(0);
    }
  }, [filteredEmployers.length, pageNumber, rowsPerPage]);

  return (
    <Paper sx={{ padding: 2, marginTop: 2 }}>
      <TableContainer>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            sx={{ flex: '1 1 auto', maxWidth: 400 }}
            label="Employer"
            onChange={(e) => {
              if (pageNumber !== 0) setPageNumber(0);
              setSearchText(e.target.value);
            }}
            InputProps={{ endAdornment: <SearchIcon /> }}
            margin="dense"
            size="small"
          />
          <FormControl sx={{ flex: '1 1 auto', maxWidth: 400 }} size="small" margin="dense">
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
          <Box sx={{ marginLeft: 'auto', flexShrink: 0 }}>
            <Button
              sx={{
                borderRadius: 100,
                textTransform: 'none',
                fontWeight: 500,
              }}
              color="primary"
              variant="contained"
              onClick={() => {
                setSelectedEmployer(null);
                setIsDialogOpen(true);
              }}
              startIcon={<AddIcon />}
            >
              Add New
            </Button>
          </Box>
        </Box>

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
