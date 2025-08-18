"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadiologyTable = void 0;
var material_1 = require("@mui/material");
var react_router_dom_1 = require("react-router-dom");
var helpers_1 = require("../../css-module/routing/helpers");
var RadiologyOrderLoading_1 = require("./RadiologyOrderLoading");
var RadiologyTableRow_1 = require("./RadiologyTableRow");
var usePatientRadiologyOrders_1 = require("./usePatientRadiologyOrders");
var RadiologyTable = function (_a) {
    var patientId = _a.patientId, encounterId = _a.encounterId, columns = _a.columns, _b = _a.allowDelete, allowDelete = _b === void 0 ? false : _b, titleText = _a.titleText, onCreateOrder = _a.onCreateOrder;
    var navigateTo = (0, react_router_dom_1.useNavigate)();
    var _c = (0, usePatientRadiologyOrders_1.usePatientRadiologyOrders)({
        patientId: patientId,
        encounterIds: encounterId,
    }), orders = _c.orders, loading = _c.loading, totalPages = _c.totalPages, page = _c.page, setPage = _c.setPage, showPagination = _c.showPagination, error = _c.error, showDeleteRadiologyOrderDialog = _c.showDeleteRadiologyOrderDialog, DeleteOrderDialog = _c.DeleteOrderDialog;
    var onRowClick = function (order) {
        navigateTo((0, helpers_1.getRadiologyOrderEditUrl)(order.appointmentId, order.serviceRequestId));
    };
    var handlePageChange = function (event, value) {
        setPage(value);
    };
    if (loading && orders.length === 0) {
        return <RadiologyOrderLoading_1.RadiologyOrderLoading />;
    }
    if (error) {
        return (<material_1.Paper sx={{ p: 4, textAlign: 'center' }}>
        <material_1.Typography color="error" variant="body1" gutterBottom>
          {error.message || 'Failed to fetch lab orders. Please try again later.'}
        </material_1.Typography>
        {onCreateOrder && (<material_1.Button variant="contained" onClick={onCreateOrder} sx={{ mt: 2 }}>
            Create New Radiology Order
          </material_1.Button>)}
      </material_1.Paper>);
    }
    var getColumnWidth = function (column) {
        switch (column) {
            case 'studyType':
                return '25%';
            case 'dx':
                return '25%';
            case 'ordered':
                return '25%';
            case 'stat':
                return '10%';
            case 'status':
                return '10%';
            case 'actions':
                return '5%';
            default:
                return '10%';
        }
    };
    var getColumnHeader = function (column) {
        switch (column) {
            case 'studyType':
                return 'Study type';
            case 'dx':
                return 'Dx';
            case 'ordered':
                return 'Ordered';
            case 'stat':
                return 'Stat';
            case 'status':
                return 'Status';
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
      {loading && <RadiologyOrderLoading_1.RadiologyOrderLoading />}

      {titleText && (<material_1.Typography variant="h3" color="primary.dark" sx={{ mb: -2, mt: 2, width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
          Radiology
        </material_1.Typography>)}

      <material_1.Box sx={{ width: '100%' }}>
        {!Array.isArray(orders) || orders.length === 0 ? (<material_1.Box sx={{ p: 3, textAlign: 'center' }}>
            <material_1.Typography variant="body1" gutterBottom>
              No radiology orders to display
            </material_1.Typography>
            {onCreateOrder && (<material_1.Button variant="contained" onClick={onCreateOrder} sx={{ mt: 2 }}>
                Create New Radiology Order
              </material_1.Button>)}
          </material_1.Box>) : (<material_1.TableContainer sx={{ border: '1px solid #e0e0e0' }}>
            <material_1.Table>
              <material_1.TableHead>
                <material_1.TableRow>
                  {columns.map(function (column) { return (<material_1.TableCell key={column} align="left" sx={{
                    fontWeight: 'bold',
                    width: getColumnWidth(column),
                    padding: column === 'studyType' ? '16px 16px' : '8px 16px',
                }}>
                      {getColumnHeader(column)}
                    </material_1.TableCell>); })}
                </material_1.TableRow>
              </material_1.TableHead>
              <material_1.TableBody>
                {orders.map(function (order) { return (<RadiologyTableRow_1.RadiologyTableRow key={order.serviceRequestId} order={order} onDeleteOrder={function () {
                    return showDeleteRadiologyOrderDialog({
                        serviceRequestId: order.serviceRequestId,
                        studyType: order.studyType,
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
exports.RadiologyTable = RadiologyTable;
//# sourceMappingURL=RadiologyTable.js.map