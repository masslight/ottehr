"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicalConditionsPatientColumn = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var AiSuggestion_1 = require("../../../../../components/AiSuggestion");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var PatientSideListSkeleton_1 = require("../PatientSideListSkeleton");
var MedicalConditionsPatientColumn = function () {
    var _a, _b, _c, _d;
    var theme = (0, material_1.useTheme)();
    var _e = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'questionnaireResponse',
        'isAppointmentLoading',
        'chartData',
    ]), questionnaireResponse = _e.questionnaireResponse, isAppointmentLoading = _e.isAppointmentLoading, chartData = _e.chartData;
    var medicalConditions = (_c = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('medical-history', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueArray;
    var aiPastMedicalHistory = (_d = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _d === void 0 ? void 0 : _d.find(function (observation) { return observation.field === utils_1.AiObservationField.PastMedicalHistory; });
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionPatientProvidedList}>
      {isAppointmentLoading ? (<PatientSideListSkeleton_1.PatientSideListSkeleton />) : medicalConditions ? (medicalConditions.map(function (answer, index, arr) { return (<material_1.Box key={index}>
            <material_1.Typography>{answer['medical-history-form-medical-condition']}</material_1.Typography>
            {index + 1 !== arr.length && <material_1.Divider sx={{ pt: 1 }}/>}
          </material_1.Box>); })) : (<material_1.Typography color={theme.palette.text.secondary}>Patient has no medical conditions</material_1.Typography>)}
      {aiPastMedicalHistory ? (<>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }}/>
          <AiSuggestion_1.default title={'Past Medical History (PMH)'} content={aiPastMedicalHistory.value}/>
        </>) : undefined}
    </material_1.Box>);
};
exports.MedicalConditionsPatientColumn = MedicalConditionsPatientColumn;
//# sourceMappingURL=MedicalConditionsPatientColumn.js.map