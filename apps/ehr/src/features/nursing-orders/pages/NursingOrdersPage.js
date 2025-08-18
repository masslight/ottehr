"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NursingOrdersPage = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var helpers_1 = require("src/features/css-module/routing/helpers");
var PageTitle_1 = require("../../../telemed/components/PageTitle");
var appointment_store_1 = require("../../../telemed/state/appointment/appointment.store");
var RoundedButton_1 = require("../../css-module/components/RoundedButton");
var NursingOrdersTable_1 = require("../components/orders/NursingOrdersTable");
var nursingOrdersColumns = ['order', 'orderAdded', 'status'];
var NursingOrdersPage = function () {
    var navigate = (0, react_router_dom_1.useNavigate)();
    var appointmentId = (0, appointment_store_1.useAppointmentStore)(function (state) { var _a; return (_a = state.appointment) === null || _a === void 0 ? void 0 : _a.id; });
    var encounterId = (0, appointment_store_1.useAppointmentStore)(function (state) { var _a; return (_a = state.encounter) === null || _a === void 0 ? void 0 : _a.id; });
    var handleCreateOrder = (0, react_1.useCallback)(function () {
        if (!appointmentId) {
            console.error('No appointment ID found');
            return;
        }
        navigate((0, helpers_1.getNursingOrderCreateUrl)(appointmentId));
    }, [navigate, appointmentId]);
    if (!appointmentId || !encounterId) {
        return null;
    }
    return (<material_1.Box>
      <material_1.Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <PageTitle_1.PageTitle label="Nursing Orders" showIntakeNotesButton={false}/>
        <material_1.Stack direction="row" spacing={2} alignItems="center">
          <RoundedButton_1.ButtonRounded variant="contained" color="primary" size={'medium'} onClick={function () { return handleCreateOrder(); }} sx={{
            py: 1,
            px: 5,
        }}>
            Order
          </RoundedButton_1.ButtonRounded>
        </material_1.Stack>
      </material_1.Box>
      <NursingOrdersTable_1.NursingOrdersTable columns={nursingOrdersColumns} searchBy={{ field: 'encounterId', value: encounterId }} appointmentId={appointmentId} allowDelete={true}/>
    </material_1.Box>);
};
exports.NursingOrdersPage = NursingOrdersPage;
//# sourceMappingURL=NursingOrdersPage.js.map