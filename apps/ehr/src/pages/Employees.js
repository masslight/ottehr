"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = EmployeesPage;
var colors_1 = require("@ehrTheme/colors");
var icons_material_1 = require("@mui/icons-material");
var Search_1 = require("@mui/icons-material/Search");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_query_1 = require("react-query");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var api_1 = require("../api/api");
var Loading_1 = require("../components/Loading");
var constants_1 = require("../constants");
var data_test_ids_1 = require("../constants/data-test-ids");
var formatDateTime_1 = require("../helpers/formatDateTime");
var useAppClients_1 = require("../hooks/useAppClients");
var useEvolveUser_1 = require("../hooks/useEvolveUser");
var PageContainer_1 = require("../layout/PageContainer");
var PageTab;
(function (PageTab) {
    PageTab["employees"] = "employees";
    PageTab["providers"] = "providers";
})(PageTab || (PageTab = {}));
function EmployeesPage() {
    var _a;
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var currentUser = (0, useEvolveUser_1.default)();
    var _b = (0, react_1.useState)(PageTab.employees), pageTab = _b[0], setPageTab = _b[1];
    var _c = (0, react_1.useState)([]), employees = _c[0], setEmployees = _c[1];
    var _d = (0, react_1.useState)((_a = {},
        _a[PageTab.employees] = {
            pageNumber: 0,
            rowsPerPage: constants_1.EMPLOYEE_ROWS_PER_PAGE,
            searchText: '',
            lastLoginFilterChecked: false,
        },
        _a[PageTab.providers] = {
            pageNumber: 0,
            rowsPerPage: constants_1.PROVIDER_ROWS_PER_PAGE,
            searchText: '',
            lastLoginFilterChecked: false,
            selectedState: null,
        },
        _a)), pageStates = _d[0], setPageStates = _d[1];
    var handleTabChange = (0, react_1.useCallback)(function (_, newValue) {
        setPageTab(newValue);
    }, []);
    var handlePageStateChange = (0, react_1.useCallback)(function (tab, newPageState) {
        setPageStates(function (prev) {
            var _a;
            return (__assign(__assign({}, prev), (_a = {}, _a[tab] = __assign(__assign({}, prev[tab]), newPageState), _a)));
        });
    }, []);
    var isFetching = (0, react_query_1.useQuery)(['get-employees', { oystehrZambda: oystehrZambda }], function () { return (oystehrZambda ? (0, api_1.getEmployees)(oystehrZambda) : null); }, {
        onSuccess: function (response) {
            var _a;
            setEmployees((_a = response === null || response === void 0 ? void 0 : response.employees) !== null && _a !== void 0 ? _a : []);
        },
        enabled: !!oystehrZambda,
    }).isFetching;
    return (<PageContainer_1.default>
      <material_1.Box sx={{ width: '100%', marginTop: 3 }}>
        <lab_1.TabContext value={pageTab}>
          <material_1.Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <lab_1.TabList onChange={handleTabChange} aria-label="employees tabs">
              <material_1.Tab label="Employees" value={PageTab.employees} sx={{ textTransform: 'none', fontWeight: 500 }}/>
              <material_1.Tab label="Providers" value={PageTab.providers} sx={{ textTransform: 'none', fontWeight: 500 }} data-testid={data_test_ids_1.dataTestIds.employeesPage.providersTabButton}/>
              {isFetching && <Loading_1.default />}
            </lab_1.TabList>
          </material_1.Box>
          <material_1.Paper sx={{ marginTop: 5 }}>
            <lab_1.TabPanel value={pageTab} sx={{ padding: 0 }}>
              <EmployeesTable employees={employees} currentUser={currentUser} currentTab={pageTab} pageNumber={pageStates[pageTab].pageNumber} rowsPerPage={pageStates[pageTab].rowsPerPage} searchText={pageStates[pageTab].searchText} lastLoginFilterChecked={pageStates[pageTab].lastLoginFilterChecked} selectedState={pageStates[pageTab].selectedState} onPageStateChange={function (newPageState) { return handlePageStateChange(pageTab, newPageState); }}/>
            </lab_1.TabPanel>
          </material_1.Paper>
        </lab_1.TabContext>
      </material_1.Box>
    </PageContainer_1.default>);
}
function EmployeesTable(_a) {
    var employees = _a.employees, currentUser = _a.currentUser, currentTab = _a.currentTab, pageNumber = _a.pageNumber, rowsPerPage = _a.rowsPerPage, searchText = _a.searchText, lastLoginFilterChecked = _a.lastLoginFilterChecked, selectedState = _a.selectedState, onPageStateChange = _a.onPageStateChange;
    var theme = (0, material_1.useTheme)();
    // Filter the employees based on the search text
    var filteredEmployees = (0, react_1.useMemo)(function () {
        return employees.filter(function (employee) {
            var name = (function () {
                if (employee.firstName && employee.lastName)
                    return [employee.lastName, employee.firstName].join(', ');
                else if (employee.name)
                    return employee.name;
                else
                    return '';
            })();
            var lastLoginFilter = (function () {
                if (!lastLoginFilterChecked)
                    return true;
                if (employee.lastLogin)
                    return luxon_1.DateTime.fromISO(employee.lastLogin) > luxon_1.DateTime.now().minus({ days: 90 });
                else
                    return false;
            })();
            return (name.toLowerCase().includes(searchText.toLowerCase()) &&
                (currentTab === PageTab.providers ? employee.isProvider : true) &&
                (currentTab === PageTab.providers && selectedState && selectedState.value !== ''
                    ? employee.licenses.some(function (license) { return license.state === selectedState.value; })
                    : true) &&
                lastLoginFilter);
        });
    }, [employees, searchText, currentTab, selectedState, lastLoginFilterChecked]);
    // For pagination, only include the rows that are on the current page
    var pageEmployees = react_1.default.useMemo(function () {
        return filteredEmployees.slice(pageNumber * rowsPerPage, // skip over the rows from previous pages
        (pageNumber + 1) * rowsPerPage // only show the rows from the current page
        );
    }, [filteredEmployees, pageNumber, rowsPerPage]);
    // Handle pagination
    var handleChangePage = (0, react_1.useCallback)(function (event, newPageNumber) {
        onPageStateChange({ pageNumber: newPageNumber });
    }, [onPageStateChange]);
    // Handle changing the number of rows per page
    var handleChangeRowsPerPage = (0, react_1.useCallback)(function (event) {
        onPageStateChange({ rowsPerPage: parseInt(event.target.value), pageNumber: 0 });
    }, [onPageStateChange]);
    // Handle changing the search text
    var handleChangeSearchText = (0, react_1.useCallback)(function (event) {
        onPageStateChange({ searchText: event.target.value, pageNumber: 0 });
    }, [onPageStateChange]);
    var handleChangeStateSelect = (0, react_1.useCallback)(function (_event, value) {
        onPageStateChange({ selectedState: value });
    }, [onPageStateChange]);
    var handleChangeLastLoginFilter = (0, react_1.useCallback)(function (_event, value) {
        onPageStateChange({ lastLoginFilterChecked: value, pageNumber: 0 });
    }, [onPageStateChange]);
    return (<>
      <material_1.Paper sx={{ padding: 2 }}>
        <material_1.TableContainer>
          <material_1.Grid container direction="row" justifyContent="start" alignItems="center">
            {/* Employee Name Search Box */}
            <material_1.Box sx={{ display: 'flex', flex: 2, margin: '10px 0' }}>
              <material_1.TextField id="outlined-basic" label="Search by name" variant="outlined" onChange={handleChangeSearchText} value={searchText} data-testid={data_test_ids_1.dataTestIds.employeesPage.searchByName} InputProps={{ endAdornment: <Search_1.default /> }} sx={{ width: '100%', paddingRight: 2 }}/>
            </material_1.Box>
            {/* States drop-down */}
            {currentTab === PageTab.providers && (<material_1.Box sx={{ display: 'flex', flex: 2, paddingRight: 3 }}>
                <StateSelect onChange={handleChangeStateSelect} selectedState={selectedState}/>
              </material_1.Box>)}
            <material_1.Box sx={{ display: 'flex', flex: 1, maxWidth: '260px' }}>
              <material_1.FormControlLabel name="last_login_filter" control={<material_1.Checkbox checked={lastLoginFilterChecked} onChange={handleChangeLastLoginFilter}/>} label="Hide last logins that occurred more than 90 days ago" sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}/>
            </material_1.Box>
            {/* todo reduce code duplicate */}
            {(currentUser === null || currentUser === void 0 ? void 0 : currentUser.hasRole([utils_1.RoleType.Administrator])) ? (<react_router_dom_1.Link to={"/employees/add"}>
                <material_1.Button variant="contained" sx={{ marginLeft: 1 }} startIcon={<icons_material_1.Add />}>
                  Add user
                </material_1.Button>
              </react_router_dom_1.Link>) : (<material_1.Tooltip title="You must be an administrator to add new users" placement="top">
                <span>
                  {/* https://mui.com/material-ui/react-tooltip/#disabled-elements */}
                  <material_1.Button variant="contained" sx={{ marginLeft: 1 }} startIcon={<icons_material_1.Add />} disabled>
                    Add user
                  </material_1.Button>
                </span>
              </material_1.Tooltip>)}
          </material_1.Grid>

          {/* Employees Table */}
          <material_1.Table sx={{ minWidth: 650 }} aria-label="locationsTable" data-testid={data_test_ids_1.dataTestIds.employeesPage.table}>
            <material_1.TableHead>
              <material_1.TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold', textAlign: 'left' } }}>
                <material_1.TableCell sx={{ width: '25%' }}>Name (Last, First)</material_1.TableCell>
                <material_1.TableCell>Phone</material_1.TableCell>
                <material_1.TableCell>Email</material_1.TableCell>
                <material_1.TableCell>Last Login</material_1.TableCell>
                <material_1.TableCell>Status</material_1.TableCell>
                {currentTab === PageTab.providers && (<>
                    <material_1.TableCell sx={{ maxWidth: '150px' }}>Getting alerts</material_1.TableCell>
                    <material_1.TableCell sx={{ maxWidth: '150px' }}>Seen patient last 30 mins</material_1.TableCell>
                  </>)}
              </material_1.TableRow>
            </material_1.TableHead>

            <material_1.TableBody>
              {pageEmployees.map(function (employee) {
            var name = (function () {
                if (employee.firstName && employee.lastName)
                    return [employee.lastName, employee.firstName].join(', ');
                else if (employee.name)
                    return employee.name;
                else
                    return '-';
            })();
            return (<material_1.TableRow key={employee.id} sx={{ '& .MuiTableCell-body': { textAlign: 'left' } }}>
                    <material_1.TableCell>
                      <react_router_dom_1.Link to={"/employee/".concat(employee.id)} style={{
                    display: 'contents',
                    color: theme.palette.primary.main,
                }}>
                        {name}
                      </react_router_dom_1.Link>
                    </material_1.TableCell>
                    <material_1.TableCell sx={{
                    color: colors_1.otherColors.tableRow,
                }}>
                      {employee.phoneNumber || '-'}
                    </material_1.TableCell>
                    <material_1.TableCell sx={{
                    color: colors_1.otherColors.tableRow,
                }}>
                      {employee.email || '-'}
                    </material_1.TableCell>
                    <material_1.TableCell sx={{
                    color: colors_1.otherColors.tableRow,
                }}>
                      {employee.lastLogin ? (0, formatDateTime_1.formatDateUsingSlashes)(employee.lastLogin) : 'Never'}
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <material_1.Chip label={employee.status.toUpperCase()} data-testid={data_test_ids_1.dataTestIds.employeesPage.statusChip} sx={__assign({ backgroundColor: employee.status === 'Active'
                        ? colors_1.otherColors.employeeActiveChip
                        : colors_1.otherColors.employeeDeactivatedChip, color: employee.status === 'Active'
                        ? colors_1.otherColors.employeeActiveText
                        : colors_1.otherColors.employeeDeactivatedText, borderRadius: '4px', height: '17px', '& .MuiChip-label': {
                        padding: '2px 8px 0px 8px',
                    } }, theme.typography.subtitle2)}/>
                    </material_1.TableCell>
                    {currentTab === PageTab.providers && (<>
                        <material_1.TableCell sx={{
                        color: colors_1.otherColors.tableRow,
                    }}>
                          {employee.gettingAlerts && (<material_1.Chip label="GETTING ALERTS" color={'info'} sx={__assign({ borderRadius: '4px', bgcolor: 'info.light', color: 'info.dark', height: '17px', '& .MuiChip-label': {
                                padding: '2px 8px 0px 8px',
                            } }, theme.typography.subtitle2)}/>)}
                        </material_1.TableCell>
                        <material_1.TableCell sx={{
                        color: colors_1.otherColors.tableRow,
                    }}>
                          {employee.seenPatientRecently && (<material_1.Chip label="BEEN SEEN" sx={__assign({ backgroundColor: colors_1.otherColors.employeeBeenSeenChip, color: colors_1.otherColors.employeeBeenSeenText, borderRadius: '4px', height: '17px', '& .MuiChip-label': {
                                padding: '2px 8px 0px 8px',
                            } }, theme.typography.subtitle2)}/>)}
                        </material_1.TableCell>
                      </>)}
                  </material_1.TableRow>);
        })}
            </material_1.TableBody>
          </material_1.Table>

          <material_1.TablePagination rowsPerPageOptions={[5, 10, 25, 50]} component="div" count={filteredEmployees.length} rowsPerPage={rowsPerPage} page={pageNumber} onPageChange={handleChangePage} onRowsPerPageChange={handleChangeRowsPerPage} data-testid={data_test_ids_1.dataTestIds.pagination.paginationContainer}/>
        </material_1.TableContainer>
      </material_1.Paper>
    </>);
}
function StateSelect(_a) {
    var onChange = _a.onChange, selectedState = _a.selectedState;
    var EMPTY_STATE = { label: 'All states', value: '' };
    var options = __spreadArray([EMPTY_STATE], utils_1.AllStates, true);
    return (<material_1.Autocomplete value={selectedState || EMPTY_STATE} onChange={onChange} data-testid={data_test_ids_1.dataTestIds.employeesPage.providersStateFilter} getOptionLabel={function (state) { return state.label || 'Unknown'; }} isOptionEqualToValue={function (option, tempValue) { return option.value === tempValue.value; }} options={options} renderOption={function (props, option) {
            return (<li {...props} key={option.value}>
            {option.label}
          </li>);
        }} fullWidth renderInput={function (params) { return <material_1.TextField name="state" {...params} label="State"/>; }}/>);
}
//# sourceMappingURL=Employees.js.map