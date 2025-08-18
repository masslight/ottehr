"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressNote = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var PageTitle_1 = require("../../../telemed/components/PageTitle");
var appointment_1 = require("../../../telemed/features/appointment");
var ReviewTab_1 = require("../../../telemed/features/appointment/ReviewTab");
var CSSLoader_1 = require("../components/CSSLoader");
var PatientInformationContainer_1 = require("../components/progress-note/PatientInformationContainer");
var ProgressNoteDetails_1 = require("../components/progress-note/ProgressNoteDetails");
var VisitDetailsContainer_1 = require("../components/progress-note/VisitDetailsContainer");
var featureFlags_1 = require("../context/featureFlags");
var useAppointment_1 = require("../hooks/useAppointment");
var useIntakeNotes_1 = require("../hooks/useIntakeNotes");
var ProgressNote = function () {
    var appointmentID = (0, react_router_dom_1.useParams)().id;
    var _a = (0, useAppointment_1.useAppointment)(appointmentID), appointment = _a.resources.appointment, isLoading = _a.isLoading, error = _a.error;
    var _b = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['appointment', 'encounter', 'isChartDataLoading']), appointmentResource = _b.appointment, encounter = _b.encounter, isChartDataLoading = _b.isChartDataLoading;
    var isReadOnly = (0, telemed_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var css = (0, featureFlags_1.useFeatureFlags)().css;
    if (isLoading || isChartDataLoading)
        return <CSSLoader_1.CSSLoader />;
    if (error)
        return <material_1.Typography>Error: {error.message}</material_1.Typography>;
    if (!appointment)
        return <material_1.Typography>No data available</material_1.Typography>;
    return (<material_1.Stack spacing={1}>
      <PageTitle_1.PageTitle label="Progress Note" showIntakeNotesButton={false}/>
      <ReviewTab_1.MissingCard />

      <telemed_1.AccordionCard>
        <telemed_1.DoubleColumnContainer divider padding leftColumn={<PatientInformationContainer_1.PatientInformationContainer />} rightColumn={<VisitDetailsContainer_1.VisitDetailsContainer />}/>
      </telemed_1.AccordionCard>

      <telemed_1.AccordionCard label="Intake Notes">
        <useIntakeNotes_1.IntakeNotes />
      </telemed_1.AccordionCard>

      <appointment_1.ChiefComplaintCard />

      <ProgressNoteDetails_1.ProgressNoteDetails />

      <ReviewTab_1.AddendumCard />

      {!isReadOnly && (<material_1.Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <ReviewTab_1.SendFaxButton appointment={appointmentResource} encounter={encounter} css={css}/>
          <material_1.Box sx={{ display: 'flex', gap: 1 }}>
            <ReviewTab_1.DischargeButton />
            <ReviewTab_1.ReviewAndSignButton />
          </material_1.Box>
        </material_1.Box>)}
    </material_1.Stack>);
};
exports.ProgressNote = ProgressNote;
//# sourceMappingURL=ProgressNote.js.map