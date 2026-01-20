"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), requestType = _a.requestType, diagnosticReportId = _a.diagnosticReportId, patientId = _a.patientId;
    var validRequestTypes = Object.values(utils_1.UnsolicitedResultsRequestType);
    if (!validRequestTypes.includes(requestType)) {
        throw new Error("Invalid requestType: ".concat(requestType));
    }
    if (requestType === utils_1.UnsolicitedResultsRequestType.MATCH_UNSOLICITED_RESULTS ||
        requestType === utils_1.UnsolicitedResultsRequestType.GET_UNSOLICITED_RESULTS_RELATED_REQUESTS ||
        requestType === utils_1.UnsolicitedResultsRequestType.UNSOLICITED_RESULTS_DETAIL) {
        if (!diagnosticReportId || typeof diagnosticReportId !== 'string') {
            throw Error("diagnosticReportId is an unexpected type: ".concat(diagnosticReportId));
        }
    }
    if (requestType === utils_1.UnsolicitedResultsRequestType.GET_UNSOLICITED_RESULTS_RELATED_REQUESTS ||
        requestType === utils_1.UnsolicitedResultsRequestType.UNSOLICITED_RESULTS_PATIENT_LIST) {
        if (!patientId || typeof patientId !== 'string') {
            throw Error("patientId is an unexpected type: ".concat(patientId));
        }
    }
    return {
        requestType: requestType,
        diagnosticReportId: diagnosticReportId,
        patientId: patientId,
        secrets: input.secrets,
    };
}
