"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var _a = JSON.parse(input.body), dx = _a.dx, encounter = _a.encounter, orderableItem = _a.orderableItem, psc = _a.psc, orderingLocation = _a.orderingLocation, selectedPaymentMethod = _a.selectedPaymentMethod, clinicalInfoNoteByUser = _a.clinicalInfoNoteByUser;
    var missingResources = [];
    if (!dx)
        missingResources.push('dx (diagnosis)');
    if (!encounter)
        missingResources.push('encounter');
    if (!orderableItem)
        missingResources.push('orderableItem (lab test)');
    if (!orderingLocation)
        missingResources.push('ordering location');
    if (!selectedPaymentMethod)
        missingResources.push('selectedPaymentMethod');
    if (missingResources.length) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(missingResources);
    }
    return {
        dx: dx,
        encounter: encounter,
        orderableItem: orderableItem,
        psc: psc,
        orderingLocation: orderingLocation,
        selectedPaymentMethod: selectedPaymentMethod,
        clinicalInfoNoteByUser: clinicalInfoNoteByUser,
        secrets: input.secrets,
    };
}
