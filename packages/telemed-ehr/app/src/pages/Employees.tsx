import SearchIcon from '@mui/icons-material/Search';
import { TabContext, TabList, TabPanel } from '@mui/lab';
import {
  Autocomplete,
  Box,
  Checkbox,
  Chip,
  FormControlLabel,
  Grid,
  Paper,
  Tab,
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
import { DateTime } from 'luxon';
import { default as React, ReactElement, useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { otherColors } from '../CustomThemeProvider';
import { getEmployees } from '../api/api';
import Loading from '../components/Loading';
import { formatDateUsingSlashes } from '../helpers/formatDateTime';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';
import { isLocalOrDevOrTestingOrTrainingEnv } from '../telemed/utils/env.helper';
import { AllStates, EmployeeDetails, State } from '../types/types';

enum PageTab {
  employees = 'employees',
  providers = 'providers',
}

export default function EmployeesPage(): ReactElement {
  const { zambdaClient } = useApiClients();
  const [pageTab, setPageTab] = useState<PageTab>(PageTab.employees);
  const [employees, setEmployees] = useState<EmployeeDetails[]>([]);

  const handleTabChange = (_: any, newValue: PageTab): any => {
    setPageTab(newValue);
  };

  const { isFetching } = useQuery(
    ['get-employees', { zambdaClient }],
    () => (zambdaClient ? getEmployees(zambdaClient) : null),
    {
      onSuccess: (response) => {
        setEmployees(response?.employees ?? []);
      },
      enabled: !!zambdaClient,
    }
  );

  return (
    <PageContainer>
      <Box sx={{ width: '100%', marginTop: 3 }}>
        <TabContext value={pageTab}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <TabList onChange={handleTabChange} aria-label="employees tabs">
              <Tab label="Employees" value={PageTab.employees} sx={{ textTransform: 'none', fontWeight: 700 }} />
              {isLocalOrDevOrTestingOrTrainingEnv && (
                <Tab label="Providers" value={PageTab.providers} sx={{ textTransform: 'none', fontWeight: 700 }} />
              )}
              {isFetching && <Loading />}
            </TabList>
          </Box>
          <Paper sx={{ marginTop: 5 }}>
            <TabPanel value={pageTab} sx={{ padding: 0 }}>
              <EmployeesTable employees={employees} isProviderLayout={pageTab === PageTab.providers} />
            </TabPanel>
          </Paper>
        </TabContext>
      </Box>
    </PageContainer>
  );
}

interface EmployeesTableProps {
  employees: EmployeeDetails[];
  isProviderLayout: boolean;
}
function EmployeesTable({ employees, isProviderLayout }: EmployeesTableProps): ReactElement {
  const theme = useTheme();

  // set up the pagination states
  const [rowsPerPage, setRowsPerPage] = React.useState(5);
  const [pageNumber, setPageNumber] = React.useState(0);
  const [searchText, setSearchText] = React.useState('');
  const [selectedState, setSelectedState] = useState<State>();
  const [lastLoginFilterChecked, setLastLoginFilterChecked] = useState<boolean>(false);

  // Filter the employees based on the search text
  const filteredEmployees: EmployeeDetails[] = React.useMemo(
    () =>
      employees.filter((employee: EmployeeDetails) => {
        const name = (function () {
          if (employee.firstName && employee.lastName) return [employee.lastName, employee.firstName].join(', ');
          else if (employee.name) return employee.name;
          else return '';
        })();

        const lastLoginFilter = (function () {
          if (!lastLoginFilterChecked) return true;
          if (employee.lastLogin) return DateTime.fromISO(employee.lastLogin) > DateTime.now().minus({ days: 90 });
          else return false;
        })();

        return (
          name.toLowerCase().includes(searchText.toLowerCase()) &&
          (isProviderLayout ? employee.isProvider : true) &&
          (selectedState ? employee.licenses.map((license) => license.state).includes(selectedState.value) : true) &&
          lastLoginFilter
        );
      }),
    [employees, searchText, isProviderLayout, selectedState, lastLoginFilterChecked]
  );

  // For pagination, only include the rows that are on the current page
  const pageEmployees: EmployeeDetails[] = React.useMemo(
    () =>
      filteredEmployees.slice(
        pageNumber * rowsPerPage, // skip over the rows from previous pages
        (pageNumber + 1) * rowsPerPage // only show the rows from the current page
      ),
    [filteredEmployees, pageNumber, rowsPerPage]
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

  const handleChangeStateSelect = (_event: any, value: State): void => {
    setSelectedState(value);
  };

  const handleChangeLastLoginFilter = (_event: any, value: boolean): void => {
    setLastLoginFilterChecked(value);
  };

  return (
    <>
      <Paper sx={{ padding: 2 }}>
        <TableContainer>
          <Grid container direction="row" justifyContent="start" alignItems="center">
            {/* Employee Name Search Box */}
            <Box sx={{ display: 'flex', flex: 2, margin: '10px 0' }}>
              <TextField
                id="outlined-basic"
                label="Search by name"
                variant="outlined"
                onChange={handleChangeSearchText}
                InputProps={{ endAdornment: <SearchIcon /> }}
                sx={{ width: '100%', paddingRight: 2 }}
              />
            </Box>
            {/* States drop-down */}
            {isProviderLayout && (
              <Box sx={{ display: 'flex', flex: 2, paddingRight: 3 }}>
                <StateSelect onChange={handleChangeStateSelect} />
              </Box>
            )}
            <Box sx={{ display: 'flex', flex: 1, maxWidth: '260px' }}>
              <FormControlLabel
                value={true}
                name="last_login_filter"
                checked={lastLoginFilterChecked}
                onChange={handleChangeLastLoginFilter}
                control={<Checkbox />}
                label="Hide last logins that occurred more than 90 days ago"
                sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}
              />
            </Box>
          </Grid>

          {/* Employees Table */}
          <Table sx={{ minWidth: 650 }} aria-label="locationsTable">
            <TableHead>
              <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold', textAlign: 'left' } }}>
                <TableCell sx={{ width: '25%' }}>Name (Last, First)</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell>Status</TableCell>
                {isProviderLayout && <TableCell sx={{ width: '15%' }}>Seen patient last 30 mins</TableCell>}
              </TableRow>
            </TableHead>

            <TableBody>
              {pageEmployees.map((employee) => {
                const name = (function () {
                  if (employee.firstName && employee.lastName)
                    return [employee.lastName, employee.firstName].join(', ');
                  else if (employee.name) return employee.name;
                  else return '-';
                })();

                return (
                  <TableRow key={employee.id} sx={{ '& .MuiTableCell-body': { textAlign: 'left' } }}>
                    <TableCell>
                      <Link
                        to={`/employee/${employee.id}`}
                        style={{
                          display: 'contents',
                          color: theme.palette.primary.main,
                        }}
                      >
                        {name}
                      </Link>
                    </TableCell>
                    <TableCell
                      sx={{
                        color: otherColors.tableRow,
                      }}
                    >
                      {employee.phoneNumber ? employee.phoneNumber : '-'}
                    </TableCell>
                    <TableCell
                      sx={{
                        color: otherColors.tableRow,
                      }}
                    >
                      {employee.email ? employee.email : '-'}
                    </TableCell>
                    <TableCell
                      sx={{
                        color: otherColors.tableRow,
                      }}
                    >
                      {employee.lastLogin ? formatDateUsingSlashes(employee.lastLogin) : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={employee.status.toUpperCase()}
                        sx={{
                          backgroundColor:
                            employee.status === 'Active'
                              ? otherColors.employeeActiveChip
                              : otherColors.employeeDeactivatedChip,
                          color:
                            employee.status === 'Active'
                              ? otherColors.employeeActiveText
                              : otherColors.employeeDeactivatedText,
                          borderRadius: '4px',
                          height: '17px',
                          '& .MuiChip-label': {
                            padding: '2px 8px 0px 8px',
                          },
                          ...theme.typography.subtitle2,
                        }}
                      />
                    </TableCell>
                    {isProviderLayout && (
                      <TableCell
                        sx={{
                          color: otherColors.tableRow,
                        }}
                      >
                        {employee.seenPatientRecently && (
                          <Chip
                            label="BEEN SEEN"
                            sx={{
                              backgroundColor: otherColors.employeeBeenSeenChip,
                              color: otherColors.employeeBeenSeenText,
                              borderRadius: '4px',
                              height: '17px',
                              '& .MuiChip-label': {
                                padding: '2px 8px 0px 8px',
                              },
                              ...theme.typography.subtitle2,
                            }}
                          />
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filteredEmployees.length}
            rowsPerPage={rowsPerPage}
            page={pageNumber}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      </Paper>
    </>
  );
}

/*
 * A general purpose US states select. Might be a good candidate for moving to a
 * separate file.
 */
interface StateSelectProps {
  //onChange: (event: React.SyntheticEvent, value: Value | Array, reason: string, details?: string) => void;
  onChange: (event: any, value: any) => void;
}

function StateSelect({ onChange }: StateSelectProps): ReactElement {
  const [value, setValue] = useState<State | null>();
  const EMPTY_STATE = { label: 'All states', value: '' };
  const options = [EMPTY_STATE, ...AllStates];

  const handleChange = (e: any, selectedValue: State | null): void => {
    setValue(selectedValue);
    onChange(e, selectedValue);
  };

  return (
    <Autocomplete
      value={value ? value : EMPTY_STATE}
      onChange={handleChange}
      getOptionLabel={(state) => state.label || 'Unknown'}
      isOptionEqualToValue={(option, tempValue) => option.value === tempValue.value}
      options={options}
      renderOption={(props, option) => {
        return (
          <li {...props} key={option.value}>
            {option.label}
          </li>
        );
      }}
      fullWidth
      renderInput={(params) => <TextField name="state" {...params} label="State" />}
    />
  );
}
