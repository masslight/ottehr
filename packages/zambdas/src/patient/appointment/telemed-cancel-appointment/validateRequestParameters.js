"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    console.group('validateRequestParameters');
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), appointmentID = _a.appointmentID, cancellationReason = _a.cancellationReason, cancellationReasonAdditional = _a.cancellationReasonAdditional;
    if (appointmentID === undefined || cancellationReason === undefined) {
        throw new Error('These fields are required: "appointmentID", "cancellationReason"');
    }
    if (!(utils_1.VALUE_SETS.cancelReasonOptionsVirtual.some(function (option) { return option.value === cancellationReason; }) ||
        utils_1.VALUE_SETS.cancelReasonOptionsVirtualProviderSide.some(function (option) { return option.value === cancellationReason; }))) {
        throw new Error("\"cancellationReason\" must be one of the following values: ".concat(JSON.stringify(utils_1.VALUE_SETS.cancelReasonOptionsVirtual.map(function (option) { return option.value; }), utils_1.VALUE_SETS.cancelReasonOptionsVirtualProviderSide.map(function (option) { return option.value; }))));
    }
    console.groupEnd();
    console.debug('validateRequestParameters success');
    return {
        appointmentID: appointmentID,
        cancellationReason: cancellationReason,
        cancellationReasonAdditional: cancellationReasonAdditional,
        secrets: input.secrets,
    };
}
