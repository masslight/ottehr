"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OttehrAi = void 0;
var icons_1 = require("@ehrTheme/icons");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var AiChatHistory_1 = require("../../../components/AiChatHistory");
var AiSuggestion_1 = require("../../../components/AiSuggestion");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var CSSLoader_1 = require("../components/CSSLoader");
var useAppointment_1 = require("../hooks/useAppointment");
var AI_OBSERVATION_FIELDS = [
    [utils_1.AiObservationField.HistoryOfPresentIllness, 'History of Present Illness (HPI)'],
    [utils_1.AiObservationField.PastMedicalHistory, 'Past Medical History (PMH)'],
    [utils_1.AiObservationField.PastSurgicalHistory, 'Past Surgical History (PSH)'],
    [utils_1.AiObservationField.MedicationsHistory, 'Medications'],
    [utils_1.AiObservationField.Allergies, 'Allergies'],
    [utils_1.AiObservationField.SocialHistory, 'Social history'],
    [utils_1.AiObservationField.FamilyHistory, 'Family history'],
    [utils_1.AiObservationField.HospitalizationsHistory, 'Hospitalization'],
];
var OttehrAi = function () {
    var _a;
    var appointmentId = (0, react_router_dom_1.useParams)().id;
    var _b = (0, useAppointment_1.useAppointment)(appointmentId), appointment = _b.resources.appointment, isLoading = _b.isLoading, error = _b.error;
    var _c = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['chartData', 'isChartDataLoading']), chartData = _c.chartData, isChartDataLoading = _c.isChartDataLoading;
    if (isLoading || isChartDataLoading)
        return <CSSLoader_1.CSSLoader />;
    if (error)
        return <material_1.Typography>Error: {error.message}</material_1.Typography>;
    if (!appointment)
        return <material_1.Typography>No data available</material_1.Typography>;
    var aiPotentialDiagnoses = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.aiPotentialDiagnosis) !== null && _a !== void 0 ? _a : [];
    return (<material_1.Stack spacing={1}>
      <telemed_1.AccordionCard>
        <material_1.Box style={{ padding: '16px', height: '350px', overflowY: 'auto' }}>
          <material_1.Box style={{
            display: 'flex',
            alignItems: 'center',
            paddingBottom: '8px',
        }}>
            <img src={icons_1.ottehrAiIcon} style={{ width: '30px', marginRight: '8px' }}/>
            <material_1.Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '14px' }}>
              CHAT WITH OYSTEHR AI
            </material_1.Typography>
          </material_1.Box>
          <AiChatHistory_1.AiChatHistory questionnaireResponse={chartData === null || chartData === void 0 ? void 0 : chartData.aiChat}/>
        </material_1.Box>
      </telemed_1.AccordionCard>
      <telemed_1.AccordionCard>
        <material_1.Stack style={{ padding: '16px' }} spacing={1}>
          <material_1.Box style={{
            display: 'flex',
            alignItems: 'center',
        }}>
            <img src={icons_1.ottehrAiIcon} style={{ width: '30px', marginRight: '8px' }}/>
            <material_1.Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '14px' }}>
              OYSTEHR AI SUGGESTIONS
            </material_1.Typography>
          </material_1.Box>
          {AI_OBSERVATION_FIELDS.map(function (_a) {
            var _b;
            var filed = _a[0], title = _a[1];
            var dto = (_b = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _b === void 0 ? void 0 : _b.find(function (observation) { return observation.field === filed; });
            if (dto == null) {
                return undefined;
            }
            return <AiSuggestion_1.default key={filed} title={title} content={dto.value} hideHeader={true}/>;
        })}
          {aiPotentialDiagnoses.length > 0 ? (<material_1.Box style={{
                background: '#FFF9EF',
                borderRadius: '8px',
                padding: '8px',
            }}>
              <material_1.Typography variant="body1" style={{ fontWeight: 700, marginBottom: '8px' }}>
                Potential Diagnoses with ICD-10 Codes
              </material_1.Typography>
              <ul>
                {aiPotentialDiagnoses.map(function (diagnosis) {
                return (<li key={diagnosis.code}>
                      <material_1.Typography variant="body1">{diagnosis.code + ': ' + diagnosis.display}</material_1.Typography>
                    </li>);
            })}
              </ul>
            </material_1.Box>) : undefined}
        </material_1.Stack>
      </telemed_1.AccordionCard>
    </material_1.Stack>);
};
exports.OttehrAi = OttehrAi;
//# sourceMappingURL=OttehrAi.js.map