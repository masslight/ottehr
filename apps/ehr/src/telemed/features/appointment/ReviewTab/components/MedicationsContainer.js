"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationsContainer = void 0;
var material_1 = require("@mui/material");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var AssessmentTitle_1 = require("../../AssessmentTab/components/AssessmentTitle");
var MedicationsContainer = function (_a) {
    var notes = _a.notes;
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var theme = (0, material_1.useTheme)();
    var medications = chartData === null || chartData === void 0 ? void 0 : chartData.medications;
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer}>
      <material_1.Typography variant="h5" color="primary.dark">
        Medications
      </material_1.Typography>
      {(medications === null || medications === void 0 ? void 0 : medications.length) ? (medications.map(function (medication) { return <material_1.Typography key={medication.resourceId}>{medication.name}</material_1.Typography>; })) : (<material_1.Typography color={theme.palette.text.secondary}>No current medications</material_1.Typography>)}

      {notes && notes.length > 0 && (<>
          <AssessmentTitle_1.AssessmentTitle>Medications notes</AssessmentTitle_1.AssessmentTitle>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {notes === null || notes === void 0 ? void 0 : notes.map(function (note) { return <material_1.Typography key={note.resourceId}>{note.text}</material_1.Typography>; })}
          </material_1.Box>
        </>)}
    </material_1.Box>);
};
exports.MedicationsContainer = MedicationsContainer;
//# sourceMappingURL=MedicationsContainer.js.map