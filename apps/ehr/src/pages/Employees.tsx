import { otherColors } from '@ehrTheme/colors';
import { Add } from '@mui/icons-material';
import SearchIcon from '@mui/icons-material/Search';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { default as React, ReactElement, useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminHeaderActionSlot } from 'src/features/admin/AdminPageHeader';
import { useSuccessQuery } from 'utils/lib/frontend';
import { State } from 'utils/lib/helpers/states';
import {
  EmployeeDetails,
  GetEmployeesResponse,
  isCustomerSupport,
} from 'utils/lib/types/api/get-employees/get-employees.types';
import { AVAILABLE_EMPLOYEE_ROLES, RoleType } from 'utils/lib/types/api/user.types';
import { AllStates } from 'utils/lib/types/common';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
import { getEmployees } from '../api/api';
import Loading from '../components/Loading';
import { EMPLOYEE_ROWS_PER_PAGE } from '../constants';
import { dataTestIds } from '../constants/data-test-ids';
import { useApiClients } from '../hooks/useAppClients';
import useEvolveUser, { EvolveUser } from '../hooks/useEvolveUser';

/**
 * Roles checked when the page is opened with no role filter in the URL.
 *
 * Customer Support is not a practice role — it's the internal support account used to configure a
 * customer's instance — so it is left out here and, more importantly, out of the no-selection case
 * in {@link matchesRoleFilter}. Selecting no roles means "no role filter", not "no results", and it
 * still doesn't surface support accounts; only ticking Customer Support explicitly does that.
 */
export const DEFAULT_ROLE_FILTER: RoleType[] = AVAILABLE_EMPLOYEE_ROLES.map(({ value }) => value).filter(
  (role) => role !== RoleType.CustomerSupport
);

/**
 * Whether an employee survives the Role filter.
 *
 * Users awaiting review hold no role yet, so a role filter would hide exactly the rows an admin most
 * needs to act on — they stay visible regardless of the selection.
 */
const matchesRoleFilter = (employee: EmployeeDetails, selectedRoles: RoleType[]): boolean => {
  if (employee.needsReview) return true;
  // No selection is an absent filter rather than an impossible one, so it reads as "everyone" — bar
  // support accounts, which stay hidden until asked for by name.
  if (selectedRoles.length === 0) return !isCustomerSupport(employee);
  return employee.roles.some((role) => selectedRoles.includes(role));
};

/** Roles whose members carry state licenses, and so make the State filter meaningful. */
const STATE_LICENSED_ROLES: RoleType[] = [RoleType.Provider, RoleType.Clinician];

/**
 * Filters live in the URL so a filtered list can be shared, and so returning from an employee's
 * record (which unmounts this page) restores what you were looking at. Pagination deliberately
 * stays in component state — page number is noise in a shared link and rows-per-page is a personal
 * preference rather than a description of the view.
 */
export interface EmployeesFilters {
  searchText: string;
  lastLoginFilterChecked: boolean;
  selectedRoles: RoleType[];
  selectedState: State | null;
}

const getFiltersFromUrl = (searchParams: URLSearchParams): EmployeesFilters => {
  const stateValue = searchParams.get('state');
  return {
    searchText: searchParams.get('name') ?? '',
    lastLoginFilterChecked: searchParams.get('hideStaleLogins') === 'true',
    // An absent param means "unset", so fall back to the default. An empty one means the user
    // deliberately cleared every role, which must not silently re-tick them all in the picker —
    // `matchesRoleFilter` is what makes the two behave alike for filtering purposes.
    selectedRoles: searchParams.has('roles')
      ? (searchParams.get('roles')!.split(',').filter(Boolean) as RoleType[])
      : DEFAULT_ROLE_FILTER,
    selectedState: stateValue ? AllStates.find((state) => state.value === stateValue) ?? null : null,
  };
};

