"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var helpers_1 = require("./helpers");
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var diagnosticReport = JSON.parse(input.body);
    if (diagnosticReport.resourceType !== 'DiagnosticReport') {
        throw new Error("resource parsed should be a DiagnosticReport but was a ".concat(diagnosticReport.resourceType));
    }
    if (!diagnosticReport.id)
        throw new Error("Triggering DiagnosticReport did not have an id. ".concat(JSON.stringify(diagnosticReport)));
    if (!helpers_1.ACCEPTED_RESULTS_STATUS.includes(diagnosticReport.status))
        throw new Error("Triggering DiagnosticReport.status was not of expected value: ".concat(helpers_1.ACCEPTED_RESULTS_STATUS.join(','), ". Id: ").concat(diagnosticReport.id, " Status: ").concat(diagnosticReport.status));
    return {
        diagnosticReport: diagnosticReport,
        secrets: input.secrets,
    };
}
