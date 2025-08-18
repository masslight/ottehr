"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleInformation = void 0;
exports.getName = getName;
var colors_1 = require("@ehrTheme/colors");
var icons_material_1 = require("@mui/icons-material");
var Search_1 = require("@mui/icons-material/Search");
var material_1 = require("@mui/material");
var sdk_1 = require("@oystehr/sdk");
var luxon_1 = require("luxon");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_query_1 = require("react-query");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var api_1 = require("../api/api");
var data_test_ids_1 = require("../constants/data-test-ids");
var useAppClients_1 = require("../hooks/useAppClients");
var Loading_1 = require("./Loading");
var oystehr = new sdk_1.default({});
function getName(item) {
    var name = undefined;
    if (item.resourceType === 'Location') {
        name = item === null || item === void 0 ? void 0 : item.name;
    }
    else if (item.resourceType === 'Practitioner') {
        var nameTemp = item === null || item === void 0 ? void 0 : item.name;
        if (nameTemp) {
            name = oystehr.fhir.formatHumanName(nameTemp[0]);
        }
    }
    else if (item.resourceType === 'HealthcareService') {
        name = item === null || item === void 0 ? void 0 : item.name;
    }
    else {
        console.log('getName called with unavailable resource', item);
        throw Error('getName called with unavailable resource');
    }
    if (!name) {
        return 'Undefined name';
    }
    return name;
}
var ScheduleInformation = function (_a) {
    var scheduleType = _a.scheduleType;
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var _b = (0, react_1.useState)(5), rowsPerPage = _b[0], setRowsPerPage = _b[1];
    var _c = (0, react_1.useState)(0), pageNumber = _c[0], setPageNumber = _c[1];
    var _d = (0, react_1.useState)(''), searchText = _d[0], setSearchText = _d[1];
    var ownerType = (function () {
        if (scheduleType === 'location') {
            return 'Location';
        }
        if (scheduleType === 'provider') {
            return 'Practitioner';
        }
        return 'HealthcareService';
    })();
    var _e = (0, react_query_1.useQuery)(["list-schedule-owners + ".concat(scheduleType), { zambdaClient: oystehrZambda }], function () { return (oystehrZambda ? (0, api_1.listScheduleOwners)({ ownerType: ownerType }, oystehrZambda) : null); }, {
        onError: function (e) {
            var errorMessage = 'Error fetching schedule owners';
            if ((0, utils_1.isApiError)(e)) {
                errorMessage = e.message;
            }
            (0, notistack_1.enqueueSnackbar)({
                message: errorMessage,
                variant: 'error',
            });
        },
        enabled: !!oystehrZambda,
    }), isLoading = _e.isLoading, isFetching = _e.isFetching, isRefetching = _e.isRefetching, data = _e.data;
    var loading = isLoading || isFetching || isRefetching;
    var filteredItems = (0, react_1.useMemo)(function () {
        var _a;
        var unfiltered = (_a = data === null || data === void 0 ? void 0 : data.list) !== null && _a !== void 0 ? _a : [];
        return unfiltered.filter(function (item) { return item.owner.name.toLowerCase().includes(searchText.toLowerCase()); });
    }, [data, searchText]);
    // For pagination, only include the rows that are on the current page
    var pageItems = (0, react_1.useMemo)(function () {
        return filteredItems.slice(pageNumber * rowsPerPage, // skip over the rows from previous pages
        (pageNumber + 1) * rowsPerPage // only show the rows from the current page
        );
    }, [pageNumber, filteredItems, rowsPerPage]);
    var handleChangePage = function (event, newPageNumber) {
        setPageNumber(newPageNumber);
    };
    var handleChangeRowsPerPage = function (event) {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPageNumber(0);
    };
    var handleChangeSearchText = function (event) {
        setSearchText(event.target.value);
    };
    return (<material_1.Paper sx={{ padding: 2 }}>
      <material_1.TableContainer>
        {/* Items Search Box */}
        <material_1.Box sx={{ display: 'flex', alignItems: 'center' }}>
          <material_1.TextField id={"search-".concat(scheduleType)} label={"Search ".concat(scheduleType, "s")} variant="outlined" onChange={handleChangeSearchText} InputProps={{ endAdornment: <Search_1.default /> }} 
    // sx={{ marginBottom: 2 }}
    margin="dense" size="small"/>
          <react_router_dom_1.Link to={"/schedule/".concat(scheduleType, "/add")}>
            <material_1.Button variant="contained" sx={{ marginLeft: 1 }} startIcon={<icons_material_1.Add />}>
              Add {scheduleType}
            </material_1.Button>
          </react_router_dom_1.Link>
          {loading && (<material_1.Box sx={{ marginLeft: 'auto' }}>
              <Loading_1.default />
            </material_1.Box>)}
        </material_1.Box>

        <material_1.Table sx={{ minWidth: 650 }} aria-label={"".concat(scheduleType, "sTable")}>
          <material_1.TableHead>
            <material_1.TableRow>
              <material_1.TableCell sx={{ fontWeight: 'bold', width: '25%' }}>{(0, material_1.capitalize)(scheduleType)} name</material_1.TableCell>
              <material_1.TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Address</material_1.TableCell>
              <material_1.TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Today&apos;s hours</material_1.TableCell>
              <material_1.TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Upcoming schedule changes</material_1.TableCell>
            </material_1.TableRow>
          </material_1.TableHead>
          <material_1.TableBody>
            {pageItems.map(function (item) {
            var _a, _b, _c, _d;
            return (<material_1.TableRow key={item.owner.id}>
                <material_1.TableCell>
                  <react_router_dom_1.Link to={getLinkForItem(item)} style={{ textDecoration: 'none' }}>
                    <material_1.Typography color="primary">{item.owner.name}</material_1.Typography>
                  </react_router_dom_1.Link>
                </material_1.TableCell>
                <material_1.TableCell align="left">
                  <material_1.Typography>{(_a = item.owner.address) !== null && _a !== void 0 ? _a : ''}</material_1.Typography>
                </material_1.TableCell>
                <material_1.TableCell align="left">
                  <material_1.Typography>{getHoursOfOperationText(item)}</material_1.Typography>
                </material_1.TableCell>
                <material_1.TableCell align="left">
                  <material_1.Typography style={{
                    color: ((_b = item.schedules[0]) === null || _b === void 0 ? void 0 : _b.upcomingScheduleChanges) ? 'inherit' : colors_1.otherColors.none,
                }}>
                    {(_d = (_c = item.schedules[0]) === null || _c === void 0 ? void 0 : _c.upcomingScheduleChanges) !== null && _d !== void 0 ? _d : 'No upcoming schedule changes'}
                  </material_1.Typography>
                </material_1.TableCell>
              </material_1.TableRow>);
        })}
          </material_1.TableBody>
        </material_1.Table>

        {/* Table Pagination */}
        <material_1.TablePagination rowsPerPageOptions={[1, 5, 10, 25]} component="div" count={filteredItems.length} rowsPerPage={rowsPerPage} page={pageNumber} onPageChange={handleChangePage} onRowsPerPageChange={handleChangeRowsPerPage} data-testid={data_test_ids_1.dataTestIds.pagination.paginationContainer}/>
      </material_1.TableContainer>
    </material_1.Paper>);
};
exports.ScheduleInformation = ScheduleInformation;
var getHoursOfOperationText = function (item) {
    if (!item.schedules.length) {
        return 'No scheduled hours';
    }
    var schedule = item.schedules[0];
    var hoursOfOperation = schedule.todayHoursISO;
    var timezone = schedule.timezone;
    if (!hoursOfOperation) {
        return 'No scheduled hours';
    }
    var open = hoursOfOperation.open, close = hoursOfOperation.close;
    var openTime = luxon_1.DateTime.fromISO(open).setZone(timezone);
    var closeTime = luxon_1.DateTime.fromISO(close).setZone(timezone);
    if (openTime.isValid && closeTime.isValid) {
        return openTime.toFormat('h:mm a') + ' - ' + closeTime.toFormat('h:mm a');
    }
    return 'No scheduled hours';
};
var getLinkForItem = function (item) {
    var itemPathSegment = '';
    if (item.owner.resourceType === 'Practitioner') {
        itemPathSegment = 'provider';
    }
    else if (item.owner.resourceType === 'Location') {
        itemPathSegment = 'location';
    }
    else {
        itemPathSegment = 'group';
    }
    if (item.owner.resourceType === 'HealthcareService') {
        return "/group/id/".concat(item.owner.id);
    }
    if (item.schedules.length) {
        return "/schedule/id/".concat(item.schedules[0].id);
    }
    return "/schedule/new/".concat(itemPathSegment, "/").concat(item.owner.id);
};
//# sourceMappingURL=ScheduleInformation.js.map