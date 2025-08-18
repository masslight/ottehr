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
exports.mapAdditionalInsuranceToCoverageResource = exports.mapAdditionalInsuranceToRelatedPersonResource = exports.mapInsuredInformationToRelatedPersonResource = exports.mapInsuredInformationToCoverageResource = exports.mapPatientInformationToCoverageResource = exports.getCoverageData = void 0;
var utils_1 = require("utils");
var patient_helper_1 = require("./patient.helper");
var resources_helper_1 = require("./resources.helper");
var getCoverageData = function (coverage, subscriber) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    var relationship = (_c = (_b = (_a = coverage === null || coverage === void 0 ? void 0 : coverage.relationship) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (item) { return item.system === utils_1.FHIR_EXTENSION.Coverage.subscriberRelationship.url; })) === null || _c === void 0 ? void 0 : _c.display;
    var subscriberId = coverage === null || coverage === void 0 ? void 0 : coverage.subscriberId;
    var subscriberData = (0, patient_helper_1.getPatientData)(subscriber);
    var policyGroup = (_e = (_d = coverage === null || coverage === void 0 ? void 0 : coverage.class) === null || _d === void 0 ? void 0 : _d.find(function (item) {
        var _a;
        return (_a = item.type.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) { return coding.system === utils_1.FHIR_EXTENSION.Coverage.coverageClass.url && coding.code === 'group'; });
    })) === null || _e === void 0 ? void 0 : _e.value;
    var planName = (_g = (_f = coverage === null || coverage === void 0 ? void 0 : coverage.class) === null || _f === void 0 ? void 0 : _f.find(function (item) {
        var _a;
        return (_a = item.type.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) { return coding.system === utils_1.FHIR_EXTENSION.Coverage.coverageClass.url && coding.code === 'plan'; });
    })) === null || _g === void 0 ? void 0 : _g.name;
    var organizationId = (_k = (_j = (_h = coverage === null || coverage === void 0 ? void 0 : coverage.payor) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.reference) === null || _k === void 0 ? void 0 : _k.split('/')[1];
    return __assign(__assign({ relationship: relationship, subscriberId: subscriberId }, subscriberData), { policyGroup: policyGroup, planName: planName, organizationId: organizationId });
};
exports.getCoverageData = getCoverageData;
var mapPatientInformationToCoverageResource = function (coverage, patientInformation) {
    var _a;
    var coverageCopy = structuredClone(coverage);
    var relationship = patientInformation.relationship;
    var relationshipCoding = {
        system: utils_1.FHIR_EXTENSION.Coverage.subscriberRelationship.url,
        code: relationship.toLowerCase(),
        display: relationship,
    };
    if (!((_a = coverageCopy.relationship) === null || _a === void 0 ? void 0 : _a.coding)) {
        coverageCopy.relationship = __assign(__assign({}, coverageCopy.relationship), { coding: [] });
    }
    if (!coverageCopy.relationship.coding.find(function (item) { return item.system === utils_1.FHIR_EXTENSION.Coverage.subscriberRelationship.url; })) {
        coverageCopy.relationship.coding = __spreadArray(__spreadArray([], (coverageCopy.relationship.coding || []), true), [relationshipCoding], false);
    }
    else {
        coverageCopy.relationship.coding = coverageCopy.relationship.coding.map(function (item) {
            return item.system === utils_1.FHIR_EXTENSION.Coverage.subscriberRelationship.url ? relationshipCoding : item;
        });
    }
    return coverageCopy;
};
exports.mapPatientInformationToCoverageResource = mapPatientInformationToCoverageResource;
var isCoverageClass = function (coverageClass, code) {
    var _a;
    return (_a = coverageClass.type.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) { return coding.system === utils_1.FHIR_EXTENSION.Coverage.coverageClass.url && coding.code === code; });
};
var findCoverageClass = function (coverageClasses, code) { return coverageClasses === null || coverageClasses === void 0 ? void 0 : coverageClasses.find(function (item) { return isCoverageClass(item, code); }); };
var updateOrCreateCoveragePlanClass = function (coverageClass, planOwnedBy) {
    var _a, _b, _c, _d, _e;
    var getIdentifierCoding = function (coding) {
        return coding === null || coding === void 0 ? void 0 : coding.find(function (coding) { return coding.system === 'payer-id'; });
    };
    var name = planOwnedBy === null || planOwnedBy === void 0 ? void 0 : planOwnedBy.name;
    var value = (_e = getIdentifierCoding((_d = (_c = (_b = (_a = planOwnedBy === null || planOwnedBy === void 0 ? void 0 : planOwnedBy.ownedBy) === null || _a === void 0 ? void 0 : _a.identifier) === null || _b === void 0 ? void 0 : _b.find(function (id) { var _a; return getIdentifierCoding((_a = id.type) === null || _a === void 0 ? void 0 : _a.coding); })) === null || _c === void 0 ? void 0 : _c.type) === null || _d === void 0 ? void 0 : _d.coding)) === null || _e === void 0 ? void 0 : _e.code;
    if (coverageClass) {
        return __assign(__assign({}, coverageClass), { name: name || coverageClass.name, value: value || coverageClass.value });
    }
    else {
        return {
            name: name,
            value: value || '',
            type: { coding: [{ code: 'plan', system: utils_1.FHIR_EXTENSION.Coverage.coverageClass.url }] },
        };
    }
};
var updateOrCreateCoverageGroupClass = function (coverageClass, value) {
    if (coverageClass) {
        return __assign(__assign({}, coverageClass), { name: coverageClass.name, value: value });
    }
    else {
        return {
            value: value,
            type: { coding: [{ code: 'group', system: utils_1.FHIR_EXTENSION.Coverage.coverageClass.url }] },
        };
    }
};
var mapPolicyGroupToCoverageResource = function (coverageCopy, insuredInformation) {
    var _a;
    if (insuredInformation.policyGroup) {
        var groupClass = findCoverageClass(coverageCopy.class, 'group');
        var modifiedGroupClass_1 = updateOrCreateCoverageGroupClass(groupClass, insuredInformation.policyGroup);
        if (groupClass) {
            coverageCopy.class = coverageCopy.class.map(function (coverageClass) {
                return isCoverageClass(coverageClass, 'group') ? modifiedGroupClass_1 : coverageClass;
            });
        }
        else {
            coverageCopy.class = __spreadArray(__spreadArray([], (coverageCopy.class || []), true), [modifiedGroupClass_1], false);
        }
    }
    else {
        coverageCopy.class = (_a = coverageCopy.class) === null || _a === void 0 ? void 0 : _a.filter(function (coverageClass) { return !isCoverageClass(coverageClass, 'group'); });
    }
};
var mapInsuredInformationToCoverageResource = function (coverage, insuredInformation) {
    var _a, _b;
    var coverageCopy = structuredClone(coverage);
    // planName
    var planClass = findCoverageClass(coverageCopy.class, 'plan');
    var modifiedPlanClass = updateOrCreateCoveragePlanClass(planClass, insuredInformation.planAndPayor);
    if (planClass) {
        coverageCopy.class = coverageCopy.class.map(function (coverageClass) {
            return isCoverageClass(coverageClass, 'plan') ? modifiedPlanClass : coverageClass;
        });
    }
    else {
        coverageCopy.class = __spreadArray(__spreadArray([], (coverageCopy.class || []), true), [modifiedPlanClass], false);
    }
    // organizationId
    coverageCopy.payor = [{ reference: "Organization/".concat(((_b = (_a = insuredInformation.planAndPayor) === null || _a === void 0 ? void 0 : _a.ownedBy) === null || _b === void 0 ? void 0 : _b.id) || '') }];
    // subscriberId
    coverageCopy.subscriberId = insuredInformation.insuredID;
    mapPolicyGroupToCoverageResource(coverageCopy, insuredInformation);
    return coverageCopy;
};
exports.mapInsuredInformationToCoverageResource = mapInsuredInformationToCoverageResource;
var mapInsuredInformationToRelatedPersonResource = function (subscriber, insuredInformation) {
    var subscriberCopy = structuredClone(subscriber);
    (0, resources_helper_1.mapPersonInformationToResource)(subscriberCopy, insuredInformation);
    return subscriberCopy;
};
exports.mapInsuredInformationToRelatedPersonResource = mapInsuredInformationToRelatedPersonResource;
var mapAdditionalInsuranceToRelatedPersonResource = function (subscriber, insuredInformation) {
    var subscriberCopy = structuredClone(subscriber);
    (0, resources_helper_1.mapPersonNameToResource)(subscriberCopy, insuredInformation);
    return subscriberCopy;
};
exports.mapAdditionalInsuranceToRelatedPersonResource = mapAdditionalInsuranceToRelatedPersonResource;
var mapAdditionalInsuranceToCoverageResource = function (coverage, insuredInformation) {
    var coverageCopy = structuredClone(coverage);
    mapPolicyGroupToCoverageResource(coverageCopy, insuredInformation);
    return coverageCopy;
};
exports.mapAdditionalInsuranceToCoverageResource = mapAdditionalInsuranceToCoverageResource;
//# sourceMappingURL=coverage.helper.js.map