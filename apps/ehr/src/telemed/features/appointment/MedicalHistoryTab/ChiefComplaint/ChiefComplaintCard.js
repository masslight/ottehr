"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChiefComplaintCard = void 0;
var react_1 = require("react");
var featureFlags_1 = require("../../../../../features/css-module/context/featureFlags");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var hooks_1 = require("../../../../hooks");
var state_1 = require("../../../../state");
var MedicalHistoryDoubleCard_1 = require("../MedicalHistoryDoubleCard");
var ChiefComplaintPatientColumn_1 = require("./ChiefComplaintPatientColumn");
var ChiefComplaintProviderColumn_1 = require("./ChiefComplaintProviderColumn");
var ChiefComplaintCard = function () {
    var _a = (0, react_1.useState)(false), isHPICollapsed = _a[0], setIsHPICollapsed = _a[1];
    var isChartDataLoading = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['isChartDataLoading']).isChartDataLoading;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var css = (0, featureFlags_1.useFeatureFlags)().css;
    return (<MedicalHistoryDoubleCard_1.MedicalHistoryDoubleCard label="Chief complaint & HPI" collapsed={css ? undefined : isHPICollapsed} onSwitch={css ? undefined : function () { return setIsHPICollapsed(function (state) { return !state; }); }} patientSide={<ChiefComplaintPatientColumn_1.ChiefComplaintPatientColumn />} providerSide={isChartDataLoading ? (<ChiefComplaintProviderColumn_1.ChiefComplaintProviderColumnSkeleton />) : isReadOnly ? (<ChiefComplaintProviderColumn_1.ChiefComplaintProviderColumnReadOnly />) : (<ChiefComplaintProviderColumn_1.ChiefComplaintProviderColumn />)}/>);
};
exports.ChiefComplaintCard = ChiefComplaintCard;
//# sourceMappingURL=ChiefComplaintCard.js.map