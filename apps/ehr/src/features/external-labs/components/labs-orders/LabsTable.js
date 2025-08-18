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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabsTable = void 0;
var Clear_1 = require("@mui/icons-material/Clear");
var material_1 = require("@mui/material");
var x_date_pickers_1 = require("@mui/x-date-pickers");
var x_date_pickers_2 = require("@mui/x-date-pickers");
var AdapterLuxon_1 = require("@mui/x-date-pickers/AdapterLuxon");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var labs_1 = require("utils/lib/types/data/labs");
var helpers_1 = require("../../../css-module/routing/helpers");
var LabsAutocompleteForPatient_1 = require("../LabsAutocompleteForPatient");
var LabOrderLoading_1 = require("./LabOrderLoading");
var LabsTableRow_1 = require("./LabsTableRow");
var usePatientLabOrders_1 = require("./usePatientLabOrders");
var LabsTable = function (_a) {
    var searchBy = _a.searchBy, columns = _a.columns, _b = _a.showFilters, showFilters = _b === void 0 ? false : _b, _c = _a.allowDelete, allowDelete = _c === void 0 ? false : _c, titleText = _a.titleText, onCreateOrder = _a.onCreateOrder;
    var navigateTo = (0, react_router_dom_1.useNavigate)();
    var _d = (0, usePatientLabOrders_1.usePatientLabOrders)(searchBy), labOrders = _d.labOrders, loading = _d.loading, totalPages = _d.totalPages, page = _d.page, setSearchParams = _d.setSearchParams, visitDateFilter = _d.visitDateFilter, showPagination = _d.showPagination, error = _d.error, showDeleteLabOrderDialog = _d.showDeleteLabOrderDialog, DeleteOrderDialog = _d.DeleteOrderDialog, patientLabItems = _d.patientLabItems;
    var _e = (0, react_1.useState)(null), selectedOrderedItem = _e[0], setSelectedOrderedItem = _e[1];
    var _f = (0, react_1.useState)(visitDateFilter), tempDateFilter = _f[0], setTempDateFilter = _f[1];
    var submitFilterByDate = function (date) {
        var dateToSet = date || tempDateFilter;
        setSearchParams({ pageNumber: 1, visitDateFilter: dateToSet });
    };
    var handleClearDate = function () {
        setTempDateFilter(null);
        setSearchParams({ pageNumber: 1, visitDateFilter: null });
    };
    var handlePageChange = function (event, value) {
        setSearchParams({ pageNumber: value });
    };
    var onRowClick = function (labOrderData) {
        navigateTo((0, helpers_1.getExternalLabOrderEditUrl)(labOrderData.appointmentId, labOrderData.serviceRequestId));
    };
    var handleOrderableItemCodeChange = function (value) {
        setSelectedOrderedItem(value || null);
        setSearchParams({ pageNumber: 1, testTypeFilter: (value === null || value === void 0 ? void 0 : value.item.itemLoinc) || '' });
    };
    if (loading || !labOrders) {
        return <LabOrderLoading_1.LabOrderLoading />;
    }
    if (error) {
        return (<material_1.Paper sx={{ p: 4, textAlign: 'center' }}>
        <material_1.Typography color="error" variant="body1" gutterBottom>
          {error.message || 'Failed to fetch external lab orders. Please try again later.'}
        </material_1.Typography>
        {onCreateOrder && (<material_1.Button variant="contained" onClick={function () { return onCreateOrder(); }} sx={{ mt: 2 }}>
            Create New External Lab Order
          </material_1.Button>)}
      </material_1.Paper>);
    }
    var getColumnWidth = function (column) {
        switch (column) {
            case 'testType':
                return '13%';
            case 'visit':
                return '10%';
            case 'orderAdded':
                return '10%';
            case 'provider':
                return '13%';
            case 'dx':
                return '18%';
            case 'resultsReceived':
                return '10%';
            case 'accessionNumber':
                return '10%';
            case 'status':
                return '5%';
            case 'psc':
                return '6%';
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
            case 'accessionNumber':
                return 'Accession #';
            case 'status':
                return 'Status';
            case 'psc':
                return labs_1.PSC_LOCALE;
            case 'actions':
                return '';
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
      {loading && <LabOrderLoading_1.LabOrderLoading />}

      {titleText && (<material_1.Typography variant="h3" color="primary.dark" sx={{ mb: -2, mt: 2, width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
          {titleText}
        </material_1.Typography>)}

      <material_1.Box sx={{ width: '100%' }}>
        {showFilters && (<x_date_pickers_2.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon}>
            <material_1.Grid container spacing={2} sx={{ mb: 2, mt: 1 }}>
              <material_1.Grid item xs={4}>
                {searchBy.searchBy.field === 'patientId' ? (<LabsAutocompleteForPatient_1.LabsAutocompleteForPatient patientLabItems={patientLabItems} selectedLabItem={selectedOrderedItem} setSelectedLabItem={handleOrderableItemCodeChange}/>) : null}
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
              No External Lab Orders to display
            </material_1.Typography>
            {onCreateOrder && (<material_1.Button variant="contained" onClick={function () { return onCreateOrder(); }} sx={{ mt: 2 }}>
                Create New External Lab Order
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
                {labOrders.map(function (order) { return (<LabsTableRow_1.LabsTableRow key={order.serviceRequestId} labOrderData={order} onDeleteOrder={function () {
                    return showDeleteLabOrderDialog({
                        serviceRequestId: order.serviceRequestId,
                        testItemName: order.testItem,
                    });
                }} onRowClick={function () { return onRowClick(order); }} columns={columns} allowDelete={allowDelete}/>); })}
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
exports.LabsTable = LabsTable;
//# sourceMappingURL=LabsTable.js.map