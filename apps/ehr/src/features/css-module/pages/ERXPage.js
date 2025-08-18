"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERXPage = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var PlanTab_1 = require("../../../telemed/features/appointment/PlanTab");
var CSSLoader_1 = require("../components/CSSLoader");
var useAppointment_1 = require("../hooks/useAppointment");
var ERXPage = function () {
    var appointmentID = (0, react_router_dom_1.useParams)().id;
    var _a = (0, useAppointment_1.useAppointment)(appointmentID), appointment = _a.resources.appointment, isLoading = _a.isLoading, error = _a.error;
    var isChartDataLoading = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['isChartDataLoading']).isChartDataLoading;
    if (isLoading || isChartDataLoading)
        return <CSSLoader_1.CSSLoader />;
    if (error)
        return <material_1.Typography>Error: {error.message}</material_1.Typography>;
    if (!appointment)
        return <material_1.Typography>No data available</material_1.Typography>;
    return (<material_1.Stack spacing={1} sx={{ flex: '1 0 auto' }}>
      <PlanTab_1.ERxContainer />
    </material_1.Stack>);
};
exports.ERXPage = ERXPage;
//# sourceMappingURL=ERXPage.js.map