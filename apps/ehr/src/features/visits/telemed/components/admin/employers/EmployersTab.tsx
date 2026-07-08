import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
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
  Tooltip,
  Typography,
} from '@mui/material';
import { Organization } from 'fhir/r4b';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { BooleanStateChip } from 'src/components/BooleanStateChip';
import { AdminHeaderActionSlot } from 'src/features/admin/AdminPageHeader';
import { useEmployersQuery } from 'src/rcm/state/employers';
import { CANDID_NON_INSURANCE_PAYER_IDENTIFIER_SYSTEM } from 'src/rcm/state/employers/employers.api';
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
    <Box>
      <AdminHeaderActionSlot>
        <Button
          color="primary"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setSelectedEmployer(null);
            setIsDialogOpen(true);
          }}
        >
          Add new
        </Button>
      </AdminHeaderActionSlot>

      <TableContainer>
        <Grid container spacing={2} display="flex" alignItems="center">
          <Grid item xs={12} sm={6}>
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
          <Grid item xs={12} sm={6}>
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
                  <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Display name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="left">
                    Status
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="left">
                    Candid
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currentPageEmployers.map((employer: Organization) => {
                  const isActive = employer.active !== false;
                  const isActiveLabel = isActive ? 'ACTIVE' : 'INACTIVE';
                  const category = employer.type?.[0]?.text || '—';

                  const isCandidSynced = employer.identifier?.some(
                    (id) => id.system === CANDID_NON_INSURANCE_PAYER_IDENTIFIER_SYSTEM && id.value
                  );

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
                      <TableCell align="left">
                        {isCandidSynced ? (
                          <Chip
                            size="small"
                            label="SYNCED"
                            sx={{
                              borderRadius: '4px',
                              border: 'none',
                              fontWeight: 500,
                              fontSize: '12px',
                              background: '#C8E6C9',
                              color: '#1B5E20',
                              padding: '0 2px',
                              height: '18px',
                            }}
                            variant="outlined"
                          />
                        ) : (
                          <Tooltip title="This employer has not been synced to Candid Health">
                            <Chip
                              size="small"
                              label="NOT SYNCED"
                              sx={{
                                borderRadius: '4px',
                                border: 'none',
                                fontWeight: 500,
                                fontSize: '12px',
                                background: '#FFF3E0',
                                color: '#E65100',
                                padding: '0 2px',
                                height: '18px',
                              }}
                              variant="outlined"
                            />
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!isFetching && currentPageEmployers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
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
    </Box>
  );
}
