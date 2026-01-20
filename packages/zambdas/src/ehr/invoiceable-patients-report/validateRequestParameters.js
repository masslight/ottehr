"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    console.log('validating request parameters');
    if (!input.secrets) {
        throw new Error('Input did not have any secrets');
    }
    var parsedJSON = JSON.parse(input.body);
    var inputDate = utils_1.CreateInvoiceablePatientsReportZambdaInput.parse(parsedJSON).startFrom;
    if (inputDate) {
        var startFrom = luxon_1.DateTime.fromISO(inputDate);
        if (!startFrom.isValid) {
            throw new Error("Invalid date format provided: ".concat(startFrom.invalidReason));
        }
        return { secrets: input.secrets, startFrom: startFrom };
    }
    return {
        secrets: input.secrets,
    };
}
