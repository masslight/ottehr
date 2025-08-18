"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssessmentContainer = void 0;
var material_1 = require("@mui/material");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var AssessmentTab_1 = require("../../AssessmentTab");
var AssessmentContainer = function () {
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var diagnoses = chartData === null || chartData === void 0 ? void 0 : chartData.diagnosis;
    var primaryDiagnosis = diagnoses === null || diagnoses === void 0 ? void 0 : diagnoses.find(function (item) { return item.isPrimary; });
    var otherDiagnoses = diagnoses === null || diagnoses === void 0 ? void 0 : diagnoses.filter(function (item) { return !item.isPrimary; });
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      <material_1.Typography variant="h5" color="primary.dark">
        Assessment
      </material_1.Typography>
      <>
        {primaryDiagnosis && (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <AssessmentTab_1.AssessmentTitle>Primary:</AssessmentTab_1.AssessmentTitle>
            <material_1.Typography>
              {primaryDiagnosis.display} {primaryDiagnosis.code}
            </material_1.Typography>
          </material_1.Box>)}
        {otherDiagnoses && otherDiagnoses.length > 0 && (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <AssessmentTab_1.AssessmentTitle>Secondary:</AssessmentTab_1.AssessmentTitle>
            {otherDiagnoses.map(function (diagnosis) { return (<material_1.Typography key={diagnosis.resourceId}>
                {diagnosis.display} {diagnosis.code}
              </material_1.Typography>); })}
          </material_1.Box>)}
      </>
    </material_1.Box>);
};
exports.AssessmentContainer = AssessmentContainer;
//# sourceMappingURL=AssessmentContainer.js.map