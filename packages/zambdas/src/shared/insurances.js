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
exports.createInsurancePlanDto = void 0;
var utils_1 = require("utils");
var createInsurancePlanDto = function (insuranceOrg) {
    var _a, _b;
    var id = insuranceOrg.id, name = insuranceOrg.name, extension = insuranceOrg.extension;
    var payerId = (0, utils_1.getPayerId)(insuranceOrg);
    if (!id || !name) {
        throw new Error('Insurance missing id or name.');
    }
    if (!payerId) {
        throw new Error('Insurance is missing payerId.');
    }
    var insurancePlanDto = __assign({ id: id, name: name, payerId: payerId }, Object.fromEntries(utils_1.eligibilityRequirementKeys.map(function (key) { return [key, false]; })));
    (_b = (_a = extension === null || extension === void 0 ? void 0 : extension.find(function (extension) { return extension.url === utils_1.INSURANCE_REQ_EXTENSION_URL; })) === null || _a === void 0 ? void 0 : _a.extension) === null || _b === void 0 ? void 0 : _b.forEach(function (requirement) {
        insurancePlanDto[requirement.url] = requirement.valueBoolean || false;
    });
    return insurancePlanDto;
};
exports.createInsurancePlanDto = createInsurancePlanDto;
