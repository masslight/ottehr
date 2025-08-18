"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentTabs = void 0;
var lab_1 = require("@mui/lab");
var react_1 = require("react");
var NavigationContext_1 = require("src/features/css-module/context/NavigationContext");
var utils_1 = require("utils");
var useChartData_1 = require("../../../features/css-module/hooks/useChartData");
var OttehrAi_1 = require("../../../features/css-module/pages/OttehrAi");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var useExamObservations_1 = require("../../hooks/useExamObservations");
var state_1 = require("../../state");
var AssessmentTab_1 = require("./AssessmentTab");
var ExamTab_1 = require("./ExamTab");
var MedicalHistoryTab_1 = require("./MedicalHistoryTab");
var PlanTab_1 = require("./PlanTab");
var ReviewTab_1 = require("./ReviewTab");
var VitalsTab_1 = require("./VitalsTab");
var AppointmentTabs = function () {
    var isInitialLoad = (0, react_1.useRef)(true);
    var _a = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'currentTab',
        'encounter',
        'chartData',
    ]), currentTab = _a.currentTab, encounter = _a.encounter, chartData = _a.chartData;
    var update = (0, useExamObservations_1.useExamObservations)().update;
    (0, useChartData_1.useChartData)({
        encounterId: encounter.id,
        onSuccess: function (data) {
            state_1.useAppointmentStore.setState({ chartData: __assign(__assign({}, chartData), data) });
            update(data.examObservations, true);
            isInitialLoad.current = false;
        },
        onError: function (error) {
            console.error(error);
        },
        enabled: isInitialLoad.current,
    });
    return (
    // temporary navigation provider for vitals to work
    <NavigationContext_1.NavigationProvider>
      <lab_1.TabContext value={currentTab}>
        <lab_1.TabPanel value={utils_1.TelemedAppointmentVisitTabs.hpi} sx={{ p: 0 }}>
          <MedicalHistoryTab_1.MedicalHistoryTab />
        </lab_1.TabPanel>
        <lab_1.TabPanel value={utils_1.TelemedAppointmentVisitTabs.vitals} sx={{ p: 0 }}>
          <VitalsTab_1.VitalsTab />
        </lab_1.TabPanel>
        <lab_1.TabPanel value={utils_1.TelemedAppointmentVisitTabs.exam} sx={{ p: 0 }}>
          <ExamTab_1.ExamTab />
        </lab_1.TabPanel>
        <lab_1.TabPanel value={utils_1.TelemedAppointmentVisitTabs.assessment} sx={{ p: 0 }}>
          <AssessmentTab_1.AssessmentTab />
        </lab_1.TabPanel>
        <lab_1.TabPanel value={utils_1.TelemedAppointmentVisitTabs.plan} sx={{ p: 0 }}>
          <PlanTab_1.PlanTab />
        </lab_1.TabPanel>
        <lab_1.TabPanel value={utils_1.TelemedAppointmentVisitTabs.sign} sx={{ p: 0 }}>
          <ReviewTab_1.ReviewTab />
        </lab_1.TabPanel>
        {(chartData === null || chartData === void 0 ? void 0 : chartData.aiChat) != null ? (<lab_1.TabPanel value={utils_1.TelemedAppointmentVisitTabs.ottehrai} sx={{ p: 0 }}>
            <OttehrAi_1.OttehrAi />
          </lab_1.TabPanel>) : undefined}
      </lab_1.TabContext>
    </NavigationContext_1.NavigationProvider>);
};
exports.AppointmentTabs = AppointmentTabs;
//# sourceMappingURL=AppointmentTabs.js.map