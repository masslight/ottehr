"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalLabOrdersListPage = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var PageTitle_1 = require("../../../telemed/components/PageTitle");
var appointment_store_1 = require("../../../telemed/state/appointment/appointment.store");
var ListViewContainer_1 = require("../../common/ListViewContainer");
var RoundedButton_1 = require("../../css-module/components/RoundedButton");
var LabsTable_1 = require("../components/labs-orders/LabsTable");
var externalLabsColumns = ['testType', 'orderAdded', 'provider', 'dx', 'status', 'psc', 'actions'];
var ExternalLabOrdersListPage = function () {
    var navigate = (0, react_router_dom_1.useNavigate)();
    var encounterId = (0, appointment_store_1.useAppointmentStore)(function (state) { var _a; return (_a = state.encounter) === null || _a === void 0 ? void 0 : _a.id; });
    var handleCreateOrder = (0, react_1.useCallback)(function () {
        navigate("create");
    }, [navigate]);
    if (!encounterId) {
        console.error('No encounter ID found');
        return null;
    }
    return (<ListViewContainer_1.default>
      <material_1.Box>
        <material_1.Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <PageTitle_1.PageTitle label="External Labs" showIntakeNotesButton={false}/>
          <material_1.Stack direction="row" spacing={2} alignItems="center">
            <RoundedButton_1.ButtonRounded variant="contained" color="primary" size={'medium'} onClick={function () { return handleCreateOrder(); }} sx={{
            py: 1,
            px: 5,
        }}>
              Order
            </RoundedButton_1.ButtonRounded>
          </material_1.Stack>
        </material_1.Box>
        <LabsTable_1.LabsTable searchBy={{ searchBy: { field: 'encounterId', value: encounterId } }} columns={externalLabsColumns} showFilters={false} allowDelete={true} onCreateOrder={handleCreateOrder}/>
      </material_1.Box>
    </ListViewContainer_1.default>);
};
exports.ExternalLabOrdersListPage = ExternalLabOrdersListPage;
//# sourceMappingURL=ExternalLabOrdersListPage.js.map