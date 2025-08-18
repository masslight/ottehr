"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NursingOrdersTable = void 0;
var material_1 = require("@mui/material");
var react_router_dom_1 = require("react-router-dom");
var helpers_1 = require("src/features/css-module/routing/helpers");
var NursingOrdersTableRow_1 = require("./NursingOrdersTableRow");
var useNursingOrders_1 = require("./useNursingOrders");
var NursingOrdersTable = function (_a) {
    var columns = _a.columns, searchBy = _a.searchBy, appointmentId = _a.appointmentId, onCreateOrder = _a.onCreateOrder;
    var navigateTo = (0, react_router_dom_1.useNavigate)();
    var _b = (0, useNursingOrders_1.useGetNursingOrders)({ searchBy: searchBy }), nursingOrders = _b.nursingOrders, loading = _b.loading, error = _b.error, refetch = _b.fetchNursingOrders;
    var onRowClick = function (nursingOrderData) {
        navigateTo((0, helpers_1.getNursingOrderDetailsUrl)(appointmentId, nursingOrderData.serviceRequestId));
    };
    if (loading) {
        return (<material_1.Paper sx={{ p: 4, textAlign: 'center' }}>
        <material_1.Typography variant="body1">Loading nursing orders...</material_1.Typography>
      </material_1.Paper>);
    }
    if (error) {
        return (<material_1.Paper sx={{ p: 4, textAlign: 'center' }}>
        <material_1.Typography color="error" variant="body1" gutterBottom>
          {error.message || 'Failed to fetch nursing orders. Please try again later.'}
        </material_1.Typography>
        {onCreateOrder && (<material_1.Button variant="contained" onClick={function () { return onCreateOrder(); }} sx={{ mt: 2 }}>
            Create New Nursing Order
          </material_1.Button>)}
      </material_1.Paper>);
    }
    var getColumnWidth = function (column) {
        switch (column) {
            case 'order':
                return '60%';
            case 'orderAdded':
                return '20%';
            case 'status':
                return '20%';
            default:
                return '10%';
        }
    };
    var getColumnHeader = function (column) {
        switch (column) {
            case 'order':
                return 'Order';
            case 'orderAdded':
                return 'Ordered';
            case 'status':
                return 'Status';
            default:
                return '';
        }
    };
    return (<material_1.Box sx={{ width: '100%' }}>
      {!Array.isArray(nursingOrders) || nursingOrders.length === 0 ? (<material_1.Box sx={{ p: 3, textAlign: 'center' }}>
          <material_1.Typography variant="body1" gutterBottom>
            No nursing orders to display
          </material_1.Typography>
          {onCreateOrder && (<material_1.Button variant="contained" onClick={function () { return onCreateOrder(); }} sx={{ mt: 2 }}>
              Create New Nursing Order
            </material_1.Button>)}
        </material_1.Box>) : (<material_1.TableContainer sx={{ border: '1px solid #e0e0e0' }}>
          <material_1.Table>
            <material_1.TableHead>
              <material_1.TableRow>
                {columns.map(function (column) { return (<material_1.TableCell key={column} align="left" sx={{
                    fontWeight: 'bold',
                    width: getColumnWidth(column),
                    padding: '8px 16px',
                }}>
                    {getColumnHeader(column)}
                  </material_1.TableCell>); })}
              </material_1.TableRow>
            </material_1.TableHead>
            <material_1.TableBody>
              {nursingOrders.map(function (order) { return (<NursingOrdersTableRow_1.NursingOrdersTableRow key={order.serviceRequestId} nursingOrderData={order} onRowClick={function () { return onRowClick(order); }} columns={columns} refetchOrders={refetch}/>); })}
            </material_1.TableBody>
          </material_1.Table>
        </material_1.TableContainer>)}
    </material_1.Box>);
};
exports.NursingOrdersTable = NursingOrdersTable;
//# sourceMappingURL=NursingOrdersTable.js.map