"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Screening = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var PageTitle_1 = require("../../../telemed/components/PageTitle");
var CSSLoader_1 = require("../components/CSSLoader");
var AskThePatient_1 = require("../components/screening/AskThePatient");
var ASQ_1 = require("../components/screening/ASQ");
var PaperworkAndConfirmedQuestions_1 = require("../components/screening/PaperworkAndConfirmedQuestions");
var ScreeningNotes_1 = require("../components/screening/ScreeningNotes");
var NavigationContext_1 = require("../context/NavigationContext");
var useChartData_1 = require("../hooks/useChartData");
var Screening = function () {
    var _a = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, [
        'isChartDataLoading',
        'appointment',
        'isAppointmentLoading',
        'encounter',
    ]), isChartDataLoading = _a.isChartDataLoading, appointment = _a.appointment, isAppointmentLoading = _a.isAppointmentLoading, encounter = _a.encounter;
    (0, useChartData_1.useChartData)({
        encounterId: (encounter === null || encounter === void 0 ? void 0 : encounter.id) || '',
        requestedFields: {
            observations: {
                _tag: utils_1.ADDITIONAL_QUESTIONS_META_SYSTEM,
                _search_by: 'encounter',
            },
        },
    });
    var interactionMode = (0, NavigationContext_1.useNavigationContext)().interactionMode;
    if (isChartDataLoading || isAppointmentLoading)
        return <CSSLoader_1.CSSLoader />;
    if (!appointment)
        return <material_1.Typography>No data available</material_1.Typography>;
    return (<material_1.Stack spacing={1}>
      <PageTitle_1.PageTitle label="Screening" showIntakeNotesButton={interactionMode === 'intake'}/>
      <PaperworkAndConfirmedQuestions_1.Questions />
      <AskThePatient_1.default />
      <ASQ_1.ASQ />
      <ScreeningNotes_1.ScreeningNotes />
    </material_1.Stack>);
};
exports.Screening = Screening;
//# sourceMappingURL=Screening.js.map