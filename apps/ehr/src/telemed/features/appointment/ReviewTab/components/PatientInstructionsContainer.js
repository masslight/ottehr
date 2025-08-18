"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientInstructionsContainer = void 0;
var material_1 = require("@mui/material");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var utils_2 = require("utils");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var components_1 = require("../../../../components");
var hooks_1 = require("../../../../hooks");
var state_1 = require("../../../../state");
var AssessmentTab_1 = require("../../AssessmentTab");
var PatientInstructionsContainer = function () {
    var _a, _b, _c;
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var instructions = chartData === null || chartData === void 0 ? void 0 : chartData.instructions;
    var disposition = chartData === null || chartData === void 0 ? void 0 : chartData.disposition;
    var schoolWorkExcuses = (0, hooks_1.useExcusePresignedFiles)(chartData === null || chartData === void 0 ? void 0 : chartData.schoolWorkNotes);
    var _d = (0, hooks_1.usePatientInstructionsVisibility)(), showInstructions = _d.showInstructions, showDischargeInstructions = _d.showDischargeInstructions, showFollowUp = _d.showFollowUp, showSchoolWorkExcuse = _d.showSchoolWorkExcuse;
    var sections = [
        showInstructions && (<>
        <AssessmentTab_1.AssessmentTitle>Patient instructions</AssessmentTab_1.AssessmentTitle>
        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {instructions === null || instructions === void 0 ? void 0 : instructions.map(function (instruction) { return (<material_1.Typography key={instruction.resourceId} style={{ whiteSpace: 'pre-line' }}>
              {instruction.text}
            </material_1.Typography>); })}
        </material_1.Box>
      </>),
        showDischargeInstructions && (<>
        <AssessmentTab_1.AssessmentTitle>
          Disposition - {(disposition === null || disposition === void 0 ? void 0 : disposition.type) ? utils_1.mapDispositionTypeToLabel[disposition.type] : 'Not provided'}
        </AssessmentTab_1.AssessmentTitle>
        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {(disposition === null || disposition === void 0 ? void 0 : disposition.note) && <material_1.Typography>{disposition === null || disposition === void 0 ? void 0 : disposition.note}</material_1.Typography>}
          {(disposition === null || disposition === void 0 ? void 0 : disposition[utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD]) && <material_1.Typography>{utils_1.NOTHING_TO_EAT_OR_DRINK_LABEL}</material_1.Typography>}
          {(disposition === null || disposition === void 0 ? void 0 : disposition.labService) && disposition.labService.length > 0 && (<material_1.Typography>Lab Services: {disposition.labService.join(', ')}</material_1.Typography>)}

          {(disposition === null || disposition === void 0 ? void 0 : disposition.virusTest) && disposition.virusTest.length > 0 && (<material_1.Typography>Virus Tests: {disposition.virusTest.join(', ')}</material_1.Typography>)}

          {typeof (disposition === null || disposition === void 0 ? void 0 : disposition.followUpIn) === 'number' && (<material_1.Typography>
              Follow-up visit{' '}
              {disposition.followUpIn === 0
                    ? (_a = utils_2.followUpInOptions.find(function (option) { return option.value === disposition.followUpIn; })) === null || _a === void 0 ? void 0 : _a.label
                    : "in ".concat((_b = utils_2.followUpInOptions.find(function (option) { return option.value === disposition.followUpIn; })) === null || _b === void 0 ? void 0 : _b.label)}
            </material_1.Typography>)}

          {(disposition === null || disposition === void 0 ? void 0 : disposition.reason) && disposition.reason.length > 0 && (<material_1.Typography>Reason for transfer: {disposition.reason}</material_1.Typography>)}
        </material_1.Box>
      </>),
        showFollowUp && (<>
        <AssessmentTab_1.AssessmentTitle>Subspecialty follow-up</AssessmentTab_1.AssessmentTitle>
        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {(_c = disposition === null || disposition === void 0 ? void 0 : disposition.followUp) === null || _c === void 0 ? void 0 : _c.map(function (followUp) {
                var display = utils_1.dispositionCheckboxOptions.find(function (option) { return option.name === followUp.type; }).label;
                var note = '';
                if (followUp.type === 'other') {
                    note = ": ".concat(followUp.note);
                }
                return <material_1.Typography key={followUp.type}>{"".concat(display).concat(note)}</material_1.Typography>;
            })}
        </material_1.Box>
      </>),
        showSchoolWorkExcuse && (<>
        <AssessmentTab_1.AssessmentTitle>School / Work Excuse</AssessmentTab_1.AssessmentTitle>
        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {schoolWorkExcuses.map(function (excuse) { return (<material_1.Link component={react_router_dom_1.Link} to={excuse.presignedUrl} target="_blank" key={excuse.id}>
              {excuse.name}
            </material_1.Link>); })}
        </material_1.Box>
      </>),
    ].filter(Boolean);
    return (<material_1.Box data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabPatientInstructionsContainer}>
      <material_1.Typography variant="h5" color="primary.dark">
        Plan
      </material_1.Typography>

      <components_1.SectionList sections={sections} sx={{ width: '100%' }}/>
    </material_1.Box>);
};
exports.PatientInstructionsContainer = PatientInstructionsContainer;
//# sourceMappingURL=PatientInstructionsContainer.js.map