"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Allergies = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var PageTitle_1 = require("../../../telemed/components/PageTitle");
var appointment_1 = require("../../../telemed/features/appointment");
var AllergiesNotes_1 = require("../components/allergies/AllergiesNotes");
var CSSLoader_1 = require("../components/CSSLoader");
var InfoAlert_1 = require("../components/InfoAlert");
var NavigationContext_1 = require("../context/NavigationContext");
var useAppointment_1 = require("../hooks/useAppointment");
var Allergies = function () {
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
      <PageTitle_1.PageTitle label="Allergies" showIntakeNotesButton={interactionMode === 'intake'}/>
      <InfoAlert_1.InfoAlert text="Ask: Does the patient have any known allergies to medications, latex, or food?"/>
      <appointment_1.MedicalHistoryDoubleCard patientSide={<appointment_1.KnownAllergiesPatientColumn />} patientSideLabel="Patient provided" providerSide={<appointment_1.KnownAllergiesProviderColumn />} providerSideLabel="Healthcare staff input"/>
      <AllergiesNotes_1.AllergiesNotes />
    </material_1.Stack>);
};
exports.Allergies = Allergies;
//# sourceMappingURL=Allergies.js.map