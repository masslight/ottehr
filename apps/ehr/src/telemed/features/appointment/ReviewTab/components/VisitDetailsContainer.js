"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisitDetailsContainer = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var PatientInfoConfirmedCheckbox_1 = require("./PatientInfoConfirmedCheckbox");
var VisitNoteItem_1 = require("./VisitNoteItem");
var VisitDetailsContainer = function () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    var _k = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'appointment',
        'practitioner',
        'locationVirtual',
        'encounter',
        'questionnaireResponse',
        'reviewAndSignData',
    ]), appointment = _k.appointment, practitioner = _k.practitioner, locationVirtual = _k.locationVirtual, encounter = _k.encounter, questionnaireResponse = _k.questionnaireResponse, reviewAndSignData = _k.reviewAndSignData;
    var state = (_a = locationVirtual === null || locationVirtual === void 0 ? void 0 : locationVirtual.address) === null || _a === void 0 ? void 0 : _a.state;
    var provider = practitioner ? (0, utils_1.getProviderNameWithProfession)(practitioner) : '';
    var address = (_c = (_b = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-street-address', questionnaireResponse)) === null || _b === void 0 ? void 0 : _b.answer) === null || _c === void 0 ? void 0 : _c[0].valueString;
    var statuses = (0, react_1.useMemo)(function () {
        return encounter.statusHistory && (appointment === null || appointment === void 0 ? void 0 : appointment.status)
            ? (0, utils_1.mapEncounterStatusHistory)(encounter.statusHistory, appointment.status)
            : undefined;
    }, [encounter.statusHistory, appointment === null || appointment === void 0 ? void 0 : appointment.status]);
    var dateOfService = (0, utils_1.formatDateTimeToLocalTimezone)((_d = statuses === null || statuses === void 0 ? void 0 : statuses.find(function (item) { return item.status === 'on-video'; })) === null || _d === void 0 ? void 0 : _d.start);
    var signedOnDate = (0, utils_1.formatDateTimeToLocalTimezone)(reviewAndSignData === null || reviewAndSignData === void 0 ? void 0 : reviewAndSignData.signedOnDate);
    var insuranceCompanyID = (_f = (_e = (0, utils_1.getQuestionnaireResponseByLinkId)('insurance-carrier', questionnaireResponse)) === null || _e === void 0 ? void 0 : _e.answer) === null || _f === void 0 ? void 0 : _f[0].valueString;
    var insuranceCompany = (0, state_1.useGetInsurancePlan)({
        id: insuranceCompanyID,
    }).data;
    var subscriberID = (_h = (_g = (0, utils_1.getQuestionnaireResponseByLinkId)('insurance-member-id', questionnaireResponse)) === null || _g === void 0 ? void 0 : _g.answer) === null || _h === void 0 ? void 0 : _h[0].valueString;
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      <material_1.Typography variant="h5" color="primary.dark">
        Visit Details
      </material_1.Typography>
      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <VisitNoteItem_1.VisitNoteItem label="Date of Service" value={dateOfService}/>
        <VisitNoteItem_1.VisitNoteItem label="Reason for Visit" value={(_j = appointment === null || appointment === void 0 ? void 0 : appointment.description) !== null && _j !== void 0 ? _j : ''}/>
        <VisitNoteItem_1.VisitNoteItem label="Provider" value={provider}/>
        <VisitNoteItem_1.VisitNoteItem label="Signed On" value={signedOnDate}/>
        <VisitNoteItem_1.VisitNoteItem label="Visit ID" value={appointment === null || appointment === void 0 ? void 0 : appointment.id}/>
        <VisitNoteItem_1.VisitNoteItem label="Visit State" value={state}/>
        {insuranceCompanyID && (<>
            <VisitNoteItem_1.VisitNoteItem label="Insurance Company" value={insuranceCompany === null || insuranceCompany === void 0 ? void 0 : insuranceCompany.name}/>
            <VisitNoteItem_1.VisitNoteItem label="Subscriber ID" value={subscriberID}/>
          </>)}
      </material_1.Box>
      <PatientInfoConfirmedCheckbox_1.PatientInfoConfirmedCheckbox />
      <material_1.Typography variant="body2">Address: {address}</material_1.Typography>
    </material_1.Box>);
};
exports.VisitDetailsContainer = VisitDetailsContainer;
//# sourceMappingURL=VisitDetailsContainer.js.map