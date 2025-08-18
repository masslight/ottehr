"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Plan = void 0;
var material_1 = require("@mui/material");
var react_router_dom_1 = require("react-router-dom");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var PageTitle_1 = require("../../../telemed/components/PageTitle");
var PlanTab_1 = require("../../../telemed/features/appointment/PlanTab");
var CSSLoader_1 = require("../components/CSSLoader");
var useAppointment_1 = require("../hooks/useAppointment");
var Plan = function () {
    var appointmentID = (0, react_router_dom_1.useParams)().id;
    var _a = (0, useAppointment_1.useAppointment)(appointmentID), appointment = _a.resources.appointment, isLoading = _a.isLoading, error = _a.error;
    var isChartDataLoading = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['isChartDataLoading']).isChartDataLoading;
    if (isLoading || isChartDataLoading)
        return <CSSLoader_1.CSSLoader />;
    if (error)
        return <material_1.Typography>Error: {error.message}</material_1.Typography>;
    if (!appointment)
        return <material_1.Typography>No data available</material_1.Typography>;
    return (<material_1.Stack spacing={1}>
      <PageTitle_1.PageTitle label="Plan" showIntakeNotesButton={false}/>
      <PlanTab_1.PatientInstructionsCard />
      <PlanTab_1.DispositionCard />
      <PlanTab_1.SchoolWorkExcuseCard />
    </material_1.Stack>);
};
exports.Plan = Plan;
//# sourceMappingURL=Plan.js.map