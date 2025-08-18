"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Hospitalization = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var PageTitle_1 = require("../../../telemed/components/PageTitle");
var appointment_1 = require("../../../telemed/features/appointment");
var CSSLoader_1 = require("../components/CSSLoader");
var HospitalizationForm_1 = require("../components/hospitalization/HospitalizationForm");
var HospitalizationNotes_1 = require("../components/hospitalization/HospitalizationNotes");
var HospitalizationPatientComponent_1 = require("../components/hospitalization/HospitalizationPatientComponent");
var InfoAlert_1 = require("../components/InfoAlert");
var NavigationContext_1 = require("../context/NavigationContext");
var useAppointment_1 = require("../hooks/useAppointment");
var Hospitalization = function () {
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
      <PageTitle_1.PageTitle dataTestId={data_test_ids_1.dataTestIds.hospitalizationPage.hospitalizationTitle} label="Hospitalization" showIntakeNotesButton={interactionMode === 'intake'}/>
      <InfoAlert_1.InfoAlert text="Ask: Has the patient had any prior overnight hospital stays or hospital admissions?"/>
      <appointment_1.MedicalHistoryDoubleCard patientSide={<HospitalizationPatientComponent_1.HospitalizationPatientComponent />} patientSideLabel="Patient provided" providerSide={<HospitalizationForm_1.HospitalizationForm />} providerSideLabel="Healthcare staff input"/>
      <HospitalizationNotes_1.HospitalizationNotes />
    </material_1.Stack>);
};
exports.Hospitalization = Hospitalization;
//# sourceMappingURL=Hospitalization.js.map