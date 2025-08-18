"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicalDecisionMakingContainer = void 0;
var material_1 = require("@mui/material");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var MedicalDecisionMakingContainer = function () {
    var _a;
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var medicalDecision = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.medicalDecision) === null || _a === void 0 ? void 0 : _a.text;
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <material_1.Typography variant="h5" color="primary.dark">
        Medical Decision Making
      </material_1.Typography>
      <material_1.Typography>{medicalDecision}</material_1.Typography>
    </material_1.Box>);
};
exports.MedicalDecisionMakingContainer = MedicalDecisionMakingContainer;
//# sourceMappingURL=MedicalDecisionMakingContainer.js.map