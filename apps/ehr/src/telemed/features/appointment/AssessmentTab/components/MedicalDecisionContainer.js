"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicalDecisionContainer = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var hooks_1 = require("../../../../hooks");
var state_1 = require("../../../../state");
var AssessmentTitle_1 = require("./AssessmentTitle");
var MedicalDecisionField_1 = require("./MedicalDecisionField");
var MedicalDecisionContainer = function () {
    var _a;
    var _b = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'chartData',
        'isChartDataLoading',
    ]), chartData = _b.chartData, isLoading = _b.isChartDataLoading;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var mdm = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.medicalDecision) === null || _a === void 0 ? void 0 : _a.text;
    var _c = (0, react_1.useState)(false), isUpdating = _c[0], setIsUpdating = _c[1];
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <material_1.Box sx={{ display: 'flex', gap: 1 }}>
        <AssessmentTitle_1.AssessmentTitle>Medical Decision Making</AssessmentTitle_1.AssessmentTitle>
        {(isUpdating || isLoading) && <material_1.CircularProgress size={16}/>}
      </material_1.Box>
      {isReadOnly ? (mdm ? (<material_1.Typography>{mdm}</material_1.Typography>) : (<material_1.Typography color="secondary.light">Not provided</material_1.Typography>)) : (<MedicalDecisionField_1.MedicalDecisionField loading={isLoading} setIsUpdating={setIsUpdating}/>)}
    </material_1.Box>);
};
exports.MedicalDecisionContainer = MedicalDecisionContainer;
//# sourceMappingURL=MedicalDecisionContainer.js.map