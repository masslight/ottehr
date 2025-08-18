"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewOfSystemsContainer = void 0;
var material_1 = require("@mui/material");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var ReviewOfSystemsContainer = function () {
    var _a;
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var ros = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.ros) === null || _a === void 0 ? void 0 : _a.text;
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabRosContainer}>
      <material_1.Typography variant="h5" color="primary.dark">
        Review of systems
      </material_1.Typography>
      <material_1.Typography>{ros}</material_1.Typography>
    </material_1.Box>);
};
exports.ReviewOfSystemsContainer = ReviewOfSystemsContainer;
//# sourceMappingURL=ReviewOfSystemsContainer.js.map