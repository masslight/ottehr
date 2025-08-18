"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurgicalHistoryContainer = void 0;
var material_1 = require("@mui/material");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var AssessmentTitle_1 = require("../../AssessmentTab/components/AssessmentTitle");
var SurgicalHistoryContainer = function (_a) {
    var _b;
    var notes = _a.notes;
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var theme = (0, material_1.useTheme)();
    var procedures = chartData === null || chartData === void 0 ? void 0 : chartData.surgicalHistory;
    var surgicalHistoryNote = (_b = chartData === null || chartData === void 0 ? void 0 : chartData.surgicalHistoryNote) === null || _b === void 0 ? void 0 : _b.text;
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabSurgicalHistoryContainer}>
      <material_1.Typography variant="h5" color="primary.dark">
        Surgical history
      </material_1.Typography>
      {(procedures === null || procedures === void 0 ? void 0 : procedures.length) ? (procedures.map(function (procedure) { return (<material_1.Typography key={procedure.resourceId}>
            {procedure.code} {procedure.display}
          </material_1.Typography>); })) : (<material_1.Typography color={theme.palette.text.secondary}>No surgical history</material_1.Typography>)}
      {surgicalHistoryNote && <material_1.Typography>{surgicalHistoryNote}</material_1.Typography>}

      {notes && notes.length > 0 && (<>
          <AssessmentTitle_1.AssessmentTitle>Surgical history notes</AssessmentTitle_1.AssessmentTitle>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {notes === null || notes === void 0 ? void 0 : notes.map(function (note) { return <material_1.Typography key={note.resourceId}>{note.text}</material_1.Typography>; })}
          </material_1.Box>
        </>)}
    </material_1.Box>);
};
exports.SurgicalHistoryContainer = SurgicalHistoryContainer;
//# sourceMappingURL=SurgicalHistoryContainer.js.map