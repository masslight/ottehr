"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    console.group('validateRequestParameters');
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), orderId = _a.orderId, newStatus = _a.newStatus, orderData = _a.orderData, interactions = _a.interactions;
    if (newStatus) {
        if (newStatus === 'administered' && !orderData) {
            throw new Error("With status 'administered' order data should be provided.");
        }
        if (newStatus === 'pending') {
            throw new Error('Cannot change status back to pending.');
        }
        if (orderId && newStatus !== 'administered' && newStatus !== 'cancelled' && !(orderData === null || orderData === void 0 ? void 0 : orderData.reason)) {
            throw new Error("Reason should be provided if you changing status to anything except 'administered'");
        }
        if (newStatus === 'administered') {
            if (!orderData.effectiveDateTime)
                throw new Error('On status change to "administered" effectiveDateTime field should be present in zambda input');
        }
        var missedFields = [];
        if (orderData && !orderId) {
            if (!orderData.patient)
                missedFields.push('patient');
            if (!orderData.encounter)
                missedFields.push('encounter');
            if (!orderData.medicationId)
                missedFields.push('medicationId');
            if (!orderData.units)
                missedFields.push('units');
            if (!orderData.dose)
                missedFields.push('dose');
            if (!orderData.route)
                missedFields.push('route');
        }
        if (missedFields.length > 0)
            throw new Error("Missing fields in orderData: ".concat(missedFields.join(', ')));
    }
    validateInteractions(interactions);
    console.groupEnd();
    console.debug('validateRequestParameters success');
    return {
        orderId: orderId,
        newStatus: newStatus,
        orderData: orderData,
        secrets: input.secrets,
        interactions: interactions,
    };
}
function validateInteractions(interactions) {
    var _a, _b;
    var missingOverrideReason = [];
    (_a = interactions === null || interactions === void 0 ? void 0 : interactions.drugInteractions) === null || _a === void 0 ? void 0 : _a.forEach(function (interaction, index) {
        if (!interaction.overrideReason) {
            missingOverrideReason.push("interactions.drugInteractions[".concat(index, "]"));
        }
    });
    (_b = interactions === null || interactions === void 0 ? void 0 : interactions.allergyInteractions) === null || _b === void 0 ? void 0 : _b.forEach(function (interaction, index) {
        if (!interaction.overrideReason) {
            missingOverrideReason.push("interactions.allergyInteractions[".concat(index, "]"));
        }
    });
    if (missingOverrideReason.length > 0) {
        throw new Error("overrideReason is missing for ".concat(missingOverrideReason.join(', ')));
    }
}
