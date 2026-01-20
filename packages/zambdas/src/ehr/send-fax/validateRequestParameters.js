"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var data = JSON.parse(input.body);
    if (input.headers.Authorization === undefined) {
        throw utils_1.MISSING_AUTH_TOKEN;
    }
    var appointmentId = data.appointmentId, faxNumber = data.faxNumber;
    var missingParams = [];
    if (!appointmentId) {
        missingParams.push('appointmentId');
    }
    if (!faxNumber) {
        missingParams.push('faxNumber');
    }
    if (missingParams.length > 0) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(missingParams);
    }
    if (!(0, utils_1.isPhoneNumberValid)(faxNumber)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"faxNumber" is not a valid phone number');
    }
    return { appointmentId: appointmentId, faxNumber: "+1".concat(faxNumber), secrets: input.secrets };
}
