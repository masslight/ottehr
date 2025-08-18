"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useGetAppointmentAccessibility = void 0;
var react_1 = require("react");
var featureFlags_1 = require("../../features/css-module/context/featureFlags");
var useEvolveUser_1 = require("../../hooks/useEvolveUser");
var getSelectors_1 = require("../../shared/store/getSelectors");
var state_1 = require("../state");
var utils_1 = require("../utils");
var useGetAppointmentAccessibility = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'locationVirtual',
        'encounter',
        'appointment',
    ]), locationVirtual = _a.locationVirtual, encounter = _a.encounter, appointment = _a.appointment;
    var user = (0, useEvolveUser_1.default)();
    var featureFlags = (0, featureFlags_1.useFeatureFlags)();
    return (0, react_1.useMemo)(function () { return (0, utils_1.getAppointmentAccessibilityData)({ locationVirtual: locationVirtual, encounter: encounter, appointment: appointment, user: user, featureFlags: featureFlags }); }, [locationVirtual, encounter, appointment, user, featureFlags]);
};
exports.useGetAppointmentAccessibility = useGetAppointmentAccessibility;
//# sourceMappingURL=useGetAppointmentAccessibility.js.map