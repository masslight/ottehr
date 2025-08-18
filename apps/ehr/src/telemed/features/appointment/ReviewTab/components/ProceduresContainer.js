"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProceduresContainer = void 0;
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var ProceduresContainer = function () {
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var theme = (0, material_1.useTheme)();
    var procedures = chartData === null || chartData === void 0 ? void 0 : chartData.procedures;
    var renderProperty = function (label, value) {
        if (value == null) {
            return undefined;
        }
        return (<material_1.Box>
        <material_1.Typography display="inline" sx={{ fontWeight: '500' }}>
          {label}:
        </material_1.Typography>{' '}
        {value}
      </material_1.Box>);
    };
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <material_1.Typography variant="h5" color="primary.dark">
        Procedures
      </material_1.Typography>
      {(procedures === null || procedures === void 0 ? void 0 : procedures.length) ? (procedures.map(function (procedure) { return (<material_1.Stack key={procedure.resourceId}>
            <material_1.Typography sx={{ color: '#0F347C', fontWeight: '500' }}>{procedure.procedureType}</material_1.Typography>
            {renderProperty('CPT', procedure.cptCodes != null && procedure.cptCodes.length > 0
                ? procedure.cptCodes.map(function (cptCode) { return cptCode.code + ' ' + cptCode.display; }).join('; ')
                : undefined)}
            {renderProperty('Dx', procedure.diagnoses != null && procedure.diagnoses.length > 0
                ? procedure.diagnoses.map(function (diagnosis) { return diagnosis.code + ' ' + diagnosis.display; }).join('; ')
                : undefined)}
            {renderProperty('Date and time of the procedure', procedure.procedureDateTime != null
                ? luxon_1.DateTime.fromISO(procedure.procedureDateTime).toFormat('MM/dd/yyyy, HH:mm a')
                : undefined)}
            {renderProperty('Performed by', procedure.performerType)}
            {renderProperty('Anaesthesia / medication used', procedure.medicationUsed)}
            {renderProperty('Site/location', procedure.bodySite)}
            {renderProperty('Side of body', procedure.bodySide)}
            {renderProperty('Technique', procedure.technique)}
            {renderProperty('Instruments / supplies used', procedure.suppliesUsed)}
            {renderProperty('Procedure details', procedure.procedureDetails)}
            {renderProperty('Specimen sent', procedure.specimenSent != null ? (procedure.specimenSent ? 'Yes' : 'No') : undefined)}
            {renderProperty('Complications', procedure.complications)}
            {renderProperty('Patient response', procedure.patientResponse)}
            {renderProperty('Post-procedure instructions', procedure.postInstructions)}
            {renderProperty('Time spent', procedure.timeSpent)}
            {renderProperty('Documented by', procedure.documentedBy)}
          </material_1.Stack>); })) : (<material_1.Typography color={theme.palette.text.secondary}>No procedures</material_1.Typography>)}
    </material_1.Box>);
};
exports.ProceduresContainer = ProceduresContainer;
//# sourceMappingURL=ProceduresContainer.js.map