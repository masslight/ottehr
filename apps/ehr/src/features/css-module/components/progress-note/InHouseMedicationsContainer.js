"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InHouseMedicationsContainer = void 0;
var material_1 = require("@mui/material");
var AssessmentTitle_1 = require("src/telemed/features/appointment/AssessmentTab/components/AssessmentTitle");
var utils_1 = require("utils");
var InHouseMedicationsContainer = function (_a) {
    var medications = _a.medications, notes = _a.notes;
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <material_1.Typography variant="h5" color="primary.dark">
        In-House Medications
      </material_1.Typography>
      {medications.map(function (item) { return (<material_1.Typography key={item.id}>{(0, utils_1.createMedicationString)(item)}</material_1.Typography>); })}

      {notes && notes.length > 0 && (<>
          <AssessmentTitle_1.AssessmentTitle>In-House Medications notes</AssessmentTitle_1.AssessmentTitle>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {notes === null || notes === void 0 ? void 0 : notes.map(function (note) { return <material_1.Typography key={note.resourceId}>{note.text}</material_1.Typography>; })}
          </material_1.Box>
        </>)}
    </material_1.Box>);
};
exports.InHouseMedicationsContainer = InHouseMedicationsContainer;
//# sourceMappingURL=InHouseMedicationsContainer.js.map