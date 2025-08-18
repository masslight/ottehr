"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisitNoteCard = void 0;
var utils_1 = require("utils");
var constants_1 = require("../../../../constants");
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var components_1 = require("../../../components");
var hooks_1 = require("../../../hooks");
var state_1 = require("../../../state");
var components_2 = require("./components");
var VisitNoteCard = function () {
    var _a, _b, _c;
    var _d = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['encounter', 'chartData']), encounter = _d.encounter, chartData = _d.chartData;
    var chiefComplaint = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.chiefComplaint) === null || _a === void 0 ? void 0 : _a.text;
    var spentTime = (0, utils_1.getSpentTime)(encounter.statusHistory);
    var ros = (_b = chartData === null || chartData === void 0 ? void 0 : chartData.ros) === null || _b === void 0 ? void 0 : _b.text;
    var diagnoses = chartData === null || chartData === void 0 ? void 0 : chartData.diagnosis;
    var medicalDecision = (_c = chartData === null || chartData === void 0 ? void 0 : chartData.medicalDecision) === null || _c === void 0 ? void 0 : _c.text;
    var emCode = chartData === null || chartData === void 0 ? void 0 : chartData.emCode;
    var cptCodes = chartData === null || chartData === void 0 ? void 0 : chartData.cptCodes;
    var prescriptions = chartData === null || chartData === void 0 ? void 0 : chartData.prescribedMedications;
    var showChiefComplaint = !!((chiefComplaint && chiefComplaint.length > 0) || (spentTime && spentTime.length > 0));
    var showReviewOfSystems = !!(ros && ros.length > 0);
    var showAdditionalQuestions = constants_1.ADDITIONAL_QUESTIONS.some(function (question) {
        var _a, _b;
        var value = (_b = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _a === void 0 ? void 0 : _a.find(function (observation) { return observation.field === question.field; })) === null || _b === void 0 ? void 0 : _b.value;
        return value === true || value === false;
    });
    var showAssessment = !!(diagnoses && diagnoses.length > 0);
    var showMedicalDecisionMaking = !!(medicalDecision && medicalDecision.length > 0);
    var showEmCode = !!emCode;
    var showCptCodes = !!(cptCodes && cptCodes.length > 0);
    var showPrescribedMedications = !!(prescriptions && prescriptions.length > 0);
    var showPatientInstructions = (0, hooks_1.usePatientInstructionsVisibility)().showPatientInstructions;
    var sections = [
        <components_2.PatientInformationContainer />,
        <components_2.VisitDetailsContainer />,
        showChiefComplaint && <components_2.ChiefComplaintContainer />,
        showReviewOfSystems && <components_2.ReviewOfSystemsContainer />,
        <components_2.MedicationsContainer />,
        <components_2.AllergiesContainer />,
        <components_2.MedicalConditionsContainer />,
        <components_2.SurgicalHistoryContainer />,
        showAdditionalQuestions && <components_2.AdditionalQuestionsContainer />,
        <components_2.ExaminationContainer />,
        showAssessment && <components_2.AssessmentContainer />,
        showMedicalDecisionMaking && <components_2.MedicalDecisionMakingContainer />,
        showEmCode && <components_2.EMCodeContainer />,
        showCptCodes && <components_2.CPTCodesContainer />,
        showPrescribedMedications && <components_2.PrescribedMedicationsContainer />,
        showPatientInstructions && <components_2.PatientInstructionsContainer />,
        <components_2.PrivacyPolicyAcknowledgement />,
    ].filter(Boolean);
    return (<components_1.AccordionCard label="Visit note" dataTestId={data_test_ids_1.dataTestIds.progressNotePage.visitNoteCard}>
      <components_1.SectionList sections={sections} sx={{ p: 2 }}/>
    </components_1.AccordionCard>);
};
exports.VisitNoteCard = VisitNoteCard;
//# sourceMappingURL=VisitNoteCard.js.map