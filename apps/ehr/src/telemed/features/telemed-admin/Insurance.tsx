import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import {
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  SelectChangeEvent,
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
  useTheme,
} from '@mui/material';
import { InsurancePlan } from 'fhir/r4b';
import React, { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { BooleanStateChip } from '../..';
import { INSURANCES_URL } from '../../../App';
import { INSURANCE_ROWS_PER_PAGE } from '../../../constants';
import { dataTestIds } from '../../../constants/data-test-ids';
import { otherColors } from '../../../CustomThemeProvider';
import { useInsurancesQuery } from './telemed-admin.queries';

enum IsActiveStatus {
  active,
  deactivated,
}

export default function Insurances(): ReactElement {
  const theme = useTheme();
  // set up the pagination states
  const [rowsPerPage, setRowsPerPage] = React.useState(INSURANCE_ROWS_PER_PAGE);
  const [pageNumber, setPageNumber] = React.useState(0);
  const [searchText, setSearchText] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<IsActiveStatus | ''>('');

  const { data, isFetching } = useInsurancesQuery();

  // Filter insurances based on filters and search
  const filteredInsurances = React.useMemo(() => {
    const newData: InsurancePlan[] | undefined = data?.filter(
      (insurance: InsurancePlan) =>
        (searchText ? insurance.name?.toLowerCase().includes(searchText.toLowerCase()) : true) &&
        insuranceStatusCheck(statusFilter, insurance)
    );

    return newData || [];
  }, [data, searchText, statusFilter]);

  // For pagination, only include the rows that are on the current page
  const currentPagesEntities = React.useMemo(
    () =>
      filteredInsurances.slice(
        pageNumber * rowsPerPage, // skip over the rows from previous pages
        (pageNumber + 1) * rowsPerPage // only show the rows from the current page
      ),
    [pageNumber, filteredInsurances, rowsPerPage]
  );

  // Handle pagination
  const handleChangePage = (_: unknown, newPageNumber: number): void => {
    setPageNumber(newPageNumber);
  };

  // Handle changing the number of rows per page
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setRowsPerPage(parseInt(event.target.value));
    setPageNumber(0);
  };

  // Handle changing the search text
  const handleChangeSearchText = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>): void =>
    setSearchText(event.target.value);

  // Handle change status
  const handleStatusChange = (ev: SelectChangeEvent<IsActiveStatus | ''>): void => {
    setStatusFilter(ev.target.value as IsActiveStatus | '');
  };

  const skeletonRow = (key: string): JSX.Element => (
    <TableRow key={key}>
      <TableCell>
        <Skeleton width={100} height="100%" />
      </TableCell>
      <TableCell>
        <Skeleton width={35} height={20} />
      </TableCell>
    </TableRow>
  );

  return (
    <Paper sx={{ padding: 2 }}>
      <TableContainer>
        <Grid container spacing={2} paddingTop={1} display="flex" alignItems="center">
          <Grid item xs={12} sm={5} marginTop={-0.5}>
            <TextField
              fullWidth
              id="outlined-basic"
              label="Insurance"
              onChange={(e) => {
                if (pageNumber !== 0) setPageNumber(0);
                handleChangeSearchText(e);
              }}
              InputProps={{ endAdornment: <SearchIcon /> }}
              margin="dense"
            />
          </Grid>
          <Grid item xs={12} sm={5} paddingTop={5}>
            <FormControl fullWidth>
              <InputLabel id="select-insurance-status-filter">Status</InputLabel>
              <Select
                labelId="select-insurance-status-filter"
                margin="dense"
                defaultValue={''}
                input={<OutlinedInput label="Status" />}
                onChange={handleStatusChange}
              >
                <MenuItem value={''}>None</MenuItem>
                <MenuItem value={IsActiveStatus.active}>Active</MenuItem>
                <MenuItem value={IsActiveStatus.deactivated}>Deactivated</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2} display={'flex'}>
            <Link to={`${INSURANCES_URL}/new`} style={{ width: '100%' }}>
              <Button
                sx={{
                  borderRadius: 100,
                  textTransform: 'none',
                  width: '100%',
                  fontWeight: 600,
                }}
                color="primary"
                variant="contained"
              >
                <AddIcon />
                <Typography fontWeight="bold">Add new</Typography>
              </Button>
            </Link>
          </Grid>
        </Grid>

        <Table sx={{ minWidth: 650 }} aria-label="locationsTable">
          {/* Label Row */}
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: '50%' }}>Display name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="left">
                Status
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isFetching && [1, 2, 3].map((id) => skeletonRow('skeleton-row-' + id))}
            {currentPagesEntities.map((insurance: InsurancePlan, idx: number) => {
              const displayName = insurance.name;
              const isActive = Boolean(insurance.status === 'active');
              const isActiveLabel = isActive ? 'ACTIVE' : 'DEACTIVATED';
              return (
                <TableRow key={idx}>
                  <TableCell>
                    <Link
                      to={`${INSURANCES_URL}/${insurance.id}`}
                      style={{
                        display: 'contents',
                        color: theme.palette.primary.main,
                      }}
                    >
                      {displayName}
                    </Link>
                  </TableCell>
                  <TableCell
                    align="left"
                    sx={{
                      color: otherColors.tableRow,
                    }}
                  >
                    {isFetching ? (
                      <Skeleton width={35} height={20} />
                    ) : (
                      <BooleanStateChip label={isActiveLabel} state={isActive} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Table Pagination */}
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredInsurances.length}
          rowsPerPage={rowsPerPage}
          page={pageNumber}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          data-testid={dataTestIds.pagination.paginationContainer}
        />
      </TableContainer>
    </Paper>
  );
}

function insuranceStatusCheck(curentStatus: IsActiveStatus | '', insurance: InsurancePlan): boolean {
  if (curentStatus === '') return true;
  const statusFilter = curentStatus === IsActiveStatus.active ? 'active' : 'retired';
  return insurance.status === statusFilter;
}
