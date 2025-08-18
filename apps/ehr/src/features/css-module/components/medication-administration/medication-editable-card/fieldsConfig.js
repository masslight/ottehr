"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFieldLabel = exports.fieldsConfig = exports.fieldsConfigForNotAdministered = exports.fieldsConfigForDispense = exports.fieldsConfigForOrder = void 0;
exports.fieldsConfigForOrder = {
    medicationId: { xs: 6, isRequired: true },
    associatedDx: { xs: 6, isRequired: false },
    dose: { xs: 6, isRequired: true },
    units: { xs: 6, isRequired: true },
    manufacturer: { xs: 6, isRequired: false },
    route: { xs: 6, isRequired: true },
    providerId: { xs: 6, isRequired: true },
    // TODO: uncomment when the "anatomical locations" feature is completed
    // location: { xs: 6, isRequired: false },
    instructions: { xs: 12, isRequired: false },
};
exports.fieldsConfigForDispense = {
    medicationId: { xs: 6, isRequired: true },
    associatedDx: { xs: 6, isRequired: false },
    dose: { xs: 6, isRequired: true },
    units: { xs: 6, isRequired: true },
    lotNumber: { xs: 3, isRequired: true },
    expDate: { xs: 3, isRequired: true },
    manufacturer: { xs: 6, isRequired: false },
    route: { xs: 6, isRequired: true },
    providerId: { xs: 6, isRequired: true },
    // TODO: uncomment when the "anatomical locations" feature is completed
    // location: { xs: 6, isRequired: false },
    effectiveDateTime: { xs: 6, isRequired: true },
    instructions: { xs: 12, isRequired: false },
};
exports.fieldsConfigForNotAdministered = {
    medicationId: { xs: 6, isRequired: true },
    associatedDx: { xs: 6, isRequired: false },
    dose: { xs: 6, isRequired: true },
    units: { xs: 6, isRequired: true },
    lotNumber: { xs: 3, isRequired: false }, // Not required for partial administration
    expDate: { xs: 3, isRequired: false }, // Not required for partial administration
    manufacturer: { xs: 6, isRequired: false },
    route: { xs: 6, isRequired: true },
    providerId: { xs: 6, isRequired: true },
    // TODO: uncomment when the "anatomical locations" feature is completed
    // location: { xs: 6, isRequired: false },
    effectiveDateTime: { xs: 6, isRequired: true },
    instructions: { xs: 12, isRequired: false },
};
exports.fieldsConfig = {
    'order-new': exports.fieldsConfigForOrder,
    'order-edit': exports.fieldsConfigForOrder,
    dispense: exports.fieldsConfigForDispense,
    'dispense-not-administered': exports.fieldsConfigForNotAdministered,
};
var getFieldLabel = function (field, form) {
    if (form === void 0) { form = 'form-independent'; }
    var labelMap = {
        medicationId: { 'form-independent': 'Medication' },
        associatedDx: { 'form-independent': 'Associated Dx' },
        dose: { 'form-independent': 'Dose' },
        units: { 'form-independent': 'Units' },
        manufacturer: { 'form-independent': 'Manufacturer' },
        route: { 'form-independent': 'Route' },
        providerId: { 'form-independent': 'Ordered by' },
        effectiveDateTime: { 'form-independent': 'Date/Time Given' },
        instructions: { 'form-independent': 'Instructions', dispense: 'Comments', 'dispense-not-administered': 'Comments' },
        lotNumber: { 'form-independent': 'Lot Number' },
        expDate: { 'form-independent': 'Expiration Date' },
    };
    return labelMap[field][form] || labelMap[field]['form-independent'] || field;
};
exports.getFieldLabel = getFieldLabel;
//# sourceMappingURL=fieldsConfig.js.map