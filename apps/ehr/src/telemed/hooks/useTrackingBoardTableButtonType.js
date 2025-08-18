"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTrackingBoardTableButtonType = void 0;
var react_1 = require("react");
var utils_1 = require("utils");
var useEvolveUser_1 = require("../../hooks/useEvolveUser");
var getSelectors_1 = require("../../shared/store/getSelectors");
var state_1 = require("../state");
var useTrackingBoardTableButtonType = function (_a) {
    var appointment = _a.appointment;
    var _b = (0, react_1.useState)(''), type = _b[0], setType = _b[1];
    var availableStates = (0, getSelectors_1.getSelectors)(state_1.useTrackingBoardStore, ['availableStates']).availableStates;
    var user = (0, useEvolveUser_1.default)();
    var isEncounterForPractitioner = !!(user === null || user === void 0 ? void 0 : user.profileResource) && (0, utils_1.checkEncounterHasPractitioner)(appointment.encounter, user.profileResource);
    (0, react_1.useEffect)(function () {
        if (!appointment.locationVirtual.state ||
            !availableStates.includes(appointment.locationVirtual.state) ||
            [utils_1.TelemedAppointmentStatusEnum.complete, utils_1.TelemedAppointmentStatusEnum.unsigned].includes(appointment.telemedStatus) ||
            ([utils_1.TelemedAppointmentStatusEnum['pre-video'], utils_1.TelemedAppointmentStatusEnum['on-video']].includes(appointment.telemedStatus) &&
                !isEncounterForPractitioner)) {
            if (appointment.telemedStatus === utils_1.TelemedAppointmentStatusEnum.unsigned &&
                appointment.locationVirtual.state &&
                availableStates.includes(appointment.locationVirtual.state) &&
                isEncounterForPractitioner) {
                setType('viewContained');
            }
            else {
                setType('viewOutlined');
            }
        }
        else if (appointment.telemedStatus === utils_1.TelemedAppointmentStatusEnum.ready) {
            setType('assignMe');
        }
        else if (appointment.telemedStatus === utils_1.TelemedAppointmentStatusEnum['pre-video']) {
            setType('unassign');
        }
        else if (appointment.telemedStatus === utils_1.TelemedAppointmentStatusEnum['on-video']) {
            setType('reconnect');
        }
        else {
            setType('');
        }
    }, [appointment.locationVirtual.state, availableStates, appointment.telemedStatus, isEncounterForPractitioner]);
    return { type: type };
};
exports.useTrackingBoardTableButtonType = useTrackingBoardTableButtonType;
//# sourceMappingURL=useTrackingBoardTableButtonType.js.map