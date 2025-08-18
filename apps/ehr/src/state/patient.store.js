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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInsurancePlanDto = exports.usePatientStore = void 0;
var utils_1 = require("utils");
var zustand_1 = require("zustand");
var PATIENT_INITIAL = {
    patient: null,
    insurances: [],
    policyHolders: [],
    tempInsurances: [],
    insurancePlans: [],
    patchOperations: {
        patient: [],
        coverages: {},
        relatedPersons: {},
    },
};
exports.usePatientStore = (0, zustand_1.create)()(function (set) { return (__assign(__assign({}, PATIENT_INITIAL), { setPatient: function (patient) { return set({ patient: patient }); }, setInsurancePlans: function (insurancePlans) { return set({ insurancePlans: insurancePlans }); }, reset: function () {
        set({
            patchOperations: PATIENT_INITIAL.patchOperations,
        });
    } })); });
var createInsurancePlanDto = function (organization) {
    var _a, _b;
    var id = organization.id, name = organization.name, partOf = organization.partOf, extension = organization.extension;
    if (!id || !name) {
        throw new Error('Insurance is missing id, name or owning organization.');
    }
    var payerId = (0, utils_1.getPayerId)(organization);
    if (!payerId) {
        throw new Error('Owning organization is missing payer-id.');
    }
    var insurancePlanDto = __assign({ id: id, name: name, ownedBy: partOf, payerId: payerId }, Object.fromEntries(utils_1.eligibilityRequirementKeys.map(function (key) { return [key, false]; })));
    (_b = (_a = extension === null || extension === void 0 ? void 0 : extension.find(function (extension) { return extension.url === 'https://extensions.fhir.zapehr.com/insurance-requirements'; })) === null || _a === void 0 ? void 0 : _a.extension) === null || _b === void 0 ? void 0 : _b.forEach(function (requirement) {
        insurancePlanDto[requirement.url] = requirement.valueBoolean || false;
    });
    return insurancePlanDto;
};
exports.createInsurancePlanDto = createInsurancePlanDto;
//# sourceMappingURL=patient.store.js.map