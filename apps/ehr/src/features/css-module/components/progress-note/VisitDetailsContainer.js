"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisitDetailsContainer = void 0;
var material_1 = require("@mui/material");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var formatDateTime_1 = require("../../../../helpers/formatDateTime");
var telemed_1 = require("../../../../telemed");
var ReviewTab_1 = require("../../../../telemed/features/appointment/ReviewTab");
var useChartData_1 = require("../../hooks/useChartData");
var RoundedButton_1 = require("../RoundedButton");
var VisitDetailsContainer = function () {
    var _a, _b, _c, _d, _e, _f;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _g = (0, utils_1.getSelectors)(telemed_1.useAppointmentStore, ['appointment', 'location', 'questionnaireResponse', 'encounter', 'chartData', 'setPartialChartData']), appointment = _g.appointment, location = _g.location, questionnaireResponse = _g.questionnaireResponse, encounter = _g.encounter, chartData = _g.chartData, setPartialChartData = _g.setPartialChartData;
    (0, useChartData_1.useChartData)({
        encounterId: encounter.id || '',
        requestedFields: {
            practitioners: {},
        },
        onSuccess: function (data) {
            setPartialChartData({
                practitioners: data.practitioners,
            });
        },
    });
    var insuranceCompanyID = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('insurance-carrier', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0].valueString;
    var subscriberID = (_d = (_c = (0, utils_1.getQuestionnaireResponseByLinkId)('insurance-member-id', questionnaireResponse)) === null || _c === void 0 ? void 0 : _c.answer) === null || _d === void 0 ? void 0 : _d[0].valueString;
    var date = (0, formatDateTime_1.formatDateUsingSlashes)(appointment === null || appointment === void 0 ? void 0 : appointment.start);
    var facility = location === null || location === void 0 ? void 0 : location.name;
    var admitterId = (0, utils_1.getAdmitterPractitionerId)(encounter);
    var admitterPractitioner = (_e = chartData === null || chartData === void 0 ? void 0 : chartData.practitioners) === null || _e === void 0 ? void 0 : _e.find(function (practitioner) { return practitioner.id === admitterId; });
    var admitterPractitionerName = admitterPractitioner && (0, utils_1.getProviderNameWithProfession)(admitterPractitioner);
    var attenderId = encounter ? (0, utils_1.getAttendingPractitionerId)(encounter) : undefined;
    var attenderPractitioner = (_f = chartData === null || chartData === void 0 ? void 0 : chartData.practitioners) === null || _f === void 0 ? void 0 : _f.find(function (practitioner) { return practitioner.id === attenderId; });
    var attenderPractitionerName = attenderPractitioner && (0, utils_1.getProviderNameWithProfession)(attenderPractitioner);
    return (<material_1.Stack spacing={2}>
      <material_1.Box sx={{
            mb: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            '@media (max-width: 600px)': {
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
            },
        }}>
        <material_1.Typography fontSize={18} color="primary.dark" fontWeight={600}>
          Visit information
        </material_1.Typography>
        <RoundedButton_1.ButtonRounded onClick={function () { return navigate("/visit/".concat(appointment === null || appointment === void 0 ? void 0 : appointment.id)); }} variant="outlined" sx={{
            whiteSpace: 'nowrap',
            '@media (max-width: 600px)': {
                alignSelf: 'flex-start',
            },
        }}>
          <span className="button-text">Visit Details</span>
        </RoundedButton_1.ButtonRounded>
      </material_1.Box>

      <telemed_1.ActionsList data={[
            { label: 'Primary Insurance', value: insuranceCompanyID },
            { label: 'Subscriber ID', value: subscriberID },
            { label: 'Encounter Date', value: date },
            { label: 'Provider', value: attenderPractitionerName },
            { label: 'Intake completed by', value: admitterPractitionerName },
            { label: 'Appointment Facility', value: facility },
        ]} getKey={function (item) { return item.label; }} renderItem={function (item) { return (<material_1.Stack width="100%">
            <ReviewTab_1.VisitNoteItem label={item.label} value={item.value} noMaxWidth/>
          </material_1.Stack>); }} gap={0.75} divider/>
    </material_1.Stack>);
};
exports.VisitDetailsContainer = VisitDetailsContainer;
//# sourceMappingURL=VisitDetailsContainer.js.map