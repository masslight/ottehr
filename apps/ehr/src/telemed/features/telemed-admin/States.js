"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = StatesPage;
var colors_1 = require("@ehrTheme/colors");
var Search_1 = require("@mui/icons-material/Search");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var utils_2 = require("utils");
var App_1 = require("../../../App");
var Loading_1 = require("../../../components/Loading");
var constants_1 = require("../../../constants");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var __1 = require("../..");
var telemed_admin_queries_1 = require("./telemed-admin.queries");
function StatesPage() {
    var theme = (0, material_1.useTheme)();
    // set up the pagination states
    var _a = react_1.default.useState(constants_1.STATES_ROWS_PER_PAGE), rowsPerPage = _a[0], setRowsPerPage = _a[1];
    var _b = react_1.default.useState(0), pageNumber = _b[0], setPageNumber = _b[1];
    var _c = react_1.default.useState(''), searchText = _c[0], setSearchText = _c[1];
    var _d = (0, telemed_admin_queries_1.useStatesQuery)(), data = _d.data, isFetching = _d.isFetching;
    var stateLocations = react_1.default.useMemo(function () { return data || []; }, [data]);
    // Filter the states based on the locations
    var fhirLocationStates = react_1.default.useMemo(function () {
        return stateLocations
            ? utils_1.AllStates.filter(function (state) {
                return stateLocations.some(function (loc) { var _a; return ((_a = loc.address) === null || _a === void 0 ? void 0 : _a.state) === state.value && (0, utils_2.isLocationVirtual)(loc); });
            })
            : [];
    }, [stateLocations]);
    // Filter the states based on the search text
    var filteredStates = react_1.default.useMemo(function () {
        return fhirLocationStates.filter(function (state) {
            return "".concat(state.label, " - ").concat(utils_1.AllStatesToVirtualLocationsData[state.value])
                .toLowerCase()
                .includes(searchText.toLowerCase());
        });
    }, [searchText, fhirLocationStates]);
    // For pagination, only include the rows that are on the current page
    var pageStates = react_1.default.useMemo(function () {
        return filteredStates.slice(pageNumber * rowsPerPage, // skip over the rows from previous pages
        (pageNumber + 1) * rowsPerPage // only show the rows from the current page
        );
    }, [pageNumber, filteredStates, rowsPerPage]);
    // Handle pagination
    var handleChangePage = function (_, newPageNumber) {
        setPageNumber(newPageNumber);
    };
    // Handle changing the number of rows per page
    var handleChangeRowsPerPage = function (event) {
        setRowsPerPage(parseInt(event.target.value));
        setPageNumber(0);
    };
    // Handle changing the search text
    var handleChangeSearchText = function (event) {
        return setSearchText(event.target.value);
    };
    return (<material_1.Paper sx={{ padding: 2 }}>
      <material_1.TableContainer>
        <material_1.Grid container spacing={2} paddingTop={1}>
          {/* Locations Search Box */}
          <material_1.Grid item xs={12} sm={5} marginTop={-0.5}>
            <material_1.Box sx={{ display: 'contents' }}>
              <material_1.Box>
                <material_1.TextField id="outlined-basic" label="States" variant="outlined" onChange={function (e) {
            if (pageNumber !== 0)
                setPageNumber(0);
            handleChangeSearchText(e);
        }} InputProps={{ endAdornment: <Search_1.default /> }} sx={{ marginBottom: 2 }} margin="dense" data-testid={data_test_ids_1.dataTestIds.statesPage.statesSearch}/>
              </material_1.Box>
            </material_1.Box>
          </material_1.Grid>
          {isFetching && <Loading_1.default />}
        </material_1.Grid>

        <material_1.Table sx={{ minWidth: 650 }} aria-label="locationsTable">
          {/* Label Row */}
          <material_1.TableHead>
            <material_1.TableRow>
              <material_1.TableCell sx={{ fontWeight: 'bold', width: '50%' }}>State name</material_1.TableCell>
              <material_1.TableCell sx={{ fontWeight: 'bold' }} align="left">
                Operate in state
              </material_1.TableCell>
            </material_1.TableRow>
          </material_1.TableHead>
          <material_1.TableBody>
            {pageStates.map(function (state, idx) {
            var stateLocation = stateLocations.find(function (loc) { var _a; return ((_a = loc.address) === null || _a === void 0 ? void 0 : _a.state) === state.value; });
            var operatesInState = Boolean(stateLocation && stateLocation.status === 'active');
            var operatesLabelText = operatesInState ? 'yes' : 'no';
            return (<material_1.TableRow key={idx} data-testid={data_test_ids_1.dataTestIds.statesPage.stateRow(state.value)}>
                  <material_1.TableCell data-testid={data_test_ids_1.dataTestIds.statesPage.stateValue}>
                    <react_router_dom_1.Link to={"".concat(App_1.STATES_URL, "/").concat(state.value)} style={{
                    display: 'contents',
                    color: theme.palette.primary.main,
                }}>
                      {state.label} - {utils_1.AllStatesToNames[state.value]}
                    </react_router_dom_1.Link>
                  </material_1.TableCell>
                  <material_1.TableCell align="left" sx={{
                    color: colors_1.otherColors.tableRow,
                }}>
                    {isFetching ? (<material_1.Skeleton width={35} height={20}/>) : (<__1.BooleanStateChip dataTestId={data_test_ids_1.dataTestIds.statesPage.operateInStateValue} label={operatesLabelText} state={operatesInState}/>)}
                  </material_1.TableCell>
                </material_1.TableRow>);
        })}
          </material_1.TableBody>
        </material_1.Table>

        {/* Table Pagination */}
        <material_1.TablePagination rowsPerPageOptions={[10, 25, 50, 100]} component="div" count={filteredStates.length} rowsPerPage={rowsPerPage} page={pageNumber} onPageChange={handleChangePage} onRowsPerPageChange={handleChangeRowsPerPage} data-testid={data_test_ids_1.dataTestIds.pagination.paginationContainer}/>
      </material_1.TableContainer>
    </material_1.Paper>);
}
//# sourceMappingURL=States.js.map