"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        return { secrets: input.secrets };
    }
    else {
        var _a = JSON.parse(input.body), patientID = _a.patientID, dateRange = _a.dateRange;
        return {
            patientID: patientID,
            dateRange: dateRange,
            secrets: input.secrets,
        };
    }
}
