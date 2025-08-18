"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppointmentAccessibilityData = void 0;
var utils_1 = require("utils");
var getAppointmentAccessibilityData = function (_a) {
    var _b;
    var locationVirtual = _a.locationVirtual, encounter = _a.encounter, appointment = _a.appointment, user = _a.user, _c = _a.featureFlags, featureFlags = _c === void 0 ? {} : _c;
    var allLicenses = (user === null || user === void 0 ? void 0 : user.profileResource) && (0, utils_1.allLicensesForPractitioner)(user.profileResource);
    var licensedPractitionerStates = allLicenses === null || allLicenses === void 0 ? void 0 : allLicenses.map(function (item) { return item.state; });
    var state = (_b = locationVirtual === null || locationVirtual === void 0 ? void 0 : locationVirtual.address) === null || _b === void 0 ? void 0 : _b.state;
    var isPractitionerLicensedInState = !!state && !!licensedPractitionerStates && licensedPractitionerStates.includes(state);
    var status = (0, utils_1.mapStatusToTelemed)(encounter.status, appointment === null || appointment === void 0 ? void 0 : appointment.status);
    var isEncounterAssignedToCurrentPractitioner = !!(user === null || user === void 0 ? void 0 : user.profileResource) && (0, utils_1.checkEncounterHasPractitioner)(encounter, user.profileResource);
    var isStatusEditable = !!status && ![utils_1.TelemedAppointmentStatusEnum.complete, utils_1.TelemedAppointmentStatusEnum.ready].includes(status);
    var isCurrentUserHasAccessToAppointment = isPractitionerLicensedInState &&
        (status === utils_1.TelemedAppointmentStatusEnum.ready || isEncounterAssignedToCurrentPractitioner);
    var isAppointmentReadOnly = (function () {
        if (featureFlags.css) {
            // TODO actualize this logic
            return false;
        }
        return (!state ||
            !isPractitionerLicensedInState ||
            !status ||
            !isStatusEditable ||
            !isEncounterAssignedToCurrentPractitioner);
    })();
    return {
        allLicenses: allLicenses,
        licensedPractitionerStates: licensedPractitionerStates,
        state: state,
        isPractitionerLicensedInState: isPractitionerLicensedInState,
        status: status,
        isEncounterAssignedToCurrentPractitioner: isEncounterAssignedToCurrentPractitioner,
        isStatusEditable: isStatusEditable,
        isAppointmentReadOnly: isAppointmentReadOnly,
        isCurrentUserHasAccessToAppointment: isCurrentUserHasAccessToAppointment,
    };
};
exports.getAppointmentAccessibilityData = getAppointmentAccessibilityData;
//# sourceMappingURL=appointment-accessibility.helper.js.map