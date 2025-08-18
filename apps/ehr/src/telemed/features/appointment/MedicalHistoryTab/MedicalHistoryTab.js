"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicalHistoryTab = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var AdditionalQuestions_1 = require("./AdditionalQuestions");
var ChiefComplaint_1 = require("./ChiefComplaint");
var CurrentMedications_1 = require("./CurrentMedications");
var KnownAllergies_1 = require("./KnownAllergies");
var MedicalConditions_1 = require("./MedicalConditions");
var SurgicalHistory_1 = require("./SurgicalHistory");
var MedicalHistoryTab = function () {
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }}>
      <MedicalConditions_1.MedicalConditionsCard />
      <CurrentMedications_1.CurrentMedicationsCard />
      <KnownAllergies_1.KnownAllergiesCard />
      <SurgicalHistory_1.SurgicalHistoryCard />
      <AdditionalQuestions_1.AdditionalQuestionsCard />
      <ChiefComplaint_1.ChiefComplaintCard />
    </material_1.Box>);
};
exports.MedicalHistoryTab = MedicalHistoryTab;
//# sourceMappingURL=MedicalHistoryTab.js.map