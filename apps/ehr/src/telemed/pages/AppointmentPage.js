"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentPage = void 0;
var material_1 = require("@mui/material");
var amazon_chime_sdk_component_library_react_1 = require("amazon-chime-sdk-component-library-react");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var styled_components_1 = require("styled-components");
var utils_1 = require("utils");
var getSelectors_1 = require("../../shared/store/getSelectors");
var HearingRelayPopup_1 = require("../components/HearingRelayPopup");
var PreferredLanguagePopup_1 = require("../components/PreferredLanguagePopup");
var appointment_1 = require("../features/appointment");
var hooks_1 = require("../hooks");
var state_1 = require("../state");
var utils_2 = require("../utils");
var AppointmentPage = function () {
    var id = (0, react_router_dom_1.useParams)().id;
    var _a = (0, react_router_dom_1.useSearchParams)(), searchParams = _a[0], setSearchParams = _a[1];
    var meetingData = (0, getSelectors_1.getSelectors)(state_1.useVideoCallStore, ['meetingData']).meetingData;
    var _b = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['appointment', 'encounter', 'patientPhotoUrls']), appointment = _b.appointment, encounter = _b.encounter, currentPatientPhotosUrls = _b.patientPhotoUrls;
    var _c = (0, react_1.useState)(false), wasHearingRelayPopupOpen = _c[0], setWasHearingRelayPopupOpen = _c[1];
    var _d = (0, react_1.useState)(false), shouldHearingRelayPopupBeOpened = _d[0], setShouldHearingRelayPopupBeOpened = _d[1];
    var _e = (0, react_1.useState)(false), wasPreferredLanguagePopupOpen = _e[0], setWasPreferredLanguagePopupOpen = _e[1];
    var _f = (0, react_1.useState)(false), shouldPreferredLanguagePopupBeOpened = _f[0], setShouldPreferredLanguagePopupBeOpened = _f[1];
    var _g = (0, react_1.useState)(undefined), preferredLanguage = _g[0], setPreferredLanguage = _g[1];
    var isPreferredLanguagePopupOpen = shouldPreferredLanguagePopupBeOpened && !wasPreferredLanguagePopupOpen;
    var isHearingRelayPopupOpen = shouldHearingRelayPopupBeOpened && !wasHearingRelayPopupOpen && !isPreferredLanguagePopupOpen;
    var closeHearingRelayPopup = function () {
        setWasHearingRelayPopupOpen(true);
    };
    var closePreferredLanguagePopup = function () {
        setWasPreferredLanguagePopupOpen(true);
    };
    var shouldPeriodicallyRefreshAppointmentData = (0, react_1.useMemo)(function () {
        var appointmentStatus = (0, utils_1.mapStatusToTelemed)(encounter.status, appointment === null || appointment === void 0 ? void 0 : appointment.status);
        return (appointmentStatus === utils_1.TelemedAppointmentStatusEnum.ready ||
            appointmentStatus === utils_1.TelemedAppointmentStatusEnum['pre-video'] ||
            appointmentStatus === utils_1.TelemedAppointmentStatusEnum['on-video']);
    }, [appointment, encounter]);
    (0, state_1.useRefreshableAppointmentData)({
        appointmentId: id,
        isEnabled: shouldPeriodicallyRefreshAppointmentData,
    }, function (refreshedData) {
        var updatedPatientConditionPhotoUrs = refreshedData.patientConditionPhotoUrls;
        var hasPhotosUpdates = !(0, utils_2.arraysEqual)(currentPatientPhotosUrls, updatedPatientConditionPhotoUrs);
        if (hasPhotosUpdates) {
            state_1.useAppointmentStore.setState({ patientPhotoUrls: updatedPatientConditionPhotoUrs });
        }
    });
    (0, state_1.useGetAppointment)({
        appointmentId: id,
    }, function (data) {
        var _a, _b, _c, _d, _e;
        var questionnaireResponse = data === null || data === void 0 ? void 0 : data.find(function (resource) { return resource.resourceType === 'QuestionnaireResponse'; });
        state_1.useAppointmentStore.setState({
            appointment: data === null || data === void 0 ? void 0 : data.find(function (resource) { return resource.resourceType === 'Appointment'; }),
            patient: data === null || data === void 0 ? void 0 : data.find(function (resource) { return resource.resourceType === 'Patient'; }),
            location: (data === null || data === void 0 ? void 0 : data.filter(function (resource) { return resource.resourceType === 'Location'; })).find(function (location) { return !(0, utils_1.isLocationVirtual)(location); }),
            locationVirtual: (data === null || data === void 0 ? void 0 : data.filter(function (resource) { return resource.resourceType === 'Location'; })).find(utils_1.isLocationVirtual),
            practitioner: data === null || data === void 0 ? void 0 : data.find(function (resource) { return resource.resourceType === 'Practitioner'; }),
            encounter: data === null || data === void 0 ? void 0 : data.find(function (resource) { return resource.resourceType === 'Encounter'; }),
            questionnaireResponse: questionnaireResponse,
            patientPhotoUrls: (0, utils_2.extractPhotoUrlsFromAppointmentData)(data),
            schoolWorkNoteUrls: (data === null || data === void 0 ? void 0 : data.filter(function (resource) {
                var _a, _b, _c, _d;
                return resource.resourceType === 'DocumentReference' &&
                    resource.status === 'current' &&
                    (((_b = (_a = resource.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].code) === utils_1.SCHOOL_WORK_NOTE_CODE ||
                        ((_d = (_c = resource.type) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0].code) === utils_1.SCHOOL_WORK_NOTE_TEMPLATE_CODE);
            }).flatMap(function (docRef) { return docRef.content.map(function (cnt) { return cnt.attachment.url; }); }).filter(Boolean)) || [],
            reviewAndSignData: (0, utils_2.extractReviewAndSignAppointmentData)(data),
        });
        var relayPhone = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('relay-phone', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer.find(Boolean)) === null || _b === void 0 ? void 0 : _b.valueString;
        if ((relayPhone === null || relayPhone === void 0 ? void 0 : relayPhone.toLowerCase()) === 'yes') {
            setShouldHearingRelayPopupBeOpened(true);
        }
        var preferredLanguage = (_e = (_d = (_c = (0, utils_1.getQuestionnaireResponseByLinkId)('preferred-language', questionnaireResponse)) === null || _c === void 0 ? void 0 : _c.answer) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.valueString;
        setPreferredLanguage(preferredLanguage);
        if (preferredLanguage && preferredLanguage !== 'English') {
            setShouldPreferredLanguagePopupBeOpened(true);
        }
    });
    (0, hooks_1.useResetAppointmentStore)();
    var tab = (0, react_1.useState)(searchParams.get('tab'))[0];
    (0, react_1.useEffect)(function () {
        if (tab) {
            state_1.useAppointmentStore.setState({ currentTab: tab });
            searchParams.delete('tab');
            setSearchParams(searchParams);
        }
    }, [searchParams, setSearchParams, tab]);
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
        }}>
      <appointment_1.AppointmentHeader />

      <PreferredLanguagePopup_1.default isOpen={isPreferredLanguagePopupOpen} onClose={closePreferredLanguagePopup} preferredLanguage={preferredLanguage}/>

      <HearingRelayPopup_1.default isOpen={isHearingRelayPopupOpen} onClose={closeHearingRelayPopup}/>

      <material_1.Box sx={{ display: 'flex', flex: 1 }}>
        <appointment_1.AppointmentSidePanel />

        <material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            m: 3,
            width: '100%',
        }}>
          {meetingData && (<styled_components_1.ThemeProvider theme={amazon_chime_sdk_component_library_react_1.lightTheme}>
              <amazon_chime_sdk_component_library_react_1.GlobalStyles />
              <amazon_chime_sdk_component_library_react_1.MeetingProvider>
                <appointment_1.VideoChatContainer />
              </amazon_chime_sdk_component_library_react_1.MeetingProvider>
            </styled_components_1.ThemeProvider>)}

          <material_1.Box sx={{ width: '100%' }}>
            <appointment_1.AppointmentTabs />
          </material_1.Box>
        </material_1.Box>
      </material_1.Box>

      <appointment_1.AppointmentFooter />

      <div id="prescribe-dialog"/>
    </material_1.Box>);
};
exports.AppointmentPage = AppointmentPage;
//# sourceMappingURL=AppointmentPage.js.map