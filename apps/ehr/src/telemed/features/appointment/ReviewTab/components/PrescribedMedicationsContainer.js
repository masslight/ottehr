"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrescribedMedicationsContainer = void 0;
var material_1 = require("@mui/material");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var PrescribedMedicationReviewItem_1 = require("./PrescribedMedicationReviewItem");
var PrescribedMedicationsContainer = function () {
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var prescriptions = chartData === null || chartData === void 0 ? void 0 : chartData.prescribedMedications;
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      <material_1.Typography variant="h5" color="primary.dark">
        Prescriptions
      </material_1.Typography>
      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {prescriptions === null || prescriptions === void 0 ? void 0 : prescriptions.map(function (med) { return (<PrescribedMedicationReviewItem_1.PrescribedMedicationReviewItem medication={med} key={med.resourceId || med.name}/>); })}
      </material_1.Box>
    </material_1.Box>);
};
exports.PrescribedMedicationsContainer = PrescribedMedicationsContainer;
//# sourceMappingURL=PrescribedMedicationsContainer.js.map