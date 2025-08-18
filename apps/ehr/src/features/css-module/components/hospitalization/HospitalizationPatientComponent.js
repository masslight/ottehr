"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HospitalizationPatientComponent = void 0;
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var AiSuggestion_1 = require("../../../../components/AiSuggestion");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var telemed_1 = require("../../../../telemed");
var appointment_1 = require("../../../../telemed/features/appointment");
var useAppointment_1 = require("../../hooks/useAppointment");
var HospitalizationPatientComponent = function () {
    var _a;
    var theme = (0, material_1.useTheme)();
    var _b = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['isAppointmentLoading', 'chartData']), isAppointmentLoading = _b.isAppointmentLoading, chartData = _b.chartData;
    var questionnaire = (0, useAppointment_1.useAppointment)().mappedData;
    var hospitalizations = questionnaire.hospitalizations;
    var aiHospitalization = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _a === void 0 ? void 0 : _a.find(function (observation) { return observation.field === utils_1.AiObservationField.HospitalizationsHistory; });
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }}>
      {isAppointmentLoading ? (<appointment_1.PatientSideListSkeleton />) : (hospitalizations === null || hospitalizations === void 0 ? void 0 : hospitalizations.length) ? (hospitalizations.map(function (answer, index, arr) { return (<material_1.Box key={index}>
            <material_1.Typography>{answer}</material_1.Typography>
            {index + 1 !== arr.length && <material_1.Divider sx={{ pt: 1 }}/>}
          </material_1.Box>); })) : (<material_1.Typography color={theme.palette.text.secondary}>Patient has no hospitalization</material_1.Typography>)}
      {aiHospitalization ? (<>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }}/>
          <AiSuggestion_1.default title={'Hospitalization'} content={aiHospitalization.value}/>
        </>) : undefined}
    </material_1.Box>);
};
exports.HospitalizationPatientComponent = HospitalizationPatientComponent;
//# sourceMappingURL=HospitalizationPatientComponent.js.map