"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentFooter = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var InviteParticipant_1 = require("../../components/InviteParticipant");
var hooks_1 = require("../../hooks");
var state_1 = require("../../state");
var utils_2 = require("../../utils");
var AppointmentFooterButton_1 = require("./AppointmentFooterButton");
var AppointmentFooter = function () {
    var theme = (0, material_1.useTheme)();
    var _a = (0, react_1.useState)(false), isInviteParticipantOpen = _a[0], setIsInviteParticipantOpen = _a[1];
    var appointmentAccessibility = (0, hooks_1.useGetAppointmentAccessibility)();
    var _b = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['appointment', 'encounter']), appointment = _b.appointment, encounter = _b.encounter;
    var meetingData = (0, getSelectors_1.getSelectors)(state_1.useVideoCallStore, ['meetingData']).meetingData;
    var statuses = encounter.statusHistory && (appointment === null || appointment === void 0 ? void 0 : appointment.status)
        ? (0, utils_1.mapEncounterStatusHistory)(encounter.statusHistory, appointment.status)
        : undefined;
    var waitingTime = (0, utils_2.getAppointmentWaitingTime)(statuses);
    return (<material_1.AppBar position="sticky" sx={{
            top: 'auto',
            bottom: 0,
            backgroundColor: theme.palette.primary.dark,
            zIndex: function (theme) { return theme.zIndex.drawer + 1; },
        }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentChartFooter}>
      {isInviteParticipantOpen && (<InviteParticipant_1.default modalOpen={isInviteParticipantOpen} onClose={function () { return setIsInviteParticipantOpen(false); }}/>)}
      {((appointmentAccessibility.status &&
            [utils_1.TelemedAppointmentStatusEnum.ready, utils_1.TelemedAppointmentStatusEnum['pre-video']].includes(appointmentAccessibility.status)) ||
            (appointmentAccessibility.isEncounterAssignedToCurrentPractitioner &&
                appointmentAccessibility.status &&
                appointmentAccessibility.status === utils_1.TelemedAppointmentStatusEnum['on-video'] &&
                !meetingData)) && (<material_1.Box sx={{
                px: 3,
                py: 1,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: 'white',
                backgroundColor: theme.palette.primary.dark,
            }}>
          <material_1.Box>
            <material_1.Typography variant="h4">Patient waiting</material_1.Typography>
            <material_1.Typography variant="body2">{waitingTime} mins</material_1.Typography>
          </material_1.Box>
          <AppointmentFooterButton_1.AppointmentFooterButton />
        </material_1.Box>)}
    </material_1.AppBar>);
};
exports.AppointmentFooter = AppointmentFooter;
//# sourceMappingURL=AppointmentFooter.js.map