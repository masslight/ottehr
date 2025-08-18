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
exports.mapSLBProviderToClaimResource = exports.mapBillingToClaimResource = exports.mapDiagnosesToClaimResource = exports.mapAdditionalInformationToClaimResource = exports.getClaimData = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var resources_helper_1 = require("./resources.helper");
function getCode(codeableConcept, system) {
    var _a, _b;
    return (_b = (_a = codeableConcept === null || codeableConcept === void 0 ? void 0 : codeableConcept.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) { return coding.system === system; })) === null || _b === void 0 ? void 0 : _b.code;
}
function isSupportingInfo(supportingInfo, category) {
    return getCode(supportingInfo.category, utils_1.FHIR_EXTENSION.Claim.claimInformationCategory.url) === category;
}
function findSupportingInfo(supportingInfo, category) {
    return supportingInfo === null || supportingInfo === void 0 ? void 0 : supportingInfo.find(function (supportingInfo) { return isSupportingInfo(supportingInfo, category); });
}
var getClaimData = function (claim) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14;
    // 10a
    var conditionRelatedToEmployment = !!((_c = (_b = (_a = claim === null || claim === void 0 ? void 0 : claim.accident) === null || _a === void 0 ? void 0 : _a.type) === null || _b === void 0 ? void 0 : _b.coding) === null || _c === void 0 ? void 0 : _c.find(function (coding) { return coding.code === 'WPA' && coding.system === utils_1.FHIR_EXTENSION.Claim.v3_ActCode.url; }));
    // 10b
    var conditionRelatedToAutoAccident = !!((_f = (_e = (_d = claim === null || claim === void 0 ? void 0 : claim.accident) === null || _d === void 0 ? void 0 : _d.type) === null || _e === void 0 ? void 0 : _e.coding) === null || _f === void 0 ? void 0 : _f.find(function (coding) { return coding.code === 'MVA' && coding.system === utils_1.FHIR_EXTENSION.Claim.v3_ActCode.url; }));
    var autoAccidentState = (_h = (_g = claim === null || claim === void 0 ? void 0 : claim.accident) === null || _g === void 0 ? void 0 : _g.locationAddress) === null || _h === void 0 ? void 0 : _h.state;
    // 10c
    var conditionRelatedToOtherAccident = !!((_l = (_k = (_j = claim === null || claim === void 0 ? void 0 : claim.accident) === null || _j === void 0 ? void 0 : _j.type) === null || _k === void 0 ? void 0 : _k.coding) === null || _l === void 0 ? void 0 : _l.find(function (coding) { return coding.code === undefined && coding.system === utils_1.FHIR_EXTENSION.Claim.v3_ActCode.url; }));
    var conditionRelatedToMixed = [
        conditionRelatedToEmployment && 'a. Employment',
        conditionRelatedToAutoAccident && autoAccidentState && "b. Auto accident, ".concat(autoAccidentState),
        conditionRelatedToOtherAccident && 'c. Other accident',
    ]
        .filter(function (value) { return !!value; })
        .join(', ');
    // 10d
    var claimCodeExtensions = (_m = claim === null || claim === void 0 ? void 0 : claim.extension) === null || _m === void 0 ? void 0 : _m.filter(function (extension) { return extension.url === utils_1.FHIR_EXTENSION.Claim.claimConditionCode.url; });
    var claimCode1 = (_o = claimCodeExtensions === null || claimCodeExtensions === void 0 ? void 0 : claimCodeExtensions[0]) === null || _o === void 0 ? void 0 : _o.valueString;
    var claimCode2 = (_p = claimCodeExtensions === null || claimCodeExtensions === void 0 ? void 0 : claimCodeExtensions[1]) === null || _p === void 0 ? void 0 : _p.valueString;
    var claimCode3 = (_q = claimCodeExtensions === null || claimCodeExtensions === void 0 ? void 0 : claimCodeExtensions[2]) === null || _q === void 0 ? void 0 : _q.valueString;
    var claimCodes = [claimCode1, claimCode2, claimCode3].filter(function (value) { return !!value; }).join(', ');
    // 14
    var dateOfIllness = claim && (0, resources_helper_1.getDateFromISO)((_r = findSupportingInfo(claim.supportingInfo, 'onset')) === null || _r === void 0 ? void 0 : _r.timingDate);
    // 16
    var employmentImpacted = claim && findSupportingInfo(claim.supportingInfo, 'employmentimpacted');
    var unableToWork = {
        start: (0, resources_helper_1.getDateFromISO)((_s = employmentImpacted === null || employmentImpacted === void 0 ? void 0 : employmentImpacted.timingPeriod) === null || _s === void 0 ? void 0 : _s.start),
        end: (0, resources_helper_1.getDateFromISO)((_t = employmentImpacted === null || employmentImpacted === void 0 ? void 0 : employmentImpacted.timingPeriod) === null || _t === void 0 ? void 0 : _t.end),
    };
    var unableToWorkString = unableToWork.start &&
        unableToWork.end &&
        "".concat(unableToWork.start.toFormat('MM/dd/yyyy'), "-").concat(unableToWork.end.toFormat('MM/dd/yyyy'));
    // 18
    var hospitalized = claim && findSupportingInfo(claim.supportingInfo, 'hospitalized');
    var hospitalizationDates = {
        start: (0, resources_helper_1.getDateFromISO)((_u = hospitalized === null || hospitalized === void 0 ? void 0 : hospitalized.timingPeriod) === null || _u === void 0 ? void 0 : _u.start),
        end: (0, resources_helper_1.getDateFromISO)((_v = hospitalized === null || hospitalized === void 0 ? void 0 : hospitalized.timingPeriod) === null || _v === void 0 ? void 0 : _v.end),
    };
    var hospitalizationDatesString = hospitalizationDates.start &&
        hospitalizationDates.end &&
        "".concat(hospitalizationDates.start.toFormat('MM/dd/yyyy'), "-").concat(hospitalizationDates.end.toFormat('MM/dd/yyyy'));
    // 22 resubmission code
    var resubmissionCode = (_0 = (_z = (_y = (_x = (_w = claim === null || claim === void 0 ? void 0 : claim.related) === null || _w === void 0 ? void 0 : _w[0]) === null || _x === void 0 ? void 0 : _x.relationship) === null || _y === void 0 ? void 0 : _y.coding) === null || _z === void 0 ? void 0 : _z.find(function (coding) { return coding.system === utils_1.FHIR_EXTENSION.Claim.resubmissionRelationship.url; })) === null || _0 === void 0 ? void 0 : _0.code;
    // 23
    var priorAuthNumber = (_3 = (_2 = (_1 = claim === null || claim === void 0 ? void 0 : claim.insurance) === null || _1 === void 0 ? void 0 : _1[0]) === null || _2 === void 0 ? void 0 : _2.preAuthRef) === null || _3 === void 0 ? void 0 : _3[0];
    // 21
    var diagnoses = (_4 = claim === null || claim === void 0 ? void 0 : claim.diagnosis) === null || _4 === void 0 ? void 0 : _4.map(function (diagnosis) {
        var _a, _b, _c, _d, _e, _f;
        return ({
            code: ((_c = (_b = (_a = diagnosis.diagnosisCodeableConcept) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.code) || '',
            display: ((_f = (_e = (_d = diagnosis.diagnosisCodeableConcept) === null || _d === void 0 ? void 0 : _d.coding) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.display) || '',
        });
    });
    var diagnosesComment = (_6 = (_5 = claim === null || claim === void 0 ? void 0 : claim.extension) === null || _5 === void 0 ? void 0 : _5.find(function (extension) { return extension.url === utils_1.FHIR_EXTENSION.Claim.claimDiagnosesComment.url; })) === null || _6 === void 0 ? void 0 : _6.valueString;
    // 32
    var facilityId = (_9 = (_8 = (_7 = claim === null || claim === void 0 ? void 0 : claim.facility) === null || _7 === void 0 ? void 0 : _7.reference) === null || _8 === void 0 ? void 0 : _8.split('/')) === null || _9 === void 0 ? void 0 : _9[1];
    // 24
    var billingItems = (_10 = claim === null || claim === void 0 ? void 0 : claim.item) === null || _10 === void 0 ? void 0 : _10.map(function (item) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return ({
            date: [
                ((_a = item.servicedPeriod) === null || _a === void 0 ? void 0 : _a.start) ? luxon_1.DateTime.fromISO(item.servicedPeriod.start) : null,
                ((_b = item.servicedPeriod) === null || _b === void 0 ? void 0 : _b.end) ? luxon_1.DateTime.fromISO(item.servicedPeriod.end) : null,
            ],
            // place: '', // ?
            emergency: !!((_d = (_c = item.revenue) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d.find(function (coding) { return coding.system === utils_1.FHIR_EXTENSION.Claim.revenueCode.url && coding.code === '1001'; })),
            code: ((_g = (_f = (_e = item.productOrService) === null || _e === void 0 ? void 0 : _e.coding) === null || _f === void 0 ? void 0 : _f.find(function (coding) { return coding.system === 'http://www.ama-assn.org/go/cpt'; })) === null || _g === void 0 ? void 0 : _g.code) || '',
            modifiers: ((_h = item.modifier) === null || _h === void 0 ? void 0 : _h.filter(function (modifier) { var _a; return (_a = modifier === null || modifier === void 0 ? void 0 : modifier.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) { return coding.system === utils_1.FHIR_EXTENSION.Claim.procedureModifier.url; }); }).map(function (modifier) { var _a, _b; return (_b = (_a = modifier === null || modifier === void 0 ? void 0 : modifier.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) { return coding.system === utils_1.FHIR_EXTENSION.Claim.procedureModifier.url; })) === null || _b === void 0 ? void 0 : _b.code; }).join(', ')) || '',
            // pointerA: false, // ?
            // pointerB: false, // ?
            charges: ((_j = item.unitPrice) === null || _j === void 0 ? void 0 : _j.value) || 0,
            units: ((_k = item.quantity) === null || _k === void 0 ? void 0 : _k.value) || 0,
            // epsdt: false, // ?
            // provider: '', // ?
        });
    });
    // 28
    var totalCharge = (_11 = claim === null || claim === void 0 ? void 0 : claim.total) === null || _11 === void 0 ? void 0 : _11.value;
    // 29
    var patientPaid = (_14 = (_13 = (_12 = claim === null || claim === void 0 ? void 0 : claim.extension) === null || _12 === void 0 ? void 0 : _12.find(function (extension) { return extension.url === utils_1.FHIR_EXTENSION.Claim.patientPaid.url; })) === null || _13 === void 0 ? void 0 : _13.valueMoney) === null || _14 === void 0 ? void 0 : _14.value;
    return {
        conditionRelatedToEmployment: conditionRelatedToEmployment,
        conditionRelatedToAutoAccident: conditionRelatedToAutoAccident,
        autoAccidentState: autoAccidentState,
        conditionRelatedToOtherAccident: conditionRelatedToOtherAccident,
        conditionRelatedToMixed: conditionRelatedToMixed,
        claimCode1: claimCode1,
        claimCode2: claimCode2,
        claimCode3: claimCode3,
        claimCodes: claimCodes,
        dateOfIllness: dateOfIllness,
        unableToWork: unableToWork,
        unableToWorkString: unableToWorkString,
        hospitalizationDates: hospitalizationDates,
        hospitalizationDatesString: hospitalizationDatesString,
        resubmissionCode: resubmissionCode,
        priorAuthNumber: priorAuthNumber,
        diagnoses: diagnoses,
        diagnosesComment: diagnosesComment,
        facilityId: facilityId,
        billingItems: billingItems,
        totalCharge: totalCharge,
        patientPaid: patientPaid,
    };
};
exports.getClaimData = getClaimData;
var createAccidentCodingByCode = function (code) { return ({
    code: code,
    system: utils_1.FHIR_EXTENSION.Claim.v3_ActCode.url,
}); };
var mapAdditionalInformationToClaimResource = function (claim, additionalInformation) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    var claimCopy = structuredClone(claim);
    // 10a-c
    if (additionalInformation.relatedToEmployment ||
        additionalInformation.relatedToAutoAccident ||
        additionalInformation.relatedToOtherAccident) {
        var claimAccident = { date: '', type: { coding: [] } };
        if (additionalInformation.relatedToEmployment) {
            claimAccident.type.coding.push(createAccidentCodingByCode('WPA'));
        }
        if (additionalInformation.relatedToAutoAccident) {
            claimAccident.type.coding.push(createAccidentCodingByCode('MVA'));
            claimAccident.locationAddress = { state: additionalInformation.relatedToAutoAccident };
        }
        if (additionalInformation.relatedToOtherAccident) {
            claimAccident.type.coding.push(createAccidentCodingByCode(undefined));
        }
        claimCopy.accident = claimAccident;
    }
    else {
        claimCopy.accident = undefined;
    }
    // 10d
    var claimCodes = additionalInformation.claimCodes
        .trim()
        .split(' ')
        .filter(function (c) { return c; })
        .slice(0, 3);
    claimCopy.extension = __spreadArray(__spreadArray([], (claimCopy.extension || []).filter(function (extension) { return extension.url !== utils_1.FHIR_EXTENSION.Claim.claimConditionCode.url; }), true), claimCodes.map(function (code) { return ({ url: utils_1.FHIR_EXTENSION.Claim.claimConditionCode.url, valueString: code }); }), true);
    if (claimCopy.extension.length === 0) {
        claimCopy.extension = undefined;
    }
    // 14
    if (additionalInformation.illness) {
        var illnessSupportingInfo_1 = {
            timingDate: ((_a = additionalInformation.illness) === null || _a === void 0 ? void 0 : _a.toISO()) || undefined,
            category: { coding: [{ system: utils_1.FHIR_EXTENSION.Claim.claimInformationCategory.url, code: 'onset' }] },
        };
        var changed_1 = false;
        claimCopy.supportingInfo = (_b = claimCopy.supportingInfo) === null || _b === void 0 ? void 0 : _b.map(function (supportingInfo) {
            if (isSupportingInfo(supportingInfo, 'onset')) {
                changed_1 = true;
                return __assign(__assign({}, supportingInfo), illnessSupportingInfo_1);
            }
            else {
                return supportingInfo;
            }
        });
        if (!changed_1) {
            claimCopy.supportingInfo = __spreadArray(__spreadArray([], (claimCopy.supportingInfo || []), true), [
                __assign(__assign({}, illnessSupportingInfo_1), { sequence: 2 }),
            ], false);
        }
    }
    else {
        claimCopy.supportingInfo = (_c = claimCopy.supportingInfo) === null || _c === void 0 ? void 0 : _c.filter(function (supportingInfo) { return !isSupportingInfo(supportingInfo, 'onset'); });
    }
    // 16
    if (additionalInformation.unableToWork[0] && additionalInformation.unableToWork[1]) {
        var unableToWorkSupportingInfo_1 = {
            timingPeriod: {
                start: ((_d = additionalInformation.unableToWork[0]) === null || _d === void 0 ? void 0 : _d.toISO()) || undefined,
                end: ((_e = additionalInformation.unableToWork[1]) === null || _e === void 0 ? void 0 : _e.toISO()) || undefined,
            },
            category: { coding: [{ system: utils_1.FHIR_EXTENSION.Claim.claimInformationCategory.url, code: 'employmentimpacted' }] },
        };
        var changed_2 = false;
        claimCopy.supportingInfo = (_f = claimCopy.supportingInfo) === null || _f === void 0 ? void 0 : _f.map(function (supportingInfo) {
            if (isSupportingInfo(supportingInfo, 'employmentimpacted')) {
                changed_2 = true;
                return __assign(__assign({}, supportingInfo), unableToWorkSupportingInfo_1);
            }
            else {
                return supportingInfo;
            }
        });
        if (!changed_2) {
            claimCopy.supportingInfo = __spreadArray(__spreadArray([], (claimCopy.supportingInfo || []), true), [
                __assign(__assign({}, unableToWorkSupportingInfo_1), { sequence: 3 }),
            ], false);
        }
    }
    else {
        claimCopy.supportingInfo = (_g = claimCopy.supportingInfo) === null || _g === void 0 ? void 0 : _g.filter(function (supportingInfo) { return !isSupportingInfo(supportingInfo, 'employmentimpacted'); });
    }
    // 18
    if (additionalInformation.hospitalization[0] && additionalInformation.hospitalization[1]) {
        var hospitalizationSupportingInfo_1 = {
            timingPeriod: {
                start: ((_h = additionalInformation.hospitalization[0]) === null || _h === void 0 ? void 0 : _h.toISO()) || undefined,
                end: ((_j = additionalInformation.hospitalization[1]) === null || _j === void 0 ? void 0 : _j.toISO()) || undefined,
            },
            category: { coding: [{ system: utils_1.FHIR_EXTENSION.Claim.claimInformationCategory.url, code: 'hospitalized' }] },
        };
        var changed_3 = false;
        claimCopy.supportingInfo = (_k = claimCopy.supportingInfo) === null || _k === void 0 ? void 0 : _k.map(function (supportingInfo) {
            if (isSupportingInfo(supportingInfo, 'hospitalized')) {
                changed_3 = true;
                return __assign(__assign({}, supportingInfo), hospitalizationSupportingInfo_1);
            }
            else {
                return supportingInfo;
            }
        });
        if (!changed_3) {
            claimCopy.supportingInfo = __spreadArray(__spreadArray([], (claimCopy.supportingInfo || []), true), [
                __assign(__assign({}, hospitalizationSupportingInfo_1), { sequence: 4 }),
            ], false);
        }
    }
    else {
        claimCopy.supportingInfo = (_l = claimCopy.supportingInfo) === null || _l === void 0 ? void 0 : _l.filter(function (supportingInfo) { return !isSupportingInfo(supportingInfo, 'hospitalized'); });
    }
    // 22
    if (additionalInformation.resubmissionCode) {
        claimCopy.related = (_m = claimCopy.related) === null || _m === void 0 ? void 0 : _m.map(function (related, index) {
            var _a, _b, _c, _d, _e;
            return index === 0
                ? __assign(__assign({}, related), { relationship: __assign(__assign({}, related.relationship), { coding: ((_b = (_a = related.relationship) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (coding) { return coding.system === utils_1.FHIR_EXTENSION.Claim.resubmissionRelationship.url; }))
                            ? (_d = (_c = related.relationship) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d.map(function (coding) {
                                return coding.system === utils_1.FHIR_EXTENSION.Claim.resubmissionRelationship.url
                                    ? __assign(__assign({}, coding), { code: additionalInformation.resubmissionCode }) : coding;
                            })
                            : __spreadArray(__spreadArray([], (((_e = related.relationship) === null || _e === void 0 ? void 0 : _e.coding) || []), true), [
                                {
                                    system: utils_1.FHIR_EXTENSION.Claim.resubmissionRelationship.url,
                                    code: additionalInformation.resubmissionCode,
                                },
                            ], false) }) }) : related;
        });
    }
    else {
        claimCopy.related = (_o = claimCopy.related) === null || _o === void 0 ? void 0 : _o.map(function (related, index) {
            var _a, _b;
            return index === 0
                ? __assign(__assign({}, related), { relationship: __assign(__assign({}, related.relationship), { coding: (_b = (_a = related.relationship) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.filter(function (coding) { return coding.system !== utils_1.FHIR_EXTENSION.Claim.resubmissionRelationship.url; }) }) }) : related;
        });
    }
    // 23
    claimCopy.insurance = claimCopy.insurance.map(function (insurance, index) {
        return index === 0
            ? __assign(__assign({}, insurance), { preAuthRef: additionalInformation.authorizationNumber
                    ? [additionalInformation.authorizationNumber]
                    : undefined }) : insurance;
    });
    return claimCopy;
};
exports.mapAdditionalInformationToClaimResource = mapAdditionalInformationToClaimResource;
var mapDiagnosesToClaimResource = function (claim, diagnoses) {
    var claimCopy = structuredClone(claim);
    claimCopy.extension = __spreadArray(__spreadArray([], (claimCopy.extension || []).filter(function (extension) { return extension.url !== utils_1.FHIR_EXTENSION.Claim.claimDiagnosesComment.url; }), true), (diagnoses.comment.trim()
        ? [{ url: utils_1.FHIR_EXTENSION.Claim.claimDiagnosesComment.url, valueString: diagnoses.comment.trim() }]
        : []), true);
    if (claimCopy.extension.length === 0) {
        claimCopy.extension = undefined;
    }
    claimCopy.diagnosis = diagnoses.items.map(function (item, index) { return ({
        sequence: index + 1,
        diagnosisCodeableConcept: {
            coding: [
                {
                    code: item === null || item === void 0 ? void 0 : item.code,
                    display: item === null || item === void 0 ? void 0 : item.display,
                },
            ],
        },
    }); });
    if (claimCopy.diagnosis.length === 0) {
        claimCopy.diagnosis = undefined;
    }
    return claimCopy;
};
exports.mapDiagnosesToClaimResource = mapDiagnosesToClaimResource;
var mapBillingToClaimResource = function (claim, billing) {
    var _a, _b, _c;
    var claimCopy = structuredClone(claim);
    if (isNaN(billing.payment)) {
        claimCopy.extension = (_a = claimCopy.extension) === null || _a === void 0 ? void 0 : _a.filter(function (extension) { return extension.url !== utils_1.FHIR_EXTENSION.Claim.patientPaid.url; });
    }
    else {
        var paymentExtension_1 = { url: utils_1.FHIR_EXTENSION.Claim.patientPaid.url, valueMoney: { value: billing.payment } };
        var changed_4 = false;
        claimCopy.extension = (_b = claimCopy.extension) === null || _b === void 0 ? void 0 : _b.map(function (extension) {
            if (extension.url === utils_1.FHIR_EXTENSION.Claim.patientPaid.url) {
                changed_4 = true;
                return paymentExtension_1;
            }
            return extension;
        });
        if (!changed_4) {
            claimCopy.extension = __spreadArray(__spreadArray([], (claimCopy.extension || []), true), [paymentExtension_1], false);
        }
    }
    if (((_c = claimCopy.extension) === null || _c === void 0 ? void 0 : _c.length) === 0) {
        claimCopy.extension = undefined;
    }
    if (billing.items.length === 0) {
        claimCopy.total = { value: 0 };
        claimCopy.item = undefined;
    }
    else {
        claimCopy.total = {
            value: billing.items.reduce(function (prev, curr) {
                prev += curr.charges;
                return prev;
            }, 0),
        };
        claimCopy.item = billing.items.map(function (item, index) {
            var _a, _b;
            return ({
                sequence: index + 1,
                productOrService: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: item.code }] },
                servicedPeriod: {
                    start: ((_a = item.date[0]) === null || _a === void 0 ? void 0 : _a.toISO()) || undefined,
                    end: ((_b = item.date[1]) === null || _b === void 0 ? void 0 : _b.toISO()) || undefined,
                },
                revenue: item.emergency
                    ? { coding: [{ system: utils_1.FHIR_EXTENSION.Claim.revenueCode.url, coding: '1001' }] }
                    : undefined,
                unitPrice: { value: item.charges },
                quantity: { value: item.units },
                modifier: item.modifiers.split(', ').length > 0
                    ? item.modifiers
                        .split(', ')
                        .map(function (modifier) { return ({ coding: [{ system: utils_1.FHIR_EXTENSION.Claim.procedureModifier.url, code: modifier }] }); })
                    : undefined,
            });
        });
    }
    return claimCopy;
};
exports.mapBillingToClaimResource = mapBillingToClaimResource;
var mapSLBProviderToClaimResource = function (claim, slbProvider) {
    var _a, _b, _c;
    var claimCopy = structuredClone(claim);
    if ((_a = slbProvider.location) === null || _a === void 0 ? void 0 : _a.id) {
        claimCopy.facility = { reference: "Location/".concat(slbProvider.location.id) };
    }
    if ((_c = (_b = slbProvider.location) === null || _b === void 0 ? void 0 : _b.managingOrganization) === null || _c === void 0 ? void 0 : _c.reference) {
        claimCopy.provider = { reference: slbProvider.location.managingOrganization.reference };
    }
    return claimCopy;
};
exports.mapSLBProviderToClaimResource = mapSLBProviderToClaimResource;
//# sourceMappingURL=claim.helper.js.map