"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivacyPolicyAcknowledgement = void 0;
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var PrivacyPolicyAcknowledgement = function () {
    var appointment = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['appointment']).appointment;
    var appointmentStart = (0, utils_1.formatDateToMDYWithTime)(appointment === null || appointment === void 0 ? void 0 : appointment.start);
    return (<material_1.Typography variant="body2" color="secondary.light">
      {"Privacy Policy and Terms and Conditions of Service were reviewed and accepted on ".concat(appointmentStart, ".")}
    </material_1.Typography>);
};
exports.PrivacyPolicyAcknowledgement = PrivacyPolicyAcknowledgement;
//# sourceMappingURL=PrivacyPolicyAcknowledgement.js.map