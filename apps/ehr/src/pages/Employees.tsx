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
import { default as React, ReactElement, useCallback, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { AllStates, EmployeeDetails, State } from 'utils';
import { otherColors } from '../CustomThemeProvider';
import { getEmployees } from '../api/api';
import Loading from '../components/Loading';
import { EMPLOYEE_ROWS_PER_PAGE, PROVIDER_ROWS_PER_PAGE } from '../constants';
import { dataTestIds } from '../constants/data-test-ids';
import { formatDateUsingSlashes } from '../helpers/formatDateTime';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

enum PageTab {
  employees = 'employees',
  providers = 'providers',
}

export default function EmployeesPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [pageTab, setPageTab] = useState<PageTab>(PageTab.employees);
  const [employees, setEmployees] = useState<EmployeeDetails[]>([]);

  const [pageStates, setPageStates] = useState<{
    [key in PageTab]: {
      pageNumber: number;
      rowsPerPage: number;
      searchText: string;
      lastLoginFilterChecked: boolean;
      selectedState?: State | null;
    };
  }>({
    [PageTab.employees]: {
      pageNumber: 0,
      rowsPerPage: EMPLOYEE_ROWS_PER_PAGE,
      searchText: '',
      lastLoginFilterChecked: false,
    },
    [PageTab.providers]: {
      pageNumber: 0,
      rowsPerPage: PROVIDER_ROWS_PER_PAGE,
      searchText: '',
      lastLoginFilterChecked: false,
      selectedState: null,
    },
  });

  const handleTabChange = useCallback((_: any, newValue: PageTab) => {
    setPageTab(newValue);
  }, []);

  const handlePageStateChange = useCallback(
    (tab: PageTab, newPageState: Partial<(typeof pageStates)[PageTab.providers]>) => {
      setPageStates((prev) => ({
        ...prev,
        [tab]: {
          ...prev[tab],
          ...newPageState,
        },
      }));
    },
    []
  );

  const { isFetching } = useQuery(
    ['get-employees', { oystehrZambda }],
    () => (oystehrZambda ? getEmployees(oystehrZambda) : null),
    {
      onSuccess: (response) => {
        setEmployees(response?.employees ?? []);
      },
      enabled: !!oystehrZambda,
    }
  );

  return (
    <PageContainer>
      <Box sx={{ width: '100%', marginTop: 3 }}>
        <TabContext value={pageTab}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <TabList onChange={handleTabChange} aria-label="employees tabs">
              <Tab label="Employees" value={PageTab.employees} sx={{ textTransform: 'none', fontWeight: 700 }} />
              <Tab
                label="Providers"
                value={PageTab.providers}
                sx={{ textTransform: 'none', fontWeight: 700 }}
                data-testid={dataTestIds.employeesPage.providersTabButton}
              />
              {isFetching && <Loading />}
            </TabList>
          </Box>
          <Paper sx={{ marginTop: 5 }}>
            <TabPanel value={pageTab} sx={{ padding: 0 }}>
              <EmployeesTable
                employees={employees}
                currentTab={pageTab}
                pageNumber={pageStates[pageTab].pageNumber}
                rowsPerPage={pageStates[pageTab].rowsPerPage}
                searchText={pageStates[pageTab].searchText}
                lastLoginFilterChecked={pageStates[pageTab].lastLoginFilterChecked}
                selectedState={pageStates[pageTab].selectedState}
                onPageStateChange={(newPageState) => handlePageStateChange(pageTab, newPageState)}
              />
            </TabPanel>
          </Paper>
        </TabContext>
      </Box>
    </PageContainer>
  );
}

interface EmployeesTableProps {
  employees: EmployeeDetails[];
  currentTab: PageTab;
  pageNumber: number;
  rowsPerPage: number;
  searchText: string;
  lastLoginFilterChecked: boolean;
  selectedState?: State | null;
  onPageStateChange: (newPageState: {
    pageNumber?: number;
    rowsPerPage?: number;
    searchText?: string;
    lastLoginFilterChecked?: boolean;
    selectedState?: State | null;
  }) => void;
}

function EmployeesTable({
  employees,
  currentTab,
  pageNumber,
  rowsPerPage,
  searchText,
  lastLoginFilterChecked,
  selectedState,
  onPageStateChange,
}: EmployeesTableProps): ReactElement {
  const theme = useTheme();

  // Filter the employees based on the search text
  const filteredEmployees: EmployeeDetails[] = useMemo(
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
          (currentTab === PageTab.providers ? employee.isProvider : true) &&
          (currentTab === PageTab.providers && selectedState && selectedState.value !== ''
            ? employee.licenses.some((license) => license.state === selectedState.value)
            : true) &&
          lastLoginFilter
        );
      }),
    [employees, searchText, currentTab, selectedState, lastLoginFilterChecked]
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
  const handleChangePage = useCallback(
    (event: unknown, newPageNumber: number): void => {
      onPageStateChange({ pageNumber: newPageNumber });
    },
    [onPageStateChange]
  );

  // Handle changing the number of rows per page
  const handleChangeRowsPerPage = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      onPageStateChange({ rowsPerPage: parseInt(event.target.value), pageNumber: 0 });
    },
    [onPageStateChange]
  );

  // Handle changing the search text
  const handleChangeSearchText = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>): void => {
      onPageStateChange({ searchText: event.target.value, pageNumber: 0 });
    },
    [onPageStateChange]
  );

  const handleChangeStateSelect = useCallback(
    (_event: any, value: State | null): void => {
      onPageStateChange({ selectedState: value });
    },
    [onPageStateChange]
  );

  const handleChangeLastLoginFilter = useCallback(
    (_event: any, value: boolean): void => {
      onPageStateChange({ lastLoginFilterChecked: value, pageNumber: 0 });
    },
    [onPageStateChange]
  );

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
                value={searchText}
                data-testid={dataTestIds.employeesPage.searchByName}
                InputProps={{ endAdornment: <SearchIcon /> }}
                sx={{ width: '100%', paddingRight: 2 }}
              />
            </Box>
            {/* States drop-down */}
            {currentTab === PageTab.providers && (
              <Box sx={{ display: 'flex', flex: 2, paddingRight: 3 }}>
                <StateSelect onChange={handleChangeStateSelect} selectedState={selectedState} />
              </Box>
            )}
            <Box sx={{ display: 'flex', flex: 1, maxWidth: '260px' }}>
              <FormControlLabel
                name="last_login_filter"
                control={<Checkbox checked={lastLoginFilterChecked} onChange={handleChangeLastLoginFilter} />}
                label="Hide last logins that occurred more than 90 days ago"
                sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}
              />
            </Box>
          </Grid>

          {/* Employees Table */}
          <Table sx={{ minWidth: 650 }} aria-label="locationsTable" data-testid={dataTestIds.employeesPage.table}>
            <TableHead>
              <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold', textAlign: 'left' } }}>
                <TableCell sx={{ width: '25%' }}>Name (Last, First)</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell>Status</TableCell>
                {currentTab === PageTab.providers && (
                  <>
                    <TableCell sx={{ maxWidth: '150px' }}>Getting alerts</TableCell>
                    <TableCell sx={{ maxWidth: '150px' }}>Seen patient last 30 mins</TableCell>
                  </>
                )}
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
                      {employee.phoneNumber || '-'}
                    </TableCell>
                    <TableCell
                      sx={{
                        color: otherColors.tableRow,
                      }}
                    >
                      {employee.email || '-'}
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
                        data-testid={dataTestIds.employeesPage.statusChip}
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
                    {currentTab === PageTab.providers && (
                      <>
                        <TableCell
                          sx={{
                            color: otherColors.tableRow,
                          }}
                        >
                          {employee.gettingAlerts && (
                            <Chip
                              label="GETTING ALERTS"
                              color={'info'}
                              sx={{
                                borderRadius: '4px',
                                bgcolor: 'info.light',
                                color: 'info.dark',
                                height: '17px',
                                '& .MuiChip-label': {
                                  padding: '2px 8px 0px 8px',
                                },
                                ...theme.typography.subtitle2,
                              }}
                            />
                          )}
                        </TableCell>
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
                      </>
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
            data-testid={dataTestIds.pagination.paginationContainer}
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
  onChange: (event: React.SyntheticEvent<Element, Event>, value: State | null) => void;
  selectedState?: State | null;
}

function StateSelect({ onChange, selectedState }: StateSelectProps): ReactElement {
  const EMPTY_STATE = { label: 'All states', value: '' };
  const options = [EMPTY_STATE, ...AllStates];

  return (
    <Autocomplete
      value={selectedState || EMPTY_STATE}
      onChange={onChange}
      data-testid={dataTestIds.employeesPage.providersStateFilter}
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
