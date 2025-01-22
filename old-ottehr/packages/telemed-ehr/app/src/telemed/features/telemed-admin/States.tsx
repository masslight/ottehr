import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
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
import React, { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { BooleanStateChip } from '../..';
import { otherColors } from '../../../CustomThemeProvider';
import Loading from '../../../components/Loading';
import { AllStates, AllStatesToNames, State, StateType } from '../../../types/types';
import { useStatesQuery } from './telemed-admin.queries';

export default function StatesPage(): ReactElement {
  const theme = useTheme();
  // set up the pagination states
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [pageNumber, setPageNumber] = React.useState(0);
  const [searchText, setSearchText] = React.useState('');

  const { data, isFetching } = useStatesQuery();
  const stateLocations = data || [];

  // Filter the states based on the search text
  const filteredStates = React.useMemo(
    () =>
      AllStates.filter((state: State) =>
        `${state.label} - ${AllStatesToNames[state.value as StateType]}`
          .toLowerCase()
          .includes(searchText.toLowerCase()),
      ),
    [searchText],
  );

  // For pagination, only include the rows that are on the current page
  const pageStates = React.useMemo(
    () =>
      filteredStates.slice(
        pageNumber * rowsPerPage, // skip over the rows from previous pages
        (pageNumber + 1) * rowsPerPage, // only show the rows from the current page
      ),
    [pageNumber, filteredStates, rowsPerPage],
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
    <Paper sx={{ padding: 2 }}>
      <TableContainer>
        <Grid container direction="row" justifyContent="space-between" alignItems="center">
          {/* Locations Search Box */}
          <Box sx={{ display: 'contents' }}>
            <Box>
              <TextField
                id="outlined-basic"
                label="States"
                variant="outlined"
                onChange={(e) => {
                  if (pageNumber !== 0) setPageNumber(0);
                  handleChangeSearchText(e);
                }}
                InputProps={{ endAdornment: <SearchIcon /> }}
                sx={{ marginBottom: 2 }}
                margin="dense"
              />
            </Box>
          </Box>
          {isFetching && <Loading />}
        </Grid>

        <Table sx={{ minWidth: 650 }} aria-label="locationsTable">
          {/* Label Row */}
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: '50%' }}>State</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }} align="left">
                Operate in state
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageStates.map((state: State, idx: number) => {
              const stateLocation = stateLocations.find((loc) => loc.address?.state === state.value);
              const operatesInState = Boolean(stateLocation && stateLocation.status === 'active');
              const operatesLabelText = operatesInState ? 'yes' : 'no';
              return (
                <TableRow key={idx}>
                  <TableCell>
                    <Link
                      to={`/telemed-admin/states/${state.value}`}
                      style={{
                        display: 'contents',
                        color: theme.palette.primary.main,
                      }}
                    >
                      {state.label} - {AllStatesToNames[state.value as StateType]}
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
                      <BooleanStateChip label={operatesLabelText} state={operatesInState} />
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
          count={filteredStates.length}
          rowsPerPage={rowsPerPage}
          page={pageNumber}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
    </Paper>
  );
}
