"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientVitalsContainer = void 0;
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var AssessmentTab_1 = require("../../../../telemed/features/appointment/AssessmentTab");
var VitalsHistoryEntry_1 = require("../vitals/components/VitalsHistoryEntry");
var useGetVitals_1 = require("../vitals/hooks/useGetVitals");
var PatientVitalsContainer = function (_a) {
    var notes = _a.notes, encounterId = _a.encounterId;
    var encounterVitals = (0, useGetVitals_1.useGetVitals)(encounterId).data;
    var temperature = (encounterVitals === null || encounterVitals === void 0 ? void 0 : encounterVitals[utils_1.VitalFieldNames.VitalTemperature]) || [];
    var heartbeat = (encounterVitals === null || encounterVitals === void 0 ? void 0 : encounterVitals[utils_1.VitalFieldNames.VitalHeartbeat]) || [];
    var respirationRate = (encounterVitals === null || encounterVitals === void 0 ? void 0 : encounterVitals[utils_1.VitalFieldNames.VitalRespirationRate]) || [];
    var bloodPressure = (encounterVitals === null || encounterVitals === void 0 ? void 0 : encounterVitals[utils_1.VitalFieldNames.VitalBloodPressure]) || [];
    var oxygenSaturation = (encounterVitals === null || encounterVitals === void 0 ? void 0 : encounterVitals[utils_1.VitalFieldNames.VitalOxygenSaturation]) || [];
    var weight = (encounterVitals === null || encounterVitals === void 0 ? void 0 : encounterVitals[utils_1.VitalFieldNames.VitalWeight]) || [];
    var height = (encounterVitals === null || encounterVitals === void 0 ? void 0 : encounterVitals[utils_1.VitalFieldNames.VitalHeight]) || [];
    var vision = (encounterVitals === null || encounterVitals === void 0 ? void 0 : encounterVitals[utils_1.VitalFieldNames.VitalVision]) || [];
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <material_1.Typography variant="h5" color="primary.dark">
        Vitals
      </material_1.Typography>

      {temperature && temperature.length > 0 && (<>
          <AssessmentTab_1.AssessmentTitle>Temperature</AssessmentTab_1.AssessmentTitle>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {temperature === null || temperature === void 0 ? void 0 : temperature.map(function (item) { return <VitalsHistoryEntry_1.default historyEntry={item} key={item.resourceId}/>; })}
          </material_1.Box>
        </>)}
      {heartbeat && heartbeat.length > 0 && (<>
          <AssessmentTab_1.AssessmentTitle>Heartbeat</AssessmentTab_1.AssessmentTitle>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {heartbeat === null || heartbeat === void 0 ? void 0 : heartbeat.map(function (item) { return <VitalsHistoryEntry_1.default historyEntry={item} key={item.resourceId}/>; })}
          </material_1.Box>
        </>)}
      {respirationRate && respirationRate.length > 0 && (<>
          <AssessmentTab_1.AssessmentTitle>Respiration rate</AssessmentTab_1.AssessmentTitle>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {respirationRate === null || respirationRate === void 0 ? void 0 : respirationRate.map(function (item) { return <VitalsHistoryEntry_1.default historyEntry={item} key={item.resourceId}/>; })}
          </material_1.Box>
        </>)}
      {bloodPressure && bloodPressure.length > 0 && (<>
          <AssessmentTab_1.AssessmentTitle>Blood pressure</AssessmentTab_1.AssessmentTitle>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {bloodPressure === null || bloodPressure === void 0 ? void 0 : bloodPressure.map(function (item) { return <VitalsHistoryEntry_1.default historyEntry={item} key={item.resourceId}/>; })}
          </material_1.Box>
        </>)}
      {oxygenSaturation && oxygenSaturation.length > 0 && (<>
          <AssessmentTab_1.AssessmentTitle>Oxygen saturation</AssessmentTab_1.AssessmentTitle>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {oxygenSaturation === null || oxygenSaturation === void 0 ? void 0 : oxygenSaturation.map(function (item) { return <VitalsHistoryEntry_1.default historyEntry={item} key={item.resourceId}/>; })}
          </material_1.Box>
        </>)}
      {weight && weight.length > 0 && (<>
          <AssessmentTab_1.AssessmentTitle>Weight</AssessmentTab_1.AssessmentTitle>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {weight === null || weight === void 0 ? void 0 : weight.map(function (item) { return <VitalsHistoryEntry_1.default historyEntry={item} key={item.resourceId}/>; })}
          </material_1.Box>
        </>)}
      {height && height.length > 0 && (<>
          <AssessmentTab_1.AssessmentTitle>Height</AssessmentTab_1.AssessmentTitle>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {height === null || height === void 0 ? void 0 : height.map(function (item) { return <VitalsHistoryEntry_1.default historyEntry={item} key={item.resourceId}/>; })}
          </material_1.Box>
        </>)}
      {vision && vision.length > 0 && (<>
          <AssessmentTab_1.AssessmentTitle>Vision</AssessmentTab_1.AssessmentTitle>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {vision === null || vision === void 0 ? void 0 : vision.map(function (item) { return <VitalsHistoryEntry_1.default historyEntry={item} key={item.resourceId}/>; })}
          </material_1.Box>
        </>)}

      {notes && notes.length > 0 && (<>
          <AssessmentTab_1.AssessmentTitle>Vitals notes</AssessmentTab_1.AssessmentTitle>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {notes === null || notes === void 0 ? void 0 : notes.map(function (note) { return <material_1.Typography key={note.resourceId}>{note.text}</material_1.Typography>; })}
          </material_1.Box>
        </>)}
    </material_1.Box>);
};
exports.PatientVitalsContainer = PatientVitalsContainer;
//# sourceMappingURL=PatientVitalsContainer.js.map