"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InHouseLabsPage = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var ListViewContainer_1 = require("src/features/common/ListViewContainer");
var helpers_1 = require("src/features/css-module/routing/helpers");
var PageTitle_1 = require("../../../telemed/components/PageTitle");
var appointment_store_1 = require("../../../telemed/state/appointment/appointment.store");
var RoundedButton_1 = require("../../css-module/components/RoundedButton");
var InHouseLabsTable_1 = require("../components/orders/InHouseLabsTable");
var inHouseLabsColumns = ['testType', 'orderAdded', 'provider', 'dx', 'status', 'actions'];
var InHouseLabsPage = function () {
    var navigate = (0, react_router_dom_1.useNavigate)();
    var appointmentId = (0, appointment_store_1.useAppointmentStore)(function (state) { var _a; return (_a = state.appointment) === null || _a === void 0 ? void 0 : _a.id; });
    var encounterId = (0, appointment_store_1.useAppointmentStore)(function (state) { var _a; return (_a = state.encounter) === null || _a === void 0 ? void 0 : _a.id; });
    var handleCreateOrder = (0, react_1.useCallback)(function () {
        if (!appointmentId) {
            console.error('No appointment ID found');
            return;
        }
        navigate((0, helpers_1.getInHouseLabOrderCreateUrl)(appointmentId));
    }, [navigate, appointmentId]);
    if (!appointmentId) {
        console.error('No appointment ID found');
        return null;
    }
    if (!encounterId) {
        console.error('No encounter ID found');
        return null;
    }
    return (<ListViewContainer_1.default>
      <>
        <material_1.Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <PageTitle_1.PageTitle label="In-House Labs" showIntakeNotesButton={false}/>
          <material_1.Stack direction="row" spacing={2} alignItems="center">
            <RoundedButton_1.ButtonRounded variant="contained" color="primary" size={'medium'} onClick={function () { return handleCreateOrder(); }} sx={{
            py: 1,
            px: 5,
        }}>
              Order
            </RoundedButton_1.ButtonRounded>
          </material_1.Stack>
        </material_1.Box>
        <InHouseLabsTable_1.InHouseLabsTable searchBy={{ searchBy: { field: 'encounterId', value: encounterId } }} columns={inHouseLabsColumns} showFilters={false} allowDelete={true} onCreateOrder={handleCreateOrder}/>
      </>
    </ListViewContainer_1.default>);
};
exports.InHouseLabsPage = InHouseLabsPage;
//# sourceMappingURL=InHouseLabsPage.js.map