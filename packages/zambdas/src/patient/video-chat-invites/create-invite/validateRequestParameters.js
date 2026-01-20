"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), appointmentId = _a.appointmentId, firstName = _a.firstName, lastName = _a.lastName, phoneNumber = _a.phoneNumber, emailAddress = _a.emailAddress;
    if (!appointmentId) {
        throw new Error('appointmentId is not defined');
    }
    if (!firstName) {
        throw new Error('firstName is not defined');
    }
    if (!lastName) {
        throw new Error('lastName is not defined');
    }
    if (!phoneNumber && !emailAddress) {
        throw new Error('emailAddress or phoneNumber is not defined. At least one must be provided.');
    }
    // TODO: Temporary disable it. Currently front-end sends in (xxx) xxxx-xxx format. Fix front-end.
    //if (phoneNumber && !phoneRegex.test(phoneNumber)) {
    //  throw new Error('phoneNumber is not valid');
    //}
    if (emailAddress && !utils_1.emailRegex.test(emailAddress)) {
        throw new Error('emailAddress is not valid');
    }
    return {
        appointmentId: appointmentId,
        firstName: firstName,
        lastName: lastName,
        phoneNumber: phoneNumber,
        emailAddress: emailAddress,
        secrets: input.secrets,
    };
}
