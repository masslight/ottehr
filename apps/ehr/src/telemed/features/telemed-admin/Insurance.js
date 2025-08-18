"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Insurances;
var colors_1 = require("@ehrTheme/colors");
var Add_1 = require("@mui/icons-material/Add");
var Search_1 = require("@mui/icons-material/Search");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var App_1 = require("../../../App");
var constants_1 = require("../../../constants");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var __1 = require("../..");
var telemed_admin_queries_1 = require("./telemed-admin.queries");
var IsActiveStatus;
(function (IsActiveStatus) {
    IsActiveStatus[IsActiveStatus["active"] = 0] = "active";
    IsActiveStatus[IsActiveStatus["deactivated"] = 1] = "deactivated";
})(IsActiveStatus || (IsActiveStatus = {}));
function Insurances() {
    var theme = (0, material_1.useTheme)();
    // set up the pagination states
    var _a = react_1.default.useState(constants_1.INSURANCE_ROWS_PER_PAGE), rowsPerPage = _a[0], setRowsPerPage = _a[1];
    var _b = react_1.default.useState(0), pageNumber = _b[0], setPageNumber = _b[1];
    var _c = react_1.default.useState(''), searchText = _c[0], setSearchText = _c[1];
    var _d = react_1.default.useState(''), activeFilter = _d[0], setActiveFilter = _d[1];
    var _e = (0, telemed_admin_queries_1.useInsurancesQuery)(), data = _e.data, isFetching = _e.isFetching;
    // Filter insurances based on filters and search
    var filteredInsurances = react_1.default.useMemo(function () {
        var newData = data === null || data === void 0 ? void 0 : data.sort(function (a, b) { var _a, _b, _c; return (_c = (_a = a.name) === null || _a === void 0 ? void 0 : _a.localeCompare((_b = b.name) !== null && _b !== void 0 ? _b : '')) !== null && _c !== void 0 ? _c : 0; }).filter(function (insurance) {
            var _a;
            if (activeFilter === IsActiveStatus.deactivated && insurance.active !== false) {
                return false;
            }
            return searchText ? (_a = insurance.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(searchText.toLowerCase()) : true;
        });
        return newData || [];
    }, [activeFilter, data, searchText]);
    // For pagination, only include the rows that are on the current page
    var currentPagesEntities = react_1.default.useMemo(function () {
        return filteredInsurances.slice(pageNumber * rowsPerPage, // skip over the rows from previous pages
        (pageNumber + 1) * rowsPerPage // only show the rows from the current page
        );
    }, [pageNumber, filteredInsurances, rowsPerPage]);
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
    // Handle change status
    var handleStatusChange = function (ev) {
        setActiveFilter(ev.target.value);
    };
    var skeletonRow = function (key) { return (<material_1.TableRow key={key}>
      <material_1.TableCell>
        <material_1.Skeleton width={100} height="100%"/>
      </material_1.TableCell>
      <material_1.TableCell>
        <material_1.Skeleton width={35} height={20}/>
      </material_1.TableCell>
    </material_1.TableRow>); };
    return (<material_1.Paper sx={{ padding: 2 }}>
      <material_1.TableContainer>
        <material_1.Grid container spacing={2} paddingTop={1} display="flex" alignItems="center">
          <material_1.Grid item xs={12} sm={5} marginTop={-0.5}>
            <material_1.TextField fullWidth id="outlined-basic" label="Insurance" onChange={function (e) {
            if (pageNumber !== 0)
                setPageNumber(0);
            handleChangeSearchText(e);
        }} InputProps={{ endAdornment: <Search_1.default /> }} margin="dense"/>
          </material_1.Grid>
          <material_1.Grid item xs={12} sm={5} paddingTop={5}>
            <material_1.FormControl fullWidth>
              <material_1.InputLabel id="select-insurance-status-filter">Status</material_1.InputLabel>
              <material_1.Select labelId="select-insurance-status-filter" margin="dense" defaultValue={''} input={<material_1.OutlinedInput label="Status"/>} onChange={handleStatusChange}>
                <material_1.MenuItem value={''}>None</material_1.MenuItem>
                <material_1.MenuItem value={IsActiveStatus.active}>Active</material_1.MenuItem>
                <material_1.MenuItem value={IsActiveStatus.deactivated}>Deactivated</material_1.MenuItem>
              </material_1.Select>
            </material_1.FormControl>
          </material_1.Grid>
          <material_1.Grid item xs={12} sm={2} display={'flex'}>
            <react_router_dom_1.Link to={"".concat(App_1.INSURANCES_URL, "/new")} style={{ width: '100%' }}>
              <material_1.Button sx={{
            borderRadius: 100,
            textTransform: 'none',
            width: '100%',
            fontWeight: 600,
        }} color="primary" variant="contained">
                <Add_1.default />
                <material_1.Typography fontWeight="bold">Add new</material_1.Typography>
              </material_1.Button>
            </react_router_dom_1.Link>
          </material_1.Grid>
        </material_1.Grid>

        <material_1.Table sx={{ minWidth: 650 }} aria-label="locationsTable">
          {/* Label Row */}
          <material_1.TableHead>
            <material_1.TableRow>
              <material_1.TableCell sx={{ fontWeight: 'bold', width: '50%' }}>Display name</material_1.TableCell>
              <material_1.TableCell sx={{ fontWeight: 'bold' }} align="left">
                Status
              </material_1.TableCell>
            </material_1.TableRow>
          </material_1.TableHead>
          <material_1.TableBody>
            {isFetching && [1, 2, 3].map(function (id) { return skeletonRow('skeleton-row-' + id); })}
            {currentPagesEntities.map(function (insurance, idx) {
            var displayName = insurance.name;
            var isActive = insurance.active !== false;
            var isActiveLabel = isActive ? 'ACTIVE' : 'DEACTIVATED';
            return (<material_1.TableRow key={idx}>
                  <material_1.TableCell>
                    <react_router_dom_1.Link to={"".concat(App_1.INSURANCES_URL, "/").concat(insurance.id)} style={{
                    display: 'contents',
                    color: theme.palette.primary.main,
                }}>
                      {displayName}
                    </react_router_dom_1.Link>
                  </material_1.TableCell>
                  <material_1.TableCell align="left" sx={{
                    color: colors_1.otherColors.tableRow,
                }}>
                    {isFetching ? (<material_1.Skeleton width={35} height={20}/>) : (<__1.BooleanStateChip label={isActiveLabel} state={isActive}/>)}
                  </material_1.TableCell>
                </material_1.TableRow>);
        })}
          </material_1.TableBody>
        </material_1.Table>

        {/* Table Pagination */}
        <material_1.TablePagination rowsPerPageOptions={[10, 25, 50, 100]} component="div" count={filteredInsurances.length} rowsPerPage={rowsPerPage} page={pageNumber} onPageChange={handleChangePage} onRowsPerPageChange={handleChangeRowsPerPage} data-testid={data_test_ids_1.dataTestIds.pagination.paginationContainer}/>
      </material_1.TableContainer>
    </material_1.Paper>);
}
//# sourceMappingURL=Insurance.js.map