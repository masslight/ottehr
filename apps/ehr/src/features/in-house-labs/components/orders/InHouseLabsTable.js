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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InHouseLabsTable = void 0;
var Clear_1 = require("@mui/icons-material/Clear");
var Search_1 = require("@mui/icons-material/Search");
var material_1 = require("@mui/material");
var x_date_pickers_1 = require("@mui/x-date-pickers");
var x_date_pickers_2 = require("@mui/x-date-pickers");
var AdapterLuxon_1 = require("@mui/x-date-pickers/AdapterLuxon");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("src/api/api");
var DropdownPlaceholder_1 = require("src/features/common/DropdownPlaceholder");
var helpers_1 = require("src/features/css-module/routing/helpers");
var useAppClients_1 = require("src/hooks/useAppClients");
var InHouseLabsTableRow_1 = require("./InHouseLabsTableRow");
var useInHouseLabOrders_1 = require("./useInHouseLabOrders");
var InHouseLabsTable = function (_a) {
    var searchBy = _a.searchBy, columns = _a.columns, _b = _a.showFilters, showFilters = _b === void 0 ? false : _b, _c = _a.allowDelete, allowDelete = _c === void 0 ? false : _c, titleText = _a.titleText, onCreateOrder = _a.onCreateOrder;
    var navigateTo = (0, react_router_dom_1.useNavigate)();
    var _d = (0, useInHouseLabOrders_1.useInHouseLabOrders)(searchBy), labOrders = _d.labOrders, loading = _d.loading, totalPages = _d.totalPages, page = _d.page, setSearchParams = _d.setSearchParams, visitDateFilter = _d.visitDateFilter, showPagination = _d.showPagination, error = _d.error, showDeleteLabOrderDialog = _d.showDeleteLabOrderDialog, DeleteOrderDialog = _d.DeleteOrderDialog;
    var _e = (0, react_1.useState)(''), testTypeQuery = _e[0], setTestTypeQuery = _e[1];
    var _f = (0, react_1.useState)(visitDateFilter), tempDateFilter = _f[0], setTempDateFilter = _f[1];
    var _g = (0, react_1.useState)([]), availableTests = _g[0], setAvailableTests = _g[1];
    var _h = (0, react_1.useState)(false), loadingTests = _h[0], setLoadingTests = _h[1];
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    // set data for filters
    (0, react_1.useEffect)(function () {
        if (!oystehrZambda || !showFilters) {
            return;
        }
        var fetchTests = function () { return __awaiter(void 0, void 0, void 0, function () {
            var response, testItems, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, 3, 4]);
                        setLoadingTests(true);
                        return [4 /*yield*/, (0, api_1.getCreateInHouseLabOrderResources)(oystehrZambda, {})];
                    case 1:
                        response = _a.sent();
                        testItems = response.labs || [];
                        setAvailableTests(testItems.sort(function (a, b) { return a.name.localeCompare(b.name); }));
                        return [3 /*break*/, 4];
                    case 2:
                        error_1 = _a.sent();
                        console.error('Error fetching tests:', error_1);
                        return [3 /*break*/, 4];
                    case 3:
                        setLoadingTests(false);
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        }); };
        void fetchTests();
    }, [oystehrZambda, showFilters]);
    var submitFilterByDate = function (date) {
        var dateToSet = date || tempDateFilter;
        setSearchParams({ pageNumber: 1, visitDateFilter: dateToSet });
    };
    var handleClearDate = function () {
        setTempDateFilter(null);
        setSearchParams({ pageNumber: 1, visitDateFilter: null });
    };
    var onRowClick = function (labOrderData) {
        navigateTo((0, helpers_1.getInHouseLabOrderDetailsUrl)(labOrderData.appointmentId, labOrderData.serviceRequestId));
    };
    var handlePageChange = function (event, value) {
        setSearchParams({ pageNumber: value });
    };
    if (loading) {
        return (<material_1.Paper sx={{ p: 4, textAlign: 'center' }}>
        <material_1.Typography variant="body1">Loading In-house Lab Orders...</material_1.Typography>
      </material_1.Paper>);
    }
    if (error) {
        return (<material_1.Paper sx={{ p: 4, textAlign: 'center' }}>
        <material_1.Typography color="error" variant="body1" gutterBottom>
          {error.message || 'Failed to fetch In-house Lab Orders. Please try again later.'}
        </material_1.Typography>
        {onCreateOrder && (<material_1.Button variant="contained" onClick={function () { return onCreateOrder(); }} sx={{ mt: 2 }}>
            Create New In-house Lab Order
          </material_1.Button>)}
      </material_1.Paper>);
    }
    var getColumnWidth = function (column) {
        switch (column) {
            case 'testType':
                return '15%';
            case 'visit':
                return '12%';
            case 'orderAdded':
                return '12%';
            case 'provider':
                return '15%';
            case 'dx':
                return '26%';
            case 'resultsReceived':
                return '12%';
            case 'status':
                return '8%';
            case 'actions':
                return '5%';
            default:
                return '10%';
        }
    };
    var getColumnHeader = function (column) {
        switch (column) {
            case 'testType':
                return 'Test type';
            case 'visit':
                return 'Visit';
            case 'orderAdded':
                return 'Order added';
            case 'provider':
                return 'Provider';
            case 'dx':
                return 'Dx';
            case 'resultsReceived':
                return 'Results received';
            case 'status':
                return 'Status';
            default:
                return '';
        }
    };
    return (<material_1.Paper sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 3,
            mt: 2,
            p: 3,
            position: 'relative',
        }}>
      {titleText && (<material_1.Typography variant="h3" color="primary.dark" sx={{ mb: -2, mt: 2, width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
          {titleText}
        </material_1.Typography>)}

      <material_1.Box sx={{ width: '100%' }}>
        {showFilters && (<x_date_pickers_2.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon}>
            <material_1.Grid container spacing={2} sx={{ mb: 2, mt: 1 }}>
              <material_1.Grid item xs={4}>
                {availableTests.length ? (<material_1.Autocomplete size="small" fullWidth loading={loadingTests} options={availableTests} getOptionLabel={function (option) { return option.name; }} value={availableTests.find(function (test) { return test.name === testTypeQuery; }) || null} onChange={function (_, newValue) {
                    setTestTypeQuery((newValue === null || newValue === void 0 ? void 0 : newValue.name) || '');
                    setSearchParams({ pageNumber: 1, testTypeFilter: (newValue === null || newValue === void 0 ? void 0 : newValue.name) || '' });
                }} inputValue={testTypeQuery} onInputChange={function (_, newInputValue) {
                    setTestTypeQuery(newInputValue);
                }} renderInput={function (params) { return (<material_1.TextField {...params} label="Test type" InputProps={__assign(__assign({}, params.InputProps), { startAdornment: (<>
                              <material_1.InputAdornment position="start">
                                <Search_1.default />
                              </material_1.InputAdornment>
                              {params.InputProps.startAdornment}
                            </>) })}/>); }}/>) : (<DropdownPlaceholder_1.DropdownPlaceholder />)}
              </material_1.Grid>
              <material_1.Grid item xs={4}>
                <x_date_pickers_1.DatePicker label="Visit date" value={tempDateFilter} onChange={setTempDateFilter} onAccept={submitFilterByDate} format="MM/dd/yyyy" slotProps={{
                textField: function (params) {
                    var _a;
                    return (__assign(__assign({}, params), { onBlur: function () { return submitFilterByDate(); }, fullWidth: true, size: 'small', InputProps: __assign(__assign({}, params.InputProps), { endAdornment: (<>
                            {tempDateFilter && (<material_1.IconButton size="small" onClick={handleClearDate} edge="end">
                                <Clear_1.default fontSize="small"/>
                              </material_1.IconButton>)}
                            {(_a = params.InputProps) === null || _a === void 0 ? void 0 : _a.endAdornment}
                          </>) }) }));
                },
            }}/>
              </material_1.Grid>
            </material_1.Grid>
          </x_date_pickers_2.LocalizationProvider>)}

        {!Array.isArray(labOrders) || labOrders.length === 0 ? (<material_1.Box sx={{ p: 3, textAlign: 'center' }}>
            <material_1.Typography variant="body1" gutterBottom>
              No In-house Lab Orders to display
            </material_1.Typography>
            {onCreateOrder && (<material_1.Button variant="contained" onClick={function () { return onCreateOrder(); }} sx={{ mt: 2 }}>
                Create New In-house Lab Order
              </material_1.Button>)}
          </material_1.Box>) : (<material_1.TableContainer sx={{ border: '1px solid #e0e0e0' }}>
            <material_1.Table>
              <material_1.TableHead>
                <material_1.TableRow>
                  {columns.map(function (column) { return (<material_1.TableCell key={column} align="left" sx={{
                    fontWeight: 'bold',
                    width: getColumnWidth(column),
                    padding: column === 'testType' ? '16px 16px' : '8px 16px',
                }}>
                      {getColumnHeader(column)}
                    </material_1.TableCell>); })}
                </material_1.TableRow>
              </material_1.TableHead>
              <material_1.TableBody>
                {labOrders.map(function (order) { return (<InHouseLabsTableRow_1.InHouseLabsTableRow key={order.serviceRequestId} labOrderData={order} onRowClick={function () { return onRowClick(order); }} columns={columns} allowDelete={allowDelete} onDeleteOrder={function () {
                    return showDeleteLabOrderDialog({
                        serviceRequestId: order.serviceRequestId,
                        testItemName: order.testItemName,
                    });
                }}/>); })}
              </material_1.TableBody>
            </material_1.Table>
          </material_1.TableContainer>)}

        {showPagination && totalPages > 1 && (<material_1.Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 2, width: '100%' }}>
            <material_1.Pagination count={totalPages} page={page} onChange={handlePageChange} sx={{
                '& .MuiPaginationItem-root.Mui-selected': {
                    backgroundColor: 'grey.300',
                    '&:hover': {
                        backgroundColor: 'grey.400',
                    },
                },
            }}/>
          </material_1.Box>)}
      </material_1.Box>
      {DeleteOrderDialog}
    </material_1.Paper>);
};
exports.InHouseLabsTable = InHouseLabsTable;
//# sourceMappingURL=InHouseLabsTable.js.map