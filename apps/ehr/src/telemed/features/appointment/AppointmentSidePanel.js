"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentSidePanel = void 0;
var CancelOutlined_1 = require("@mui/icons-material/CancelOutlined");
var ChatOutlined_1 = require("@mui/icons-material/ChatOutlined");
var DateRangeOutlined_1 = require("@mui/icons-material/DateRangeOutlined");
var EditOutlined_1 = require("@mui/icons-material/EditOutlined");
var MedicationOutlined_1 = require("@mui/icons-material/MedicationOutlined");
var PersonAddAltOutlined_1 = require("@mui/icons-material/PersonAddAltOutlined");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var RoundedButton_1 = require("src/components/RoundedButton");
var utils_1 = require("utils");
var dialogs_1 = require("../../../components/dialogs");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var ChatModal_1 = require("../../../features/chat/ChatModal");
var formatString_1 = require("../../../helpers/formatString");
var misc_helper_1 = require("../../../helpers/misc.helper");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var CancelVisitDialog_1 = require("../../components/CancelVisitDialog");
var InviteParticipant_1 = require("../../components/InviteParticipant");
var hooks_1 = require("../../hooks");
var state_1 = require("../../state");
var utils_2 = require("../../utils");
var PastVisits_1 = require("./PastVisits");
var Gender;
(function (Gender) {
    Gender["male"] = "Male";
    Gender["female"] = "Female";
    Gender["other"] = "Other";
    Gender["unknown"] = "Unknown";
})(Gender || (Gender = {}));
var AppointmentSidePanel = function () {
    var _a;
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
    var theme = (0, material_1.useTheme)();
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _w = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'isChartDataLoading',
        'appointment',
        'patient',
        'encounter',
        'location',
        'locationVirtual',
        'questionnaireResponse',
        'chartData',
    ]), appointment = _w.appointment, encounter = _w.encounter, patient = _w.patient, location = _w.location, locationVirtual = _w.locationVirtual, questionnaireResponse = _w.questionnaireResponse, isChartDataLoading = _w.isChartDataLoading, chartData = _w.chartData;
    var _x = (0, react_1.useState)(false), isCancelDialogOpen = _x[0], setIsCancelDialogOpen = _x[1];
    var _y = (0, react_1.useState)(false), isEditDialogOpen = _y[0], setIsEditDialogOpen = _y[1];
    var _z = (0, react_1.useState)(false), chatModalOpen = _z[0], setChatModalOpen = _z[1];
    var _0 = (0, react_1.useState)(false), isInviteParticipantOpen = _0[0], setIsInviteParticipantOpen = _0[1];
    var allergies = (chartData || {}).allergies;
    var formattedReasonForVisit = (appointment === null || appointment === void 0 ? void 0 : appointment.description) && (0, formatString_1.addSpacesAfterCommas)(appointment.description);
    var preferredLanguage = (_d = (_c = (_b = (0, utils_1.getQuestionnaireResponseByLinkId)('preferred-language', questionnaireResponse)) === null || _b === void 0 ? void 0 : _b.answer) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.valueString;
    var relayPhone = (_g = (_f = (_e = (0, utils_1.getQuestionnaireResponseByLinkId)('relay-phone', questionnaireResponse)) === null || _e === void 0 ? void 0 : _e.answer) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.valueString;
    var number = ((_k = (_j = (_h = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-number', questionnaireResponse)) === null || _h === void 0 ? void 0 : _h.answer) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.valueString) ||
        ((_o = (_m = (_l = (0, utils_1.getQuestionnaireResponseByLinkId)('guardian-number', questionnaireResponse)) === null || _l === void 0 ? void 0 : _l.answer) === null || _m === void 0 ? void 0 : _m[0]) === null || _o === void 0 ? void 0 : _o.valueString);
    var address = (_r = (_q = (_p = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-street-address', questionnaireResponse)) === null || _p === void 0 ? void 0 : _p.answer) === null || _q === void 0 ? void 0 : _q[0]) === null || _r === void 0 ? void 0 : _r.valueString;
    var addressLine2 = (_t = (_s = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-street-address-2', questionnaireResponse)) === null || _s === void 0 ? void 0 : _s.answer) === null || _t === void 0 ? void 0 : _t[0];
    var appointmentAccessibility = (0, hooks_1.useGetAppointmentAccessibility)();
    var isReadOnly = appointmentAccessibility.isAppointmentReadOnly;
    var isCancellableStatus = appointmentAccessibility.status !== utils_1.TelemedAppointmentStatusEnum.complete &&
        appointmentAccessibility.status !== utils_1.TelemedAppointmentStatusEnum.cancelled &&
        appointmentAccessibility.status !== utils_1.TelemedAppointmentStatusEnum.unsigned;
    var isPractitionerAllowedToCancelThisVisit = appointmentAccessibility.isPractitionerLicensedInState &&
        appointmentAccessibility.isEncounterAssignedToCurrentPractitioner &&
        isCancellableStatus;
    var _1 = (0, state_1.useGetTelemedAppointmentWithSMSModel)({
        appointmentId: appointment === null || appointment === void 0 ? void 0 : appointment.id,
        patientId: patient === null || patient === void 0 ? void 0 : patient.id,
    }, function (data) {
        var _a;
        setHasUnread(((_a = data.smsModel) === null || _a === void 0 ? void 0 : _a.hasUnreadMessages) || false);
    }), appointmentMessaging = _1.data, isFetching = _1.isFetching;
    var _2 = (0, react_1.useState)(((_u = appointmentMessaging === null || appointmentMessaging === void 0 ? void 0 : appointmentMessaging.smsModel) === null || _u === void 0 ? void 0 : _u.hasUnreadMessages) || false), hasUnread = _2[0], setHasUnread = _2[1];
    if (!patient || !locationVirtual) {
        return null;
    }
    function isSpanish(language) {
        return language.toLowerCase() === 'Spanish'.toLowerCase();
    }
    var delimiterString = preferredLanguage && isSpanish(preferredLanguage) ? "\u00A0|\u00A0" : '';
    var interpreterString = preferredLanguage && isSpanish(preferredLanguage) ? "Interpreter: ".concat(utils_1.INTERPRETER_PHONE_NUMBER) : '';
    var allergiesStatus = function () {
        if (isChartDataLoading) {
            return 'Loading...';
        }
        if ((questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.status) === 'in-progress' && (allergies == null || allergies.length === 0)) {
            return 'No answer';
        }
        if (allergies == null || allergies.length === 0) {
            return 'No known allergies';
        }
        return allergies
            .filter(function (allergy) { return allergy.current === true; })
            .map(function (allergy) { return allergy.name; })
            .join(', ');
    };
    return (<material_1.Drawer variant="permanent" sx={_a = {
                width: '350px',
                flexShrink: 0
            },
            _a["& .MuiDrawer-paper"] = {
                width: '350px',
                boxSizing: 'border-box',
                top: (0, misc_helper_1.adjustTopForBannerHeight)(-7),
                overflow: 'auto',
                '@media (max-height: 600px)': {
                    overflow: 'auto',
                },
            },
            _a}>
      <material_1.Toolbar />
      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 3, overflow: 'auto', height: '100%' }}>
        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <material_1.Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {(0, utils_2.getAppointmentStatusChip)((0, utils_1.mapStatusToTelemed)(encounter.status, appointment === null || appointment === void 0 ? void 0 : appointment.status))}

            {(appointment === null || appointment === void 0 ? void 0 : appointment.id) && (<material_1.Tooltip title={appointment.id}>
                <material_1.Typography sx={{
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
            }} variant="body2">
                  VID: {appointment.id}
                </material_1.Typography>
              </material_1.Tooltip>)}
          </material_1.Box>

          <material_1.Box sx={{ display: 'flex', alignItems: 'center' }}>
            <material_1.Typography variant="h4" color="primary.dark" onClick={function () { return navigate("/patient/".concat(patient.id)); }} sx={{ cursor: 'pointer' }}>
              {(0, utils_2.getPatientName)(patient.name).lastFirstMiddleName}
            </material_1.Typography>

            {!isReadOnly && (<material_1.IconButton onClick={function () { return setIsEditDialogOpen(true); }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.editPatientButtonSideBar}>
                <EditOutlined_1.default sx={{ color: theme.palette.primary.main }}/>
              </material_1.IconButton>)}
          </material_1.Box>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <material_1.Tooltip title={patient.id}>
            <material_1.Box sx={{ display: 'flex', gap: 0.5 }}>
              <material_1.Typography sx={{
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
        }} variant="body2">
                ID: {patient.id}
              </material_1.Typography>
            </material_1.Box>
          </material_1.Tooltip>

          <PastVisits_1.PastVisits />

          <material_1.Typography variant="body2">{Gender[patient.gender]}</material_1.Typography>

          <material_1.Typography variant="body2">
            DOB: {luxon_1.DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy')}, Age:{' '}
            {(0, utils_1.calculatePatientAge)(patient.birthDate)}
          </material_1.Typography>

          <material_1.Typography variant="body2" fontWeight={500}>
            Allergies: {allergiesStatus()}
          </material_1.Typography>

          {(location === null || location === void 0 ? void 0 : location.name) && <material_1.Typography variant="body2">Location: {location.name}</material_1.Typography>}

          {locationVirtual && <material_1.Typography variant="body2">State: {(_v = locationVirtual === null || locationVirtual === void 0 ? void 0 : locationVirtual.address) === null || _v === void 0 ? void 0 : _v.state}</material_1.Typography>}

          <material_1.Typography variant="body2">Address: {address}</material_1.Typography>

          {addressLine2 && <material_1.Typography variant="body2">Address 2: {addressLine2.valueString}</material_1.Typography>}

          <material_1.Typography variant="body2">{formattedReasonForVisit}</material_1.Typography>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', gap: 1, position: 'relative' }}>
          <lab_1.LoadingButton size="small" variant="outlined" sx={{
            borderRadius: 10,
            minWidth: 'auto',
            '& .MuiButton-startIcon': {
                m: 0,
            },
        }} startIcon={hasUnread ? (<material_1.Badge variant="dot" color="warning" sx={{
                '& .MuiBadge-badge': {
                    width: '14px',
                    height: '14px',
                    borderRadius: '10px',
                    border: '2px solid white',
                    top: '-4px',
                    right: '-4px',
                },
            }}>
                  <ChatOutlined_1.default />
                </material_1.Badge>) : (<ChatOutlined_1.default />)} onClick={function () { return setChatModalOpen(true); }} loading={isFetching && !appointmentMessaging}/>

          <material_1.Button size="small" variant="outlined" sx={{
            textTransform: 'none',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: 10,
        }} startIcon={<DateRangeOutlined_1.default />} onClick={function () { return window.open('/visits/add', '_blank'); }}>
            Book visit
          </material_1.Button>

          {<material_1.Box sx={{ position: 'relative', zIndex: 10000 }}>
              <RoundedButton_1.RoundedButton size="small" variant="outlined" sx={{
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: 10,
            }} startIcon={<MedicationOutlined_1.default />} onClick={function () { return state_1.useAppointmentStore.setState({ currentTab: utils_1.TelemedAppointmentVisitTabs.plan }); }} disabled={appointmentAccessibility.isAppointmentReadOnly}>
                RX
              </RoundedButton_1.RoundedButton>
            </material_1.Box>}
        </material_1.Box>

        <material_1.Divider />

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <material_1.Box>
            <material_1.Typography variant="subtitle2" color="primary.dark">
              Preferred Language
            </material_1.Typography>
            <material_1.Typography variant="body2">
              {preferredLanguage} {delimiterString} {interpreterString}
            </material_1.Typography>
          </material_1.Box>

          <material_1.Box>
            <material_1.Typography variant="subtitle2" color="primary.dark">
              Hearing Impaired Relay Service? (711)
            </material_1.Typography>
            <material_1.Typography variant="body2">{relayPhone}</material_1.Typography>
          </material_1.Box>

          <material_1.Box>
            <material_1.Typography variant="subtitle2" color="primary.dark">
              Patient number
            </material_1.Typography>
            <material_1.Link sx={{ color: 'inherit' }} component={react_router_dom_1.Link} to={"tel:".concat(number)} variant="body2">
              {number}
            </material_1.Link>
          </material_1.Box>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'start' }}>
          {appointmentAccessibility.isEncounterAssignedToCurrentPractitioner &&
            appointmentAccessibility.status &&
            [utils_1.TelemedAppointmentStatusEnum['pre-video'], utils_1.TelemedAppointmentStatusEnum['on-video']].includes(appointmentAccessibility.status) && (<material_1.Button size="small" sx={{
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: 10,
            }} startIcon={<PersonAddAltOutlined_1.default />} onClick={function () { return setIsInviteParticipantOpen(true); }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.inviteParticipant}>
                Invite participant
              </material_1.Button>)}
          {isPractitionerAllowedToCancelThisVisit && (<material_1.Button size="small" color="error" sx={{
                textTransform: 'none',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: 10,
            }} startIcon={<CancelOutlined_1.default />} onClick={function () { return setIsCancelDialogOpen(true); }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.cancelThisVisitButton}>
              Cancel this visit
            </material_1.Button>)}
        </material_1.Box>

        {isCancelDialogOpen && <CancelVisitDialog_1.default onClose={function () { return setIsCancelDialogOpen(false); }}/>}

        {isEditDialogOpen && (<dialogs_1.EditPatientDialog modalOpen={isEditDialogOpen} onClose={function () { return setIsEditDialogOpen(false); }}/>)}
        {chatModalOpen && appointmentMessaging && (<ChatModal_1.default appointment={appointmentMessaging} onClose={function () { return setChatModalOpen(false); }} onMarkAllRead={function () { return setHasUnread(false); }} patient={patient} quickTexts={utils_2.quickTexts}/>)}
        {isInviteParticipantOpen && (<InviteParticipant_1.default modalOpen={isInviteParticipantOpen} onClose={function () { return setIsInviteParticipantOpen(false); }}/>)}
      </material_1.Box>
      <material_1.Toolbar sx={{ marginBottom: "".concat((0, misc_helper_1.adjustTopForBannerHeight)(0), "px") }}/>
    </material_1.Drawer>);
};
exports.AppointmentSidePanel = AppointmentSidePanel;
//# sourceMappingURL=AppointmentSidePanel.js.map