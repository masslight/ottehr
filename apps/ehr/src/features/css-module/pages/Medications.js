"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Medications = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var PageTitle_1 = require("../../../telemed/components/PageTitle");
var appointment_1 = require("../../../telemed/features/appointment");
var CSSLoader_1 = require("../components/CSSLoader");
var MedicationHistoryList_1 = require("../components/medication-administration/medication-history/MedicationHistoryList");
var AskMedicationsAlert_1 = require("../components/medications/AskMedicationsAlert");
var MedicationsNotes_1 = require("../components/medications/MedicationsNotes");
var NavigationContext_1 = require("../context/NavigationContext");
var useAppointment_1 = require("../hooks/useAppointment");
var Medications = function () {
    var appointmentID = (0, react_router_dom_1.useParams)().id;
    var _a = (0, useAppointment_1.useAppointment)(appointmentID), appointment = _a.resources.appointment, isLoading = _a.isLoading, error = _a.error;
    var isChartDataLoading = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['isChartDataLoading']).isChartDataLoading;
    var interactionMode = (0, NavigationContext_1.useNavigationContext)().interactionMode;
    if (isLoading || isChartDataLoading)
        return <CSSLoader_1.CSSLoader />;
    if (error)
        return <material_1.Typography>Error: {error.message}</material_1.Typography>;
    if (!appointment)
        return <material_1.Typography>No data available</material_1.Typography>;
    return (<material_1.Stack spacing={1}>
      <PageTitle_1.PageTitle label="Medications" showIntakeNotesButton={interactionMode === 'intake'}/>

      <AskMedicationsAlert_1.AskMedicationsAlert />
      <appointment_1.MedicalHistoryDoubleCard patientSide={<appointment_1.CurrentMedicationsPatientColumn />} providerSide={<appointment_1.CurrentMedicationsProviderColumn />}/>

      <MedicationHistoryList_1.MedicationHistoryList />
      <MedicationsNotes_1.MedicationsNotes />
    </material_1.Stack>);
};
exports.Medications = Medications;
//# sourceMappingURL=Medications.js.map