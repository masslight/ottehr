"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentMedicationsPatientColumn = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var AiSuggestion_1 = require("../../../../../components/AiSuggestion");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var PatientSideListSkeleton_1 = require("../PatientSideListSkeleton");
var CurrentMedicationsPatientColumn = function () {
    var _a, _b, _c;
    var theme = (0, material_1.useTheme)();
    var _d = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'questionnaireResponse',
        'isAppointmentLoading',
        'chartData',
    ]), questionnaireResponse = _d.questionnaireResponse, isAppointmentLoading = _d.isAppointmentLoading, chartData = _d.chartData;
    var currentMedications = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('current-medications', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0].valueArray;
    var aiMedicationsHistory = (_c = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _c === void 0 ? void 0 : _c.find(function (observation) { return observation.field === utils_1.AiObservationField.MedicationsHistory; });
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiCurrentMedicationsPatientProvidedList}>
      {isAppointmentLoading ? (<PatientSideListSkeleton_1.PatientSideListSkeleton />) : currentMedications ? (currentMedications.map(function (answer, index, arr) { return (<material_1.Box key={index}>
            <material_1.Typography>{answer['current-medications-form-medication']}</material_1.Typography>
            {index + 1 !== arr.length && <material_1.Divider sx={{ pt: 1 }}/>}
          </material_1.Box>); })) : (<material_1.Typography color={theme.palette.text.secondary}>Patient has no current medications</material_1.Typography>)}
      {aiMedicationsHistory ? (<>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }}/>
          <AiSuggestion_1.default title={'Medications'} content={aiMedicationsHistory.value}/>
        </>) : undefined}
    </material_1.Box>);
};
exports.CurrentMedicationsPatientColumn = CurrentMedicationsPatientColumn;
//# sourceMappingURL=CurrentMedicationsPatientColumn.js.map