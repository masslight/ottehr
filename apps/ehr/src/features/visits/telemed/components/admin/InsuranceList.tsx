import SearchIcon from '@mui/icons-material/Search';
import {
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
  useTheme,
} from '@mui/material';
import { Organization } from 'fhir/r4b';
import React, { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import Loading from 'src/components/Loading';
import { INSURANCE_ROWS_PER_PAGE } from 'src/constants';
import { dataTestIds } from 'src/constants/data-test-ids';
import { INSURANCES_URL } from 'src/features/admin/adminRoutes';
import { getPayerId } from 'utils';
import { useInsurancesQuery } from './admin.queries';

export default function InsuranceList(): ReactElement {
  const theme = useTheme();
  // set up the pagination states
  const [rowsPerPage, setRowsPerPage] = React.useState(INSURANCE_ROWS_PER_PAGE);
  const [pageNumber, setPageNumber] = React.useState(0);
  const [searchText, setSearchText] = React.useState('');

  const { data, isPending } = useInsurancesQuery(undefined, true);

  // Filter insurances based on filters and search
  const filteredInsurances = React.useMemo(() => {
    const newData: Organization[] | undefined = data
      ?.sort((a, b) => a.name?.localeCompare(b.name ?? '') ?? 0)
      .filter((insurance: Organization) => {
        let result = true;
        if (searchText && !insurance.name?.toLowerCase().includes(searchText.toLowerCase())) {
          result = false;
        }
        return result;
      });

    return newData || [];
  }, [data, searchText]);

  // Reset page number to 0 if current page has no items after filtering
  React.useEffect(() => {
    if (filteredInsurances.length === 0 || pageNumber * rowsPerPage >= filteredInsurances.length) {
      setPageNumber(0);
    }
  }, [filteredInsurances.length, pageNumber, rowsPerPage]);

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

  const skeletonRow = (key: string): JSX.Element => (
    <TableRow key={key}>
      <TableCell>
        <Skeleton width={20} height={20} />
      </TableCell>
      <TableCell>
        <Skeleton width={20} height={20} />
      </TableCell>
    </TableRow>
  );

  return (
    <Paper sx={{ padding: 2, marginTop: 2 }}>
      <TableContainer>
        <Grid container spacing={2} display="flex" alignItems="center">
          <Grid item xs={12} sm={5}>
            <TextField
              fullWidth
              id="outlined-basic"
              label="Search by name..."
              onChange={(e) => {
                if (pageNumber !== 0) setPageNumber(0);
                handleChangeSearchText(e);
              }}
              InputProps={{ endAdornment: <SearchIcon /> }}
              margin="dense"
            />
          </Grid>
          <Grid item xs={0} sm={5} />
          <Grid item xs={12} sm={2}>
            {isPending ? <Loading /> : <></>}
          </Grid>
        </Grid>

        <Table sx={{ minWidth: 650 }} aria-label="insurancesTable">
          {/* Label Row */}
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: '80%' }}>Official Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Payer ID</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isPending && [1, 2, 3].map((id) => skeletonRow('skeleton-row-' + id))}
            {currentPagesEntities.map((insurance: Organization, idx: number) => {
              const displayName = insurance.name;
              const payerId = getPayerId(insurance);
              return (
                <TableRow key={idx}>
                  <TableCell>
                    <Link
                      to={`${INSURANCES_URL}/all/${insurance.id}`}
                      style={{
                        display: 'contents',
                        color: theme.palette.primary.main,
                      }}
                    >
                      {displayName}
                    </Link>
                  </TableCell>
                  <TableCell>{payerId}</TableCell>
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
