"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HospitalizationContainer = void 0;
var material_1 = require("@mui/material");
var AssessmentTitle_1 = require("src/telemed/features/appointment/AssessmentTab/components/AssessmentTitle");
var utils_1 = require("utils");
var telemed_1 = require("../../../../telemed");
var HospitalizationContainer = function (_a) {
    var notes = _a.notes;
    var chartData = (0, utils_1.getSelectors)(telemed_1.useAppointmentStore, ['chartData']).chartData;
    var theme = (0, material_1.useTheme)();
    var episodeOfCare = chartData === null || chartData === void 0 ? void 0 : chartData.episodeOfCare;
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <material_1.Typography variant="h5" color="primary.dark">
        Hospitalization
      </material_1.Typography>
      {(episodeOfCare === null || episodeOfCare === void 0 ? void 0 : episodeOfCare.length) ? (episodeOfCare.map(function (item) { return <material_1.Typography key={item.resourceId}>{item.display}</material_1.Typography>; })) : (<material_1.Typography color={theme.palette.text.secondary}>No hospitalizations</material_1.Typography>)}

      {notes && notes.length > 0 && (<>
          <AssessmentTitle_1.AssessmentTitle>Hospitalization notes</AssessmentTitle_1.AssessmentTitle>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {notes === null || notes === void 0 ? void 0 : notes.map(function (note) { return <material_1.Typography key={note.resourceId}>{note.text}</material_1.Typography>; })}
          </material_1.Box>
        </>)}
    </material_1.Box>);
};
exports.HospitalizationContainer = HospitalizationContainer;
//# sourceMappingURL=HospitalizationContainer.js.map