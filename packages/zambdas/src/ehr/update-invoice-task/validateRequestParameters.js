"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    if (!input.body)
        throw utils_1.MISSING_REQUEST_BODY;
    if (input.secrets == null)
        throw utils_1.MISSING_REQUEST_SECRETS;
    var parsedJSON = JSON.parse(input.body);
    var _a = utils_1.UpdateInvoiceTaskZambdaInputSchema.parse(parsedJSON), taskId = _a.taskId, status = _a.status, prefilledInvoiceInfo = _a.prefilledInvoiceInfo, userTimezone = _a.userTimezone;
    return {
        taskId: taskId,
        status: status,
        prefilledInvoiceInfo: prefilledInvoiceInfo,
        secrets: input.secrets,
        userTimezone: userTimezone,
    };
}
