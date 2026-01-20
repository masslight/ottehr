"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMedicationAdministrationResource = createMedicationAdministrationResource;
exports.createMedicationRequest = createMedicationRequest;
exports.createMedicationStatementResource = createMedicationStatementResource;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
function createMedicationAdministrationResource(data) {
    var _a, _b;
    var orderData = data.orderData, status = data.status, route = data.route, location = data.location, createdProviderId = data.createdProviderId, orderedByProviderId = data.orderedByProviderId, administeredProviderId = data.administeredProviderId, existedMA = data.existedMA, dateTimeCreated = data.dateTimeCreated, medicationResource = data.medicationResource;
    // we can set existed resource as base for new resource
    var resource = existedMA
        ? __assign({}, existedMA) : {
        resourceType: 'MedicationAdministration',
        subject: { reference: "Patient/".concat(orderData.patient) },
        medicationReference: { reference: "#".concat(utils_1.IN_HOUSE_CONTAINED_MEDICATION_ID) },
        status: status,
    };
    // and here we updating/creating all fields that we need
    resource.meta = {
        tag: [
            {
                system: utils_1.MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_SYSTEM,
                code: utils_1.MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE,
            },
        ],
    };
    if (orderData.patient)
        resource.subject = { reference: "Patient/".concat(orderData.patient) };
    if (orderData.encounterId)
        resource.context = { reference: "Encounter/".concat(orderData.encounterId) };
    if (createdProviderId) {
        // Check if "created" provider already exists, if not add it
        var hasCreatedProvider = (_a = resource.performer) === null || _a === void 0 ? void 0 : _a.some(function (performer) { var _a, _b; return (_b = (_a = performer.function) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (coding) { return coding.code === utils_1.PRACTITIONER_ORDERED_MEDICATION_CODE; }); });
        if (!hasCreatedProvider) {
            if (!resource.performer)
                resource.performer = [];
            resource.performer.push({
                actor: { reference: "Practitioner/".concat(createdProviderId) },
                function: {
                    coding: [
                        {
                            system: utils_1.MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
                            code: utils_1.PRACTITIONER_ORDERED_MEDICATION_CODE,
                        },
                    ],
                },
            });
        }
    }
    // Add "ordered by" provider to history
    if (orderedByProviderId) {
        if (!resource.performer)
            resource.performer = [];
        resource.performer.push({
            actor: { reference: "Practitioner/".concat(orderedByProviderId) },
            function: {
                coding: [
                    {
                        system: utils_1.MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
                        code: utils_1.PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
                    },
                ],
            },
        });
    }
    if (dateTimeCreated)
        resource.effectiveDateTime = dateTimeCreated; // todo: check if this is correct, effectiveDateTime is not date of creation, it's date of administration
    if (medicationResource) {
        resource.contained = [__assign(__assign({}, medicationResource), { id: utils_1.IN_HOUSE_CONTAINED_MEDICATION_ID })];
    }
    if (orderData.dose && orderData.units) {
        resource.dosage = {
            dose: {
                unit: orderData.units,
                value: orderData.dose,
                system: utils_1.MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
            },
            route: {
                coding: [
                    {
                        code: route.code,
                        system: utils_1.MEDICATION_ADMINISTRATION_ROUTES_CODES_SYSTEM,
                        display: route.display,
                    },
                ],
            },
        };
    }
    if (orderData.reason) {
        if (!resource.note)
            resource.note = [];
        resource.note.push({
            authorString: utils_1.MEDICATION_ADMINISTRATION_REASON_CODE,
            text: orderData.reason,
        });
    }
    if (orderData.otherReason) {
        if (!resource.note)
            resource.note = [];
        resource.note.push({
            authorString: utils_1.MEDICATION_ADMINISTRATION_OTHER_REASON_CODE,
            text: orderData.otherReason,
        });
    }
    // todo: check if we should validate effectiveDateTime to add performer
    if (administeredProviderId && orderData.effectiveDateTime)
        (_b = resource.performer) === null || _b === void 0 ? void 0 : _b.push({
            actor: { reference: "Practitioner/".concat(administeredProviderId) },
            function: {
                coding: [
                    {
                        system: utils_1.MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
                        code: utils_1.PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
                    },
                ],
            },
        });
    if (orderData.instructions && resource.dosage)
        resource.dosage.text = orderData.instructions;
    if (location && resource.dosage)
        resource.dosage.site = {
            coding: [
                {
                    system: location.system,
                    code: location.code,
                    display: location.display,
                },
            ],
        };
    if (orderData.associatedDx)
        resource.reasonReference = [{ reference: "Condition/".concat(orderData.associatedDx) }];
    return resource;
}
function createMedicationRequest(data, interactions, medication) {
    var detectedIssues;
    if (interactions == null) {
        detectedIssues = [createInteractionsUnavailableIssue()];
    }
    else {
        detectedIssues = __spreadArray(__spreadArray([], interactions.drugInteractions.map(function (interaction, index) {
            return createDrugInteractionIssue('drg-' + index, interaction);
        }), true), interactions.allergyInteractions.map(function (interaction, index) {
            return createAllergyInteractionIssue('algy-' + index, interaction);
        }), true);
    }
    return {
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'order',
        subject: { reference: "Patient/".concat(data.patient) },
        encounter: data.encounterId ? { reference: "Encounter/".concat(data.encounterId) } : undefined,
        detectedIssue: detectedIssues.length > 0
            ? detectedIssues.map(function (detectedIssue) { return ({
                reference: '#' + detectedIssue.id,
            }); })
            : undefined,
        medicationReference: { reference: "#".concat(utils_1.IN_HOUSE_CONTAINED_MEDICATION_ID) },
        contained: __spreadArray([__assign(__assign({}, medication), { id: utils_1.IN_HOUSE_CONTAINED_MEDICATION_ID })], detectedIssues, true),
    };
}
function createDrugInteractionIssue(resourceId, interaction) {
    return {
        resourceType: 'DetectedIssue',
        id: resourceId,
        status: 'registered',
        code: {
            coding: [
                {
                    system: utils_1.CODE_SYSTEM_ACT_CODE_V3,
                    code: 'DRG',
                },
            ],
        },
        severity: interaction.severity,
        detail: interaction.message,
        mitigation: [
            {
                action: {
                    coding: [
                        {
                            system: utils_1.INTERACTION_OVERRIDE_REASON_CODE_SYSTEM,
                            code: interaction.overrideReason,
                            display: interaction.overrideReason,
                        },
                    ],
                },
            },
        ],
        evidence: __spreadArray(__spreadArray([], interaction.drugs.map(function (drug) {
            return {
                code: [
                    {
                        coding: [
                            {
                                system: utils_1.MEDICATION_DISPENSABLE_DRUG_ID,
                                code: drug.id,
                                display: drug.name,
                            },
                        ],
                    },
                ],
            };
        }), true), (interaction.source
            ? [
                {
                    detail: [
                        {
                            reference: interaction.source.reference,
                            display: interaction.source.display,
                        },
                    ],
                },
            ]
            : []), true),
    };
}
function createAllergyInteractionIssue(resourceId, interaction) {
    return {
        resourceType: 'DetectedIssue',
        id: resourceId,
        status: 'registered',
        code: {
            coding: [
                {
                    system: utils_1.CODE_SYSTEM_ACT_CODE_V3,
                    code: 'ALGY',
                },
            ],
        },
        detail: interaction.message,
        mitigation: [
            {
                action: {
                    coding: [
                        {
                            system: utils_1.INTERACTION_OVERRIDE_REASON_CODE_SYSTEM,
                            code: interaction.overrideReason,
                            display: interaction.overrideReason,
                        },
                    ],
                },
            },
        ],
    };
}
function createInteractionsUnavailableIssue() {
    return {
        resourceType: 'DetectedIssue',
        id: utils_1.INTERACTIONS_UNAVAILABLE,
        status: 'registered',
        code: {
            coding: [
                {
                    system: utils_1.ISSUE_TYPE_CODE_SYSTEM,
                    code: utils_1.INTERACTIONS_UNAVAILABLE,
                },
            ],
        },
    };
}
function createMedicationStatementResource(medicationAdministration, medicationCodeableConcept, options) {
    var _a, _b, _c, _d;
    if (options === void 0) { options = {}; }
    return __assign(__assign({ resourceType: 'MedicationStatement', status: 'active', partOf: [(0, utils_1.createReference)(medicationAdministration)], medicationCodeableConcept: medicationCodeableConcept, dosage: [
            {
                text: (_a = medicationAdministration.dosage) === null || _a === void 0 ? void 0 : _a.text,
                doseAndRate: [
                    {
                        doseQuantity: (_b = medicationAdministration.dosage) === null || _b === void 0 ? void 0 : _b.dose,
                    },
                ],
                route: (_c = medicationAdministration.dosage) === null || _c === void 0 ? void 0 : _c.route,
                site: (_d = medicationAdministration.dosage) === null || _d === void 0 ? void 0 : _d.site,
            },
        ], subject: medicationAdministration.subject, informationSource: { reference: 'Practitioner/' + (0, utils_1.getCreatedTheOrderProviderId)(medicationAdministration) } }, (options.effectiveDateTime && { effectiveDateTime: options.effectiveDateTime })), { meta: (0, shared_1.fillMeta)('in-house-medication', 'in-house-medication') });
}
