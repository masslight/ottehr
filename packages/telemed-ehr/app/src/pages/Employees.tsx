import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  // Chip,
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
  useTheme,
} from '@mui/material';
import { User } from '@zapehr/sdk';
import React, { ReactElement, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageContainer from '../layout/PageContainer';
// import { checkUserIsActive } from '../helpers/checkUserIsActive';
import { otherColors } from '../CustomThemeProvider';
import Loading from '../components/Loading';
import { useApiClients } from '../hooks/useAppClients';

export default function EmployeesPage(): ReactElement {
  // set up the  appClient and theme
  const { appClient } = useApiClients();
  const theme = useTheme();

  // set up the pagination states
  const [rowsPerPage, setRowsPerPage] = React.useState(5);
  const [pageNumber, setPageNumber] = React.useState(0);
  const [searchText, setSearchText] = React.useState('');
  const [loading, setLoading] = useState<boolean>(false);

  // get the employees from the database
  const [employees, setEmployees] = useState<User[]>([]);
  useEffect(() => {
    async function getEmployees(): Promise<void> {
      if (!appClient) {
        return;
      }
      setLoading(true);
      const allEmployees = (await appClient.getAllUsers()).filter((employee) => !employee.name.startsWith('+'));
      setEmployees(allEmployees);
      setLoading(false);
    }
    getEmployees().catch((error) => console.log(error));
  }, [appClient]);

  // Filter the employees based on the search text
  const filteredEmployees = React.useMemo(
    () =>
      employees.filter((employee: User) =>
        (employee.name ? employee.name : '').toLowerCase().includes(searchText.toLowerCase()),
      ),
    [employees, searchText],
  );

  // For pagination, only include the rows that are on the current page
  const pageEmployees = React.useMemo(
    () =>
      filteredEmployees.slice(
        pageNumber * rowsPerPage, // skip over the rows from previous pages
        (pageNumber + 1) * rowsPerPage, // only show the rows from the current page
      ),
    [pageNumber, filteredEmployees, rowsPerPage],
  );

  // Handle pagination
  const handleChangePage = (event: unknown, newPageNumber: number): void => {
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
    <PageContainer>
      <Paper sx={{ padding: 2 }}>
        {/* Employees */}
        <TableContainer>
          <Grid container direction="row" justifyContent="space-between" alignItems="center">
            {/* Locations Search Box */}
            <Box sx={{ display: 'contents' }}>
              <Box>
                <TextField
                  id="outlined-basic"
                  label="Search employees"
                  variant="outlined"
                  onChange={handleChangeSearchText}
                  InputProps={{ endAdornment: <SearchIcon /> }}
                  sx={{ marginBottom: 2 }}
                  margin="dense"
                />
              </Box>
            </Box>
            {loading && <Loading />}
          </Grid>

          {/* Employees Table */}
          <Table sx={{ minWidth: 650 }} aria-label="locationsTable">
            {/* Label Row */}
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Username</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="left">
                  Email
                </TableCell>
                {/* <TableCell sx={{ fontWeight: 'bold' }} align="left">
                  Status
                </TableCell> */}
              </TableRow>
            </TableHead>
            {/* Actual employee information table */}
            <TableBody>
              {pageEmployees.map((employee) => {
                // const isActive = checkUserIsActive(employee);
                return (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <Link
                        to={`/employee/${employee.id}`}
                        style={{
                          display: 'contents',
                          color: theme.palette.primary.main,
                        }}
                      >
                        {employee.name ? employee.name : ''}
                      </Link>
                    </TableCell>
                    <TableCell
                      align="left"
                      sx={{
                        color: otherColors.tableRow,
                      }}
                    >
                      {employee.email ? employee.email : ''}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Table Pagination */}
          <TablePagination
            rowsPerPageOptions={[1, 5, 10, 25]}
            component="div"
            count={filteredEmployees.length}
            rowsPerPage={rowsPerPage}
            page={pageNumber}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      </Paper>
    </PageContainer>
  );
}
