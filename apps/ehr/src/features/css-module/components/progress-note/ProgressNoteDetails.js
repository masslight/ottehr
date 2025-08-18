"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressNoteDetails = void 0;
var material_1 = require("@mui/material");
var ProceduresContainer_1 = require("src/telemed/features/appointment/ReviewTab/components/ProceduresContainer");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var telemed_1 = require("../../../../telemed");
var ReviewTab_1 = require("../../../../telemed/features/appointment/ReviewTab");
var useChartData_1 = require("../../hooks/useChartData");
var useMedicationOperations_1 = require("../../hooks/useMedicationOperations");
var ExamReadOnly_1 = require("../examination/ExamReadOnly");
var HospitalizationContainer_1 = require("./HospitalizationContainer");
var InHouseMedicationsContainer_1 = require("./InHouseMedicationsContainer");
var PatientVitalsContainer_1 = require("./PatientVitalsContainer");
var RadiologyContainer_1 = require("./RadiologyContainer");
var ProgressNoteDetails = function () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    var _p = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, [
        'chartData',
        'encounter',
        'setPartialChartData',
    ]), chartData = _p.chartData, encounter = _p.encounter, setPartialChartData = _p.setPartialChartData;
    var additionalChartData = (0, useChartData_1.useChartData)({
        encounterId: encounter.id || '',
        requestedFields: (0, utils_1.getProgressNoteChartDataRequestedFields)(),
        onSuccess: function (data) {
            setPartialChartData({
                episodeOfCare: data === null || data === void 0 ? void 0 : data.episodeOfCare,
                vitalsObservations: data === null || data === void 0 ? void 0 : data.vitalsObservations,
                prescribedMedications: data === null || data === void 0 ? void 0 : data.prescribedMedications,
                externalLabResults: data === null || data === void 0 ? void 0 : data.externalLabResults,
                inHouseLabResults: data === null || data === void 0 ? void 0 : data.inHouseLabResults,
                disposition: data === null || data === void 0 ? void 0 : data.disposition,
                medicalDecision: data === null || data === void 0 ? void 0 : data.medicalDecision,
            });
        },
    }).chartData;
    var inHouseMedicationsWithCanceled = (0, useMedicationOperations_1.useMedicationAPI)().medications;
    var inHouseMedications = inHouseMedicationsWithCanceled.filter(function (medication) { return medication.status !== 'cancelled'; });
    var screeningNotes = (_a = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _a === void 0 ? void 0 : _a.filter(function (note) { return note.type === utils_1.NOTE_TYPE.SCREENING; });
    var vitalsNotes = (_b = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _b === void 0 ? void 0 : _b.filter(function (note) { return note.type === utils_1.NOTE_TYPE.VITALS; });
    var allergyNotes = (_c = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _c === void 0 ? void 0 : _c.filter(function (note) { return note.type === utils_1.NOTE_TYPE.ALLERGY; });
    var intakeMedicationNotes = (_d = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _d === void 0 ? void 0 : _d.filter(function (note) { return note.type === utils_1.NOTE_TYPE.INTAKE_MEDICATION; });
    var hospitalizationNotes = (_e = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _e === void 0 ? void 0 : _e.filter(function (note) { return note.type === utils_1.NOTE_TYPE.HOSPITALIZATION; });
    var medicalConditionNotes = (_f = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _f === void 0 ? void 0 : _f.filter(function (note) { return note.type === utils_1.NOTE_TYPE.MEDICAL_CONDITION; });
    var surgicalHistoryNotes = (_g = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _g === void 0 ? void 0 : _g.filter(function (note) { return note.type === utils_1.NOTE_TYPE.SURGICAL_HISTORY; });
    var inHouseMedicationNotes = (_h = additionalChartData === null || additionalChartData === void 0 ? void 0 : additionalChartData.notes) === null || _h === void 0 ? void 0 : _h.filter(function (note) { return note.type === utils_1.NOTE_TYPE.MEDICATION; });
    var chiefComplaint = (_j = chartData === null || chartData === void 0 ? void 0 : chartData.chiefComplaint) === null || _j === void 0 ? void 0 : _j.text;
    var ros = (_k = chartData === null || chartData === void 0 ? void 0 : chartData.ros) === null || _k === void 0 ? void 0 : _k.text;
    var diagnoses = chartData === null || chartData === void 0 ? void 0 : chartData.diagnosis;
    var medicalDecision = (_l = chartData === null || chartData === void 0 ? void 0 : chartData.medicalDecision) === null || _l === void 0 ? void 0 : _l.text;
    var emCode = chartData === null || chartData === void 0 ? void 0 : chartData.emCode;
    var cptCodes = chartData === null || chartData === void 0 ? void 0 : chartData.cptCodes;
    var prescriptions = chartData === null || chartData === void 0 ? void 0 : chartData.prescribedMedications;
    var observations = chartData === null || chartData === void 0 ? void 0 : chartData.observations;
    var vitalsObservations = chartData === null || chartData === void 0 ? void 0 : chartData.vitalsObservations;
    var externalLabResults = chartData === null || chartData === void 0 ? void 0 : chartData.externalLabResults;
    var inHouseLabResults = chartData === null || chartData === void 0 ? void 0 : chartData.inHouseLabResults;
    var showChiefComplaint = !!(chiefComplaint && chiefComplaint.length > 0);
    var showReviewOfSystems = !!(ros && ros.length > 0);
    var showAdditionalQuestions = !!(observations && observations.length > 0) || !!(screeningNotes && screeningNotes.length > 0);
    var showAssessment = !!(diagnoses && diagnoses.length > 0);
    var showMedicalDecisionMaking = !!(medicalDecision && medicalDecision.length > 0);
    var showEmCode = !!emCode;
    var showCptCodes = !!(cptCodes && cptCodes.length > 0);
    var showExternalLabsResultsContainer = !!((externalLabResults === null || externalLabResults === void 0 ? void 0 : externalLabResults.resultsPending) ||
        ((externalLabResults === null || externalLabResults === void 0 ? void 0 : externalLabResults.labOrderResults) && (externalLabResults === null || externalLabResults === void 0 ? void 0 : externalLabResults.labOrderResults.length) > 0));
    var showInHouseLabsResultsContainer = !!((inHouseLabResults === null || inHouseLabResults === void 0 ? void 0 : inHouseLabResults.resultsPending) ||
        ((inHouseLabResults === null || inHouseLabResults === void 0 ? void 0 : inHouseLabResults.labOrderResults) && (inHouseLabResults === null || inHouseLabResults === void 0 ? void 0 : inHouseLabResults.labOrderResults.length) > 0));
    var showProceduresContainer = ((_o = (_m = chartData === null || chartData === void 0 ? void 0 : chartData.procedures) === null || _m === void 0 ? void 0 : _m.length) !== null && _o !== void 0 ? _o : 0) > 0;
    var showPrescribedMedications = !!(prescriptions && prescriptions.length > 0);
    var showPatientInstructions = (0, telemed_1.usePatientInstructionsVisibility)().showPatientInstructions;
    var showInHouseMedications = !!(inHouseMedications && inHouseMedications.length > 0) ||
        !!(inHouseMedicationNotes && inHouseMedicationNotes.length > 0);
    var showVitalsObservations = !!(vitalsObservations && vitalsObservations.length > 0) || !!(vitalsNotes && vitalsNotes.length > 0);
    var sections = [
        showChiefComplaint && <ReviewTab_1.ChiefComplaintContainer />,
        showReviewOfSystems && <ReviewTab_1.ReviewOfSystemsContainer />,
        showAdditionalQuestions && <ReviewTab_1.AdditionalQuestionsContainer notes={screeningNotes}/>,
        showVitalsObservations && <PatientVitalsContainer_1.PatientVitalsContainer notes={vitalsNotes} encounterId={encounter === null || encounter === void 0 ? void 0 : encounter.id}/>,
        <material_1.Stack spacing={1}>
      <material_1.Typography variant="h5" color="primary.dark">
        Examination
      </material_1.Typography>
      <ExamReadOnly_1.ExamReadOnlyBlock />
    </material_1.Stack>,
        <ReviewTab_1.AllergiesContainer notes={allergyNotes}/>,
        <ReviewTab_1.MedicationsContainer notes={intakeMedicationNotes}/>,
        <ReviewTab_1.MedicalConditionsContainer notes={medicalConditionNotes}/>,
        <ReviewTab_1.SurgicalHistoryContainer notes={surgicalHistoryNotes}/>,
        <HospitalizationContainer_1.HospitalizationContainer notes={hospitalizationNotes}/>,
        showInHouseMedications && (<InHouseMedicationsContainer_1.InHouseMedicationsContainer medications={inHouseMedications} notes={inHouseMedicationNotes}/>),
        showAssessment && <ReviewTab_1.AssessmentContainer />,
        showMedicalDecisionMaking && <ReviewTab_1.MedicalDecisionMakingContainer />,
        showEmCode && <ReviewTab_1.EMCodeContainer />,
        showCptCodes && <ReviewTab_1.CPTCodesContainer />,
        showInHouseLabsResultsContainer && (<ReviewTab_1.LabResultsReviewContainer resultDetails={{ type: utils_1.LabType.inHouse, results: inHouseLabResults.labOrderResults }} resultsPending={inHouseLabResults.resultsPending}/>),
        showExternalLabsResultsContainer && (<ReviewTab_1.LabResultsReviewContainer resultDetails={{ type: utils_1.LabType.external, results: externalLabResults.labOrderResults }} resultsPending={externalLabResults.resultsPending}/>),
        <RadiologyContainer_1.RadiologyContainer />,
        showProceduresContainer && <ProceduresContainer_1.ProceduresContainer />,
        showPrescribedMedications && <ReviewTab_1.PrescribedMedicationsContainer />,
        showPatientInstructions && <ReviewTab_1.PatientInstructionsContainer />,
        <ReviewTab_1.PrivacyPolicyAcknowledgement />,
    ].filter(Boolean);
    return (<telemed_1.AccordionCard label="Objective" dataTestId={data_test_ids_1.dataTestIds.progressNotePage.visitNoteCard}>
      <telemed_1.SectionList sections={sections} sx={{ p: 2 }}/>
    </telemed_1.AccordionCard>);
};
exports.ProgressNoteDetails = ProgressNoteDetails;
//# sourceMappingURL=ProgressNoteDetails.js.map