const writeFiltersToUrl = (params: URLSearchParams, filters: EmployeesFilters): URLSearchParams => {
  const next = new URLSearchParams(params);
  const setOrDelete = (key: string, value: string | undefined): void => {
    if (value === undefined) next.delete(key);
    else next.set(key, value);
  };

  setOrDelete('name', filters.searchText || undefined);
  setOrDelete('hideStaleLogins', filters.lastLoginFilterChecked ? 'true' : undefined);
  setOrDelete('state', filters.selectedState?.value || undefined);
  setOrDelete(
    'roles',
    sameRoles(filters.selectedRoles, DEFAULT_ROLE_FILTER) ? undefined : filters.selectedRoles.join(',')
  );

  return next;
};

const sameRoles = (a: RoleType[], b: RoleType[]): boolean =>
  a.length === b.length && a.every((role) => b.includes(role));

export default function EmployeesPage(): ReactElement {
  const { oystehrZambda } = useApiClients();
  const currentUser = useEvolveUser();
  const [employees, setEmployees] = useState<EmployeeDetails[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();

  const [pageNumber, setPageNumber] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(EMPLOYEE_ROWS_PER_PAGE);

  const filters = useMemo(() => getFiltersFromUrl(searchParams), [searchParams]);

  const handleFiltersChange = useCallback(
    (changed: Partial<EmployeesFilters>) => {
      // Any filter change invalidates the current page — page 3 of the old result set is rarely
      // page 3 of the new one.
      setPageNumber(0);
      setSearchParams((prev) => writeFiltersToUrl(prev, { ...getFiltersFromUrl(prev), ...changed }), {
        replace: true,
      });
    },
    [setSearchParams]
  );

  const emptyEmployeeList: EmployeeDetails[] = [];

  const queryResult = useQuery({
    queryKey: ['get-employees'],
    queryFn: () => (oystehrZambda ? getEmployees(oystehrZambda) : Promise.resolve(null)),

    enabled: !!oystehrZambda,
  });

  useSuccessQuery(queryResult.data, (data: GetEmployeesResponse | null) => {
    setEmployees(data?.employees ?? emptyEmployeeList);
  });

  const { isFetching } = queryResult;

  return (
    <Box sx={{ width: '100%', marginTop: 2 }}>
      {isFetching && <Loading />}
      <EmployeesTable
        employees={employees}
        currentUser={currentUser}
        filters={filters}
        pageNumber={pageNumber}
        rowsPerPage={rowsPerPage}
        onFiltersChange={handleFiltersChange}
        onPageNumberChange={setPageNumber}
        onRowsPerPageChange={(rows) => {
          setRowsPerPage(rows);
          setPageNumber(0);
        }}
      />
    </Box>
  );
}

interface EmployeesTableProps {
  employees: EmployeeDetails[];
  currentUser: EvolveUser | undefined;
  filters: EmployeesFilters;
  pageNumber: number;
  rowsPerPage: number;
  onFiltersChange: (changed: Partial<EmployeesFilters>) => void;
  onPageNumberChange: (pageNumber: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
}

function EmployeesTable({
  employees,
  currentUser,
  filters,
  pageNumber,
  rowsPerPage,
  onFiltersChange,
  onPageNumberChange,
  onRowsPerPageChange,
}: EmployeesTableProps): ReactElement {
  const theme = useTheme();
  const canEditRoles = currentUser?.hasRole([RoleType.Administrator, RoleType.CustomerSupport]) ?? false;
  const { searchText, lastLoginFilterChecked, selectedRoles, selectedState } = filters;

  // The State filter only means something for roles that carry state licenses, so it appears with
  // them and is ignored when they're deselected.
  const showStateFilter = selectedRoles.some((role) => STATE_LICENSED_ROLES.includes(role));

  const filteredEmployees: EmployeeDetails[] = useMemo(() => {
    const filtered = employees.filter((employee: EmployeeDetails) => {
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

      const roleFilter = matchesRoleFilter(employee, selectedRoles);

      const stateFilter =
        showStateFilter && selectedState && selectedState.value !== ''
          ? employee.licenses.some((license) => license.state === selectedState.value)
          : true;

      return name.toLowerCase().includes(searchText.toLowerCase()) && roleFilter && stateFilter && lastLoginFilter;
    });

    // Surface pending-review users at the top while preserving existing order otherwise.
    return filtered
      .map((employee, index) => ({ employee, index }))
      .sort((a, b) => {
        const aReview = a.employee.needsReview ? 0 : 1;
        const bReview = b.employee.needsReview ? 0 : 1;
        if (aReview !== bReview) return aReview - bReview;
        return a.index - b.index;
      })
      .map(({ employee }) => employee);
  }, [employees, searchText, selectedRoles, selectedState, showStateFilter, lastLoginFilterChecked]);

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
      onPageNumberChange(newPageNumber);
    },
    [onPageNumberChange]
  );

  // Handle changing the number of rows per page
  const handleChangeRowsPerPage = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      onRowsPerPageChange(parseInt(event.target.value));
    },
    [onRowsPerPageChange]
  );

  // Handle changing the search text
  const handleChangeSearchText = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>): void => {
      onFiltersChange({ searchText: event.target.value });
    },
    [onFiltersChange]
  );

  const handleChangeRoleFilter = useCallback(
    (value: string | string[]): void => {
      onFiltersChange({ selectedRoles: (typeof value === 'string' ? value.split(',') : value) as RoleType[] });
    },
    [onFiltersChange]
  );

  const handleChangeStateSelect = useCallback(
    (_event: any, value: State | null): void => {
      onFiltersChange({ selectedState: value });
    },
    [onFiltersChange]
  );

  const handleChangeLastLoginFilter = useCallback(
    (_event: any, value: boolean): void => {
      onFiltersChange({ lastLoginFilterChecked: value });
    },
    [onFiltersChange]
  );

  return (
    <>
      <AdminHeaderActionSlot>
        {canEditRoles ? (
          <Link to={`/admin/employees/add`}>
            <Button variant="contained" startIcon={<Add />}>
              New Employee
            </Button>
          </Link>
        ) : (
          <Tooltip title="You must be an administrator to add new users" placement="top">
            <span>
              {/* https://mui.com/material-ui/react-tooltip/#disabled-elements */}
              <Button variant="contained" startIcon={<Add />} disabled>
                New Employee
              </Button>
            </span>
          </Tooltip>
        )}
      </AdminHeaderActionSlot>
      <TableContainer>
        {/* Every column is a fixed width, so ticking Provider or Clinician — which is what shows and
            hides the State filter — never resizes or repositions the controls around it. */}
        <Grid container direction="row" justifyContent="start" alignItems="center" spacing={2} sx={{ my: 1 }}>
          {/* Employee Name Search Box */}
          <Grid item xs={12} md={3}>
            <TextField
              id="outlined-basic"
              label="Name"
              placeholder="Last, First, Middle"
              variant="outlined"
              onChange={handleChangeSearchText}
              value={searchText}
              data-testid={dataTestIds.employeesPage.searchByName}
              InputProps={{ endAdornment: <SearchIcon /> }}
              sx={{ width: '100%' }}
            />
          </Grid>
          {/* Role multi-select */}
          <Grid item xs={12} md={3}>
            <RoleSelect selectedRoles={selectedRoles} onChange={handleChangeRoleFilter} />
          </Grid>
          {/* States drop-down. The slot is held open when empty so the checkbox beside it stays put;
              on narrow screens it collapses instead, where an empty row would just be a gap. */}
          <Grid item xs={12} md={3} sx={showStateFilter ? undefined : { display: { xs: 'none', md: 'block' } }}>
            {showStateFilter && <StateSelect onChange={handleChangeStateSelect} selectedState={selectedState} />}
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControlLabel
              name="last_login_filter"
              control={<Checkbox checked={lastLoginFilterChecked} onChange={handleChangeLastLoginFilter} />}
              label="Hide last logins more than 90 days ago"
              sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}
            />
          </Grid>
        </Grid>

        {/* Employees Table */}
        <Table sx={{ minWidth: 650 }} aria-label="locationsTable" data-testid={dataTestIds.employeesPage.table}>
          <TableHead>
            <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold', textAlign: 'left' } }}>
              <TableCell sx={{ width: '25%' }}>Name (Last, First)</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Last Login</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {pageEmployees.map((employee) => {
              const name = (function () {
                if (employee.firstName && employee.lastName) return [employee.lastName, employee.firstName].join(', ');
                else if (employee.name) return employee.name;
                else return '-';
              })();

              return (
                <TableRow
                  key={employee.id}
                  data-testid={dataTestIds.employeesPage.employeeRow(employee.id)}
                  sx={{
                    '& .MuiTableCell-body': { textAlign: 'left' },
                    // Pending users are resolved on their own record page like anyone else, so the row
                    // only has to say "look here" — an accent bar does that without a column of
                    // buttons that sits empty for every other row.
                    ...(employee.needsReview && {
                      '& .MuiTableCell-body:first-of-type': {
                        borderLeft: '3px solid',
                        borderLeftColor: otherColors.orange800,
                      },
                    }),
                  }}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Link
                        to={`/admin/employee/${employee.id}`}
                        style={{
                          color: theme.palette.primary.main,
                        }}
                      >
                        {name}
                      </Link>
                      {employee.needsReview && (
                        <Chip
                          label="NEEDS REVIEW"
                          data-testid={dataTestIds.employeesPage.needsReviewChip}
                          sx={{
                            backgroundColor: otherColors.orange100,
                            color: otherColors.orange800,
                            borderRadius: '4px',
                            height: '18px',
                            '& .MuiChip-label': {
                              padding: '0 8px',
                              lineHeight: '18px',
                            },
                            ...theme.typography.subtitle2,
                          }}
                        />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell
                    sx={{
                      color: otherColors.tableRow,
                    }}
                    data-testid={dataTestIds.employeesPage.roleCell}
                  >
                    {formatRoles(employee.roles)}
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
                      maxWidth: '220px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {employee.email ? (
                      <Tooltip title={employee.email} placement="top">
                        <span>{employee.email}</span>
                      </Tooltip>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell
                    sx={{
                      color: otherColors.tableRow,
                    }}
                  >
                    {employee.lastLogin ? formatDateForDisplay(employee.lastLogin) : 'Never'}
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
                        height: '18px',
                        '& .MuiChip-label': {
                          padding: '0 8px',
                          lineHeight: '18px',
                        },
                        ...theme.typography.subtitle2,
                      }}
                    />
                  </TableCell>
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
      data-testid={dataTestIds.employeesPage.stateFilter}
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

/** Display label for a role, falling back to the raw value for roles not offered in the picker. */
const roleLabel = (role: RoleType): string =>
  AVAILABLE_EMPLOYEE_ROLES.find((entry) => entry.value === role)?.label ?? role;

/**
 * Users can hold several roles, so show all of them rather than an arbitrary first. Users awaiting
 * review hold none yet — the NEEDS REVIEW chip in the name column already says so, so a dash here
 * keeps the row from reading as though something failed to load.
 */
const formatRoles = (roles: RoleType[]): string => (roles.length > 0 ? roles.map(roleLabel).join(', ') : '-');

interface RoleSelectProps {
  selectedRoles: RoleType[];
  onChange: (value: string | string[]) => void;
}

function RoleSelect({ selectedRoles, onChange }: RoleSelectProps): ReactElement {
  // Customer Support is the internal support account used to configure a customer's instance, not
  // one of their practice roles, so it isn't offered here. It remains reachable by asking for it
  // deliberately (`?roles=Customer Support`); when it is selected the option is rendered so the
  // picker can still display and untick a value it holds.
  const options = AVAILABLE_EMPLOYEE_ROLES.filter(
    (role) => role.value !== RoleType.CustomerSupport || selectedRoles.includes(RoleType.CustomerSupport)
  );

  return (
    <FormControl fullWidth>
      <InputLabel id="employees-role-filter-label">Role</InputLabel>
      <Select
        labelId="employees-role-filter-label"
        label="Role"
        multiple
        value={selectedRoles}
        inputProps={{ 'data-testid': dataTestIds.employeesPage.roleFilter }}
        onChange={(event) => onChange(event.target.value)}
        renderValue={(selected) => (selected as RoleType[]).map(roleLabel).join(', ')}
      >
        {options.map((role) => (
          <MenuItem key={role.value} value={role.value}>
            <Checkbox checked={selectedRoles.includes(role.value)} />
            <ListItemText primary={role.label} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
