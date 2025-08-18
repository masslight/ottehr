"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RadiologyOrdersListPage = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var PageTitle_1 = require("src/telemed/components/PageTitle");
var appointment_store_1 = require("../../../telemed/state/appointment/appointment.store");
var RadiologyTable_1 = require("../components/RadiologyTable");
var radiologyColumns = ['studyType', 'dx', 'ordered', 'stat', 'status', 'actions'];
var RadiologyOrdersListPage = function () {
    var navigate = (0, react_router_dom_1.useNavigate)();
    var encounterId = (0, appointment_store_1.useAppointmentStore)(function (state) { var _a; return (_a = state.encounter) === null || _a === void 0 ? void 0 : _a.id; });
    var handleCreateOrder = (0, react_1.useCallback)(function () {
        navigate('create');
    }, [navigate]);
    return (<material_1.Stack spacing={2}>
      <material_1.Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <PageTitle_1.PageTitle label="Radiology" showIntakeNotesButton={false}/>
        <material_1.Stack direction="row" spacing={2} alignItems="center">
          <material_1.Button onClick={handleCreateOrder} variant="contained" sx={{
            textTransform: 'none',
            borderRadius: 28,
            fontWeight: 'bold',
            width: 120,
        }}>
            Order
          </material_1.Button>
        </material_1.Stack>
      </material_1.Box>
      <RadiologyTable_1.RadiologyTable encounterId={encounterId} columns={radiologyColumns} showFilters={false} allowDelete={true} onCreateOrder={handleCreateOrder}/>
    </material_1.Stack>);
};
exports.RadiologyOrdersListPage = RadiologyOrdersListPage;
//# sourceMappingURL=RadiologyOrdersListPage.js.map