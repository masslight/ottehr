import SearchIcon from '@mui/icons-material/Search';
import { TabContext as MuiTabContext, TabList as MuiTabList, TabPanel as MuiTabPanel } from '@mui/lab';
import {
  Autocomplete as MuiAutocomplete,
  Box as MuiBox,
  Button as MuiButton,
  Checkbox as MuiCheckbox,
  Chip as MuiChip,
  FormControlLabel as MuiFormControlLabel,
  Grid as MuiGrid,
  Paper as MuiPaper,
  Tab as MuiTab,
  Table as MuiTable,
  TableBody as MuiTableBody,
  TableCell as MuiTableCell,
  TableContainer as MuiTableContainer,
  TableHead as MuiTableHead,
  TablePagination as MuiTablePagination,
  TableRow as MuiTableRow,
  Tabs as MuiTabs,
  TextField as MuiTextField,
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
import PatientSearch from '@/components/PatientSearch';
import PatientsTable from '@/components/PatientsTable';
import PhoneSearch from '@/components/PhoneSearch';
import { PatientTable } from '@/shadcn/components/PatientsTable';
import { TabsDemo } from '@/shadcn/components/Tabs';
import { Download, PlusIcon } from 'lucide-react';
import { TabsList, TabsTrigger, TabsContent, Tabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import EmployeesTable from '@/shadcn/components/EmployeesTable';
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
    },
  );

  /* TODO: Create own recyclable page container component */
  return (
    <>
      <div className="flex flex-col max-w-7xl mx-auto my-16 px-4">
        <div className="space-y-8">
          {/* Heading */}
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">Employees</h1>
              <p className="text-md text-muted-foreground">View and manage doctors and providers</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="bg-white">
                <Download className="w-4 h-4" /> Export
              </Button>
              <Link to="/employees/add">
                <Button className="flex items-center bg-teal-500 hover:bg-teal-600 font-bold">
                  <PlusIcon className="w-4 h-4" />
                  Add Employee
                </Button>
              </Link>
            </div>
          </div>
          <Tabs defaultValue="employees" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="employees" className="flex justify-center text-center">
                Employees
              </TabsTrigger>
              <TabsTrigger value="providers" className="flex justify-center text-center">
                Providers
              </TabsTrigger>
            </TabsList>
            <TabsContent value="employees" className="my-8">
              <EmployeesTable employees={employees} />
            </TabsContent>
            <TabsContent value="providers" className="my-8"></TabsContent>
          </Tabs>
          {/* <PatientTable
              fhirPatients={patients}
              relatedPersons={relatedPersons}
              total={totalPatients}
              patientsLoading={loading}
            /> */}
          <div className="py-36">
            <h1 className="text-2xl font-bold">Other Employees</h1>
            <MuiBox sx={{ width: '100%', marginTop: 3 }}>
              <MuiTabContext value={pageTab}>
                <MuiBox sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <MuiTabList onChange={handleTabChange} aria-label="employees tabs">
                    <MuiTab
                      label="Employees"
                      value={PageTab.employees}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    />
                    {isLocalOrDevOrTestingOrTrainingEnv && (
                      <MuiTab
                        label="Providers"
                        value={PageTab.providers}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      />
                    )}
                    {isFetching && <Loading />}
                  </MuiTabList>
                </MuiBox>
                <MuiPaper sx={{ marginTop: 5 }}>
                  <MuiTabPanel value={pageTab} sx={{ padding: 0 }}>
                    <MuiEmployeesTable employees={employees} isProviderLayout={pageTab === PageTab.providers} />
                  </MuiTabPanel>
                </MuiPaper>
              </MuiTabContext>
            </MuiBox>
          </div>
        </div>
      </div>
    </>
  );
}

