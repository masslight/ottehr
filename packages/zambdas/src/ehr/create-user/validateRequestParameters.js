"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), email = _a.email, applicationID = _a.applicationID, firstName = _a.firstName, lastName = _a.lastName;
    if (!email || !applicationID || !firstName || !lastName) {
        throw new Error('These fields are required: "email", "applicationID", "firstName", "lastName"');
    }
    return {
        email: email,
        applicationID: applicationID,
        firstName: firstName,
        lastName: lastName,
        secrets: input.secrets,
    };
}
