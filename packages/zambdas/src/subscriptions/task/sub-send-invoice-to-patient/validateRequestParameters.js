"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    var _a, _b;
    if (!input.body)
        throw utils_1.MISSING_REQUEST_BODY;
    var inputRes = JSON.parse(input.body);
    if (inputRes.resourceType !== 'Task') {
        throw new Error("resource parsed should be a Task but was a ".concat(inputRes.resourceType));
    }
    var task = inputRes;
    var prefilledInfo = (0, utils_1.parseInvoiceTaskInput)(task);
    if (!prefilledInfo)
        throw new Error('Prefilled info is not found');
    if (prefilledInfo.amountCents <= 0)
        throw new Error('Amount is not valid');
    var encounterId = (_b = (_a = task.encounter) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/')[1];
    if (!encounterId)
        throw new Error('Encounter id is not found');
    return {
        task: task,
        encounterId: encounterId,
        prefilledInfo: prefilledInfo,
        secrets: input.secrets,
    };
}
