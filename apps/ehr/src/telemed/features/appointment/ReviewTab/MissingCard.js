"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingCard = void 0;
var material_1 = require("@mui/material");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var featureFlags_1 = require("../../../../features/css-module/context/featureFlags");
var helpers_1 = require("../../../../features/css-module/routing/helpers");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var components_1 = require("../../../components");
var state_1 = require("../../../state");
var MissingCard = function () {
    var _a;
    var _b = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData', 'appointment']), chartData = _b.chartData, appointment = _b.appointment;
    var css = (0, featureFlags_1.useFeatureFlags)().css;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var primaryDiagnosis = ((chartData === null || chartData === void 0 ? void 0 : chartData.diagnosis) || []).find(function (item) { return item.isPrimary; });
    var medicalDecision = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.medicalDecision) === null || _a === void 0 ? void 0 : _a.text;
    var emCode = chartData === null || chartData === void 0 ? void 0 : chartData.emCode;
    if (primaryDiagnosis && medicalDecision && emCode) {
        return null;
    }
    var navigateToTab = function () {
        if (css) {
            requestAnimationFrame(function () {
                navigate((0, helpers_1.getAssessmentUrl)((appointment === null || appointment === void 0 ? void 0 : appointment.id) || ''));
            });
        }
        else {
            state_1.useAppointmentStore.setState({ currentTab: utils_1.TelemedAppointmentVisitTabs.assessment });
        }
    };
    return (<components_1.AccordionCard label="Missing" dataTestId={data_test_ids_1.dataTestIds.progressNotePage.missingCard}>
      <material_1.Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'start' }}>
        <material_1.Typography data-testid={data_test_ids_1.dataTestIds.progressNotePage.missingCardText}>
          This information is required to sign the chart. Please go to Assessment tab and complete it.
        </material_1.Typography>

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {!primaryDiagnosis && (<material_1.Link sx={{ cursor: 'pointer' }} color="error" onClick={navigateToTab} data-testid={data_test_ids_1.dataTestIds.progressNotePage.primaryDiagnosisLink}>
              Primary diagnosis
            </material_1.Link>)}
          {!medicalDecision && (<material_1.Link sx={{ cursor: 'pointer' }} color="error" onClick={navigateToTab} data-testid={data_test_ids_1.dataTestIds.progressNotePage.medicalDecisionLink}>
              Medical decision making
            </material_1.Link>)}
          {!emCode && (<material_1.Link sx={{ cursor: 'pointer' }} color="error" onClick={navigateToTab} data-testid={data_test_ids_1.dataTestIds.progressNotePage.emCodeLink}>
              E&M code
            </material_1.Link>)}
        </material_1.Box>
      </material_1.Box>
    </components_1.AccordionCard>);
};
exports.MissingCard = MissingCard;
//# sourceMappingURL=MissingCard.js.map