"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), appointmentId = _a.appointmentId, emailAddress = _a.emailAddress, phoneNumber = _a.phoneNumber;
    if (!appointmentId) {
        throw new Error('appointmentId is not defined');
    }
    if (!emailAddress && !phoneNumber) {
        throw new Error('emailAddress or phoneNumber is not defined');
    }
    if (emailAddress && !utils_1.emailRegex.test(emailAddress)) {
        throw new Error('emailAddress is not valid');
    }
    if (phoneNumber && !utils_1.phoneRegex.test(phoneNumber)) {
        throw new Error('phoneNumber is not valid');
    }
    return {
        appointmentId: appointmentId,
        emailAddress: emailAddress,
        phoneNumber: phoneNumber,
        secrets: input.secrets,
    };
}