interface EmployeesTableProps {
  employees: EmployeeDetails[];
  isProviderLayout: boolean;
}
function MuiEmployeesTable({ employees, isProviderLayout }: EmployeesTableProps): ReactElement {
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
    [employees, searchText, isProviderLayout, selectedState, lastLoginFilterChecked],
  );

  // For pagination, only include the rows that are on the current page
  const pageEmployees: EmployeeDetails[] = React.useMemo(
    () =>
      filteredEmployees.slice(
        pageNumber * rowsPerPage, // skip over the rows from previous pages
        (pageNumber + 1) * rowsPerPage, // only show the rows from the current page
      ),
    [filteredEmployees, pageNumber, rowsPerPage],
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
      <MuiPaper sx={{ padding: 2 }}>
        <MuiTableContainer>
          <MuiGrid container direction="row" justifyContent="start" alignItems="center">
            {/* Employee Name Search Box */}
            <MuiBox sx={{ display: 'flex', flex: 2, margin: '10px 0' }}>
              <MuiTextField
                id="outlined-basic"
                label="Search by name"
                variant="outlined"
                onChange={handleChangeSearchText}
                InputProps={{ endAdornment: <SearchIcon /> }}
                sx={{ width: '100%', paddingRight: 2 }}
              />
            </MuiBox>
            {/* States drop-down */}
            {isProviderLayout && (
              <MuiBox sx={{ display: 'flex', flex: 2, paddingRight: 3 }}>
                <StateSelect onChange={handleChangeStateSelect} />
              </MuiBox>
            )}
            <MuiBox sx={{ display: 'flex', flex: 1, maxWidth: '260px' }}>
              <MuiFormControlLabel
                value={true}
                name="last_login_filter"
                checked={lastLoginFilterChecked}
                onChange={handleChangeLastLoginFilter}
                control={<MuiCheckbox />}
                label="Hide last logins that occurred more than 90 days ago"
                sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}
              />
            </MuiBox>
          </MuiGrid>

          {/* Employees Table */}
          <MuiTable sx={{ minWidth: 650 }} aria-label="locationsTable">
            <MuiTableHead>
              <MuiTableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold', textAlign: 'left' } }}>
                <MuiTableCell sx={{ width: '25%' }}>Name (Last, First)</MuiTableCell>
                <MuiTableCell>Phone</MuiTableCell>
                <MuiTableCell>Email</MuiTableCell>
                <MuiTableCell>Last Login</MuiTableCell>
                <MuiTableCell>Status</MuiTableCell>
                {isProviderLayout && <MuiTableCell sx={{ width: '15%' }}>Seen patient last 30 mins</MuiTableCell>}
              </MuiTableRow>
            </MuiTableHead>

            <MuiTableBody>
              {pageEmployees.map((employee) => {
                const name = (function () {
                  if (employee.firstName && employee.lastName)
                    return [employee.lastName, employee.firstName].join(', ');
                  else if (employee.name) return employee.name;
                  else return '-';
                })();

                return (
                  <MuiTableRow key={employee.id} sx={{ '& .MuiTableCell-body': { textAlign: 'left' } }}>
                    <MuiTableCell>
                      <Link
                        to={`/employee/${employee.id}`}
                        style={{
                          display: 'contents',
                          color: theme.palette.primary.main,
                        }}
                      >
                        {name}
                      </Link>
                    </MuiTableCell>
                    <MuiTableCell
                      sx={{
                        color: otherColors.tableRow,
                      }}
                    >
                      {employee.phoneNumber ? employee.phoneNumber : '-'}
                    </MuiTableCell>
                    <MuiTableCell
                      sx={{
                        color: otherColors.tableRow,
                      }}
                    >
                      {employee.email ? employee.email : '-'}
                    </MuiTableCell>
                    <MuiTableCell
                      sx={{
                        color: otherColors.tableRow,
                      }}
                    >
                      {employee.lastLogin ? formatDateUsingSlashes(employee.lastLogin) : 'Never'}
                    </MuiTableCell>
                    <MuiTableCell>
                      <MuiChip
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
                    </MuiTableCell>
                    {isProviderLayout && (
                      <MuiTableCell
                        sx={{
                          color: otherColors.tableRow,
                        }}
                      >
                        {employee.seenPatientRecently && (
                          <MuiChip
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
                      </MuiTableCell>
                    )}
                  </MuiTableRow>
                );
              })}
            </MuiTableBody>
          </MuiTable>

          <MuiTablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filteredEmployees.length}
            rowsPerPage={rowsPerPage}
            page={pageNumber}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </MuiTableContainer>
      </MuiPaper>
    </>
  );
}

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
    <MuiAutocomplete
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
      renderInput={(params) => <MuiTextField name="state" {...params} label="State" />}
    />
  );
}
