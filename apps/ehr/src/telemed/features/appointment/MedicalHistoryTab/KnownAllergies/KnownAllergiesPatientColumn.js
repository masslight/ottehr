"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnownAllergiesPatientColumn = void 0;
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var AiSuggestion_1 = require("../../../../../components/AiSuggestion");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var PatientSideListSkeleton_1 = require("../PatientSideListSkeleton");
var KnownAllergiesPatientColumn = function () {
    var _a, _b, _c, _d, _e, _f;
    var theme = (0, material_1.useTheme)();
    var _g = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'questionnaireResponse',
        'isAppointmentLoading',
        'chartData',
    ]), questionnaireResponse = _g.questionnaireResponse, isAppointmentLoading = _g.isAppointmentLoading, chartData = _g.chartData;
    var knownAllergies = (_d = (_c = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('allergies', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueArray) === null || _d === void 0 ? void 0 : _d.filter(function (answer) { return answer['allergies-form-agent-substance-medications'] || answer['allergies-form-agent-substance-other']; });
    var aiAllergies = (_e = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _e === void 0 ? void 0 : _e.find(function (observation) { return observation.field === utils_1.AiObservationField.Allergies; });
    var isInPersonPaperwork = (_f = questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.questionnaire) === null || _f === void 0 ? void 0 : _f.startsWith('https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson');
    var renderAllergies = function () {
        if (isAppointmentLoading) {
            return <PatientSideListSkeleton_1.PatientSideListSkeleton />;
        }
        if (questionnaireResponse == null || questionnaireResponse.status === 'in-progress' || isInPersonPaperwork) {
            return <material_1.Typography color={theme.palette.text.secondary}>No answer</material_1.Typography>;
        }
        if (knownAllergies == null || (knownAllergies === null || knownAllergies === void 0 ? void 0 : knownAllergies.length) === 0) {
            return <material_1.Typography color={theme.palette.text.secondary}>Patient has no known allergies</material_1.Typography>;
        }
        return knownAllergies.map(function (answer, index, arr) { return (<material_1.Box key={index}>
        <material_1.Typography>
          {answer['allergies-form-agent-substance-medications'] || answer['allergies-form-agent-substance-other']} (
          {answer['allergies-form-agent-substance-medications'] ? 'medication' : 'other'})
        </material_1.Typography>
        {index + 1 !== arr.length && <material_1.Divider sx={{ pt: 1 }}/>}
      </material_1.Box>); });
    };
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiKnownAllergiesPatientProvidedList}>
      {renderAllergies()}
      {aiAllergies ? (<>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }}/>
          <AiSuggestion_1.default title={'Allergies'} content={aiAllergies.value}/>
        </>) : undefined}
    </material_1.Box>);
};
exports.KnownAllergiesPatientColumn = KnownAllergiesPatientColumn;
//# sourceMappingURL=KnownAllergiesPatientColumn.js.map