import { otherColors } from '@ehrTheme/colors';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
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
import { Location } from 'fhir/r4b';
import React, { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { VIRTUAL_LOCATIONS_URL } from 'src/App';
import { BooleanStateChip } from 'src/components/BooleanStateChip';
import Loading from 'src/components/Loading';
import { STATES_ROWS_PER_PAGE } from 'src/constants';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useVirtualLocationsQuery } from './admin.queries';

export default function VirtualLocationsPage(): ReactElement {
  const theme = useTheme();
  // set up the pagination states
  const [rowsPerPage, setRowsPerPage] = React.useState(STATES_ROWS_PER_PAGE);
  const [pageNumber, setPageNumber] = React.useState(0);
  const [searchText, setSearchText] = React.useState('');

  const { data, isFetching } = useVirtualLocationsQuery();
  const virtualLocations = React.useMemo(() => data || [], [data]);

  // Filter the states based on the search text
  const filteredLocations = React.useMemo(
    () =>
      virtualLocations.filter((location: Location) => location.name?.toLowerCase().includes(searchText.toLowerCase())),
    [searchText, virtualLocations]
  );

  // For pagination, only include the rows that are on the current page
  const pageLocations = React.useMemo(
    () =>
      filteredLocations.slice(
        pageNumber * rowsPerPage, // skip over the rows from previous pages
        (pageNumber + 1) * rowsPerPage // only show the rows from the current page
      ),
    [pageNumber, filteredLocations, rowsPerPage]
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

  return (
    <Paper sx={{ padding: 2, marginTop: 2 }}>
      <TableContainer>
        <Box sx={{ display: 'flex', alignItems: 'center', paddingTop: 1, marginBottom: 2 }}>
          <TextField
            id="outlined-basic"
            label="States"
            variant="outlined"
            onChange={(e) => {
              if (pageNumber !== 0) setPageNumber(0);
              handleChangeSearchText(e);
            }}
            InputProps={{ endAdornment: <SearchIcon /> }}
            margin="dense"
            size="small"
            sx={{ flex: '1 1 auto', maxWidth: 400 }}
            data-testid={dataTestIds.virtualLocationsPage.locationsSearch}
          />
          {isFetching && (
            <Box sx={{ marginLeft: 2 }}>
              <Loading />
            </Box>
          )}
        </Box>

        <Table sx={{ minWidth: 650 }} aria-label="locationsTable">
          {/* Label Row */}
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: '50%' }}>Location</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="left">
                Active
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageLocations.map((location: Location) => {
              const operatesInLocation = Boolean(location && location.status === 'active');
              const operatesLabelText = operatesInLocation ? 'yes' : 'no';
              return (
                <TableRow
                  role="row"
                  key={location.id}
                  data-testid={dataTestIds.virtualLocationsPage.locationRow(location.id!)}
                >
                  <TableCell data-testid={dataTestIds.virtualLocationsPage.locationValue}>
                    <Link
                      to={`${VIRTUAL_LOCATIONS_URL}/${location.id}`}
                      style={{
                        display: 'contents',
                        color: theme.palette.primary.main,
                      }}
                    >
                      {location.name}
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
                      <BooleanStateChip
                        dataTestId={dataTestIds.virtualLocationsPage.operateInLocationValue}
                        label={operatesLabelText}
                        state={operatesInLocation}
                      />
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
          count={filteredLocations.length}
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
