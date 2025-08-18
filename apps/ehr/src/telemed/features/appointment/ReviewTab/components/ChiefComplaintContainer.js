"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChiefComplaintContainer = void 0;
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var featureFlags_1 = require("../../../../../features/css-module/context/featureFlags");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var ChiefComplaintContainer = function () {
    var _a, _b;
    var _c = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData', 'encounter']), chartData = _c.chartData, encounter = _c.encounter;
    var css = (0, featureFlags_1.useFeatureFlags)().css;
    var chiefComplaint = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.chiefComplaint) === null || _a === void 0 ? void 0 : _a.text;
    var addToVisitNote = (_b = chartData === null || chartData === void 0 ? void 0 : chartData.addToVisitNote) === null || _b === void 0 ? void 0 : _b.value;
    var spentTime = (0, utils_1.getSpentTime)(encounter.statusHistory);
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabChiefComplaintContainer}>
      <material_1.Typography variant="h5" color="primary.dark">
        Chief complaint & History of Present Illness
      </material_1.Typography>
      <material_1.Typography>{chiefComplaint}</material_1.Typography>
      {!css && addToVisitNote && spentTime && (<material_1.Typography variant="body2" color="secondary.light">
          Provider spent {spentTime} minutes on real-time audio & video with this patient
        </material_1.Typography>)}
    </material_1.Box>);
};
exports.ChiefComplaintContainer = ChiefComplaintContainer;
//# sourceMappingURL=ChiefComplaintContainer.js.map