"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    var authorization = input.headers.Authorization;
    if (!authorization) {
        throw utils_1.NOT_AUTHORIZED;
    }
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), beneficiaryPatientId = _a.beneficiaryPatientId, appointmentId = _a.appointmentId;
    if (!beneficiaryPatientId) {
        throw new Error('beneficiaryPatientId is not defined');
    }
    if (!(0, utils_1.isValidUUID)(beneficiaryPatientId)) {
        throw new Error('beneficiaryPatientId is not a valid UUID');
    }
    if (!appointmentId) {
        throw new Error('appointmentId is not defined');
    }
    if (!(0, utils_1.isValidUUID)(appointmentId)) {
        throw new Error('appointmentId is not a valid UUID');
    }
    return {
        beneficiaryPatientId: beneficiaryPatientId,
        appointmentId: appointmentId,
        secrets: input.secrets,
        authorization: authorization,
    };
}
