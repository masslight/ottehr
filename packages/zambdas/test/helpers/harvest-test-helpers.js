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
exports.selectSelfPayOption = exports.replaceSubscriberWithPatient = exports.replaceGuarantorWithAlternate = exports.replaceGuarantorWithPatient = exports.batchTestInsuranceWrites = exports.fillReferences = void 0;
var short_uuid_1 = require("short-uuid");
var utils_1 = require("utils");
var alt_guarantor_json_1 = require("../data/alt-guarantor.json");
var fillReferences = function (template, references) {
    var stringifiedTemplate = JSON.stringify(template);
    references.forEach(function (reference) {
        var resourceType = reference.split('/')[0];
        stringifiedTemplate = stringifiedTemplate.replace(new RegExp("{{".concat(resourceType.toUpperCase(), "_REF}}"), 'g'), reference);
    });
    return JSON.parse(stringifiedTemplate);
};
exports.fillReferences = fillReferences;
var batchTestInsuranceWrites = function (input) {
    var primary = input.primary, secondary = input.secondary, account = input.account, containedGuarantor = input.containedGuarantor, persistedGuarantor = input.persistedGuarantor, persistedGuarantorReference = input.persistedGuarantorReference;
    if (containedGuarantor && persistedGuarantor) {
        throw new Error('Cannot have both contained and persisted guarantor');
    }
    if (containedGuarantor && persistedGuarantorReference) {
        throw new Error('Cannot have both contained and persisted guarantor reference');
    }
    if (persistedGuarantor && persistedGuarantorReference) {
        throw new Error('Cannot have both persisted guarantor and persisted guarantor reference');
    }
    var primaryCoveragePostURL = primary ? "urn:uuid:".concat((0, short_uuid_1.uuid)()) : undefined;
    var secondaryCoveragePostURL = secondary ? "urn:uuid:".concat((0, short_uuid_1.uuid)()) : undefined;
    var batchRequests = [];
    if (primary) {
        var contained = primary.containedSubscriber;
        var primaryRPPostURL = contained ? '#coverageSubscriber' : "urn:uuid:".concat((0, short_uuid_1.uuid)());
        var primaryCoveragePost = {
            method: 'POST',
            fullUrl: primaryCoveragePostURL,
            url: 'Coverage',
            resource: __assign(__assign({}, primary.coverage), { subscriber: { reference: primaryRPPostURL }, id: primaryCoveragePostURL, contained: contained ? [__assign(__assign({}, primary.subscriber), { id: 'coverageSubscriber' })] : undefined, order: primary.ensureOrder ? 1 : primary.coverage.order }),
        };
        batchRequests.push(primaryCoveragePost);
        if (!contained) {
            var primaryRPPost = {
                resource: primary.subscriber,
                method: 'POST',
                url: primary.subscriber.resourceType,
                fullUrl: primaryRPPostURL,
            };
            batchRequests.push(primaryRPPost);
        }
    }
    if (secondary) {
        var contained = secondary.containedSubscriber;
        var secondaryRPPostURL = contained ? '#coverageSubscriber' : "urn:uuid:".concat((0, short_uuid_1.uuid)());
        var secondaryCoveragePost = {
            method: 'POST',
            fullUrl: secondaryCoveragePostURL,
            url: 'Coverage',
            resource: __assign(__assign({}, secondary.coverage), { subscriber: { reference: secondaryRPPostURL }, id: secondaryCoveragePostURL, contained: contained ? [__assign(__assign({}, secondary.subscriber), { id: 'coverageSubscriber' })] : undefined, order: secondary.ensureOrder ? 2 : secondary.coverage.order }),
        };
        batchRequests.push(secondaryCoveragePost);
        if (!contained) {
            var secondaryRPPost = {
                resource: secondary.subscriber,
                method: 'POST',
                url: secondary.subscriber.resourceType,
                fullUrl: secondaryRPPostURL,
            };
            batchRequests.push(secondaryRPPost);
        }
    }
    if (account) {
        var coverage = secondaryCoveragePostURL || primaryCoveragePostURL ? [] : undefined;
        if (coverage !== undefined) {
            if (primaryCoveragePostURL) {
                coverage.push({ coverage: { reference: primaryCoveragePostURL }, priority: 1 });
            }
            if (secondaryCoveragePostURL) {
                coverage.push({ coverage: { reference: secondaryCoveragePostURL }, priority: 2 });
            }
        }
        var accountToPost = __assign(__assign({}, account), { coverage: coverage });
        if (containedGuarantor) {
            accountToPost.contained = [containedGuarantor];
            accountToPost.guarantor = [{ party: { reference: "#".concat(containedGuarantor.id) } }];
        }
        else if (persistedGuarantor) {
            var guarantorPostUrl = "urn:uuid:".concat((0, short_uuid_1.uuid)());
            batchRequests.push({
                method: 'POST',
                resource: persistedGuarantor,
                url: persistedGuarantor.resourceType,
                fullUrl: guarantorPostUrl,
            });
            accountToPost.guarantor = [{ party: { reference: guarantorPostUrl } }];
        }
        else if (persistedGuarantorReference) {
            accountToPost.guarantor = [{ party: { reference: persistedGuarantorReference } }];
        }
        var accountPost = {
            method: 'POST',
            resource: accountToPost,
            url: 'Account',
        };
        batchRequests.push(accountPost);
    }
    return batchRequests;
};
exports.batchTestInsuranceWrites = batchTestInsuranceWrites;
var replaceGuarantorWithPatient = function (item) {
    return item.map(function (i) {
        var _a;
        if (i.linkId === 'responsible-party-page') {
            return __assign(__assign({}, i), { item: (0, exports.replaceGuarantorWithPatient)((_a = i.item) !== null && _a !== void 0 ? _a : []) });
        }
        if (i.linkId === 'responsible-party-relationship') {
            return __assign(__assign({}, i), { answer: [{ valueString: 'Self' }] });
        }
        return i;
    });
};
exports.replaceGuarantorWithPatient = replaceGuarantorWithPatient;
var replaceGuarantorWithAlternate = function (item, parameterized) {
    return __spreadArray([], item.map(function (i) {
        if (i.linkId === 'responsible-party-page') {
            return parameterized !== null && parameterized !== void 0 ? parameterized : alt_guarantor_json_1.default;
        }
        return i;
    }), true);
};
exports.replaceGuarantorWithAlternate = replaceGuarantorWithAlternate;
var replaceSubscriberWithPatient = function (item, options) {
    return item.map(function (i) {
        var _a;
        if (i.linkId === 'payment-option-page' || i.linkId === 'secondary-insurance') {
            return __assign(__assign({}, i), { item: (0, exports.replaceSubscriberWithPatient)((_a = i.item) !== null && _a !== void 0 ? _a : [], options) });
        }
        if (i.linkId === 'patient-relationship-to-insured-2' && options.secondary) {
            return __assign(__assign({}, i), { answer: [{ valueString: 'Self' }] });
        }
        if (i.linkId === 'patient-relationship-to-insured' && options.primary) {
            return __assign(__assign({}, i), { answer: [{ valueString: 'Self' }] });
        }
        return i;
    });
};
exports.replaceSubscriberWithPatient = replaceSubscriberWithPatient;
var selectSelfPayOption = function (qr) {
    var _a;
    var copy = __assign({}, qr);
    var paymentPageIndex = (_a = copy.item) === null || _a === void 0 ? void 0 : _a.findIndex(function (item) { return item.linkId === 'payment-option-page'; });
    copy.item[paymentPageIndex].item = [
        {
            linkId: 'payment-option',
            answer: [
                {
                    valueString: utils_1.SELF_PAY_OPTION,
                },
            ],
        },
        {
            linkId: 'insurance-carrier',
        },
        {
            linkId: 'insurance-member-id',
        },
        {
            linkId: 'policy-holder-first-name',
        },
        {
            linkId: 'policy-holder-middle-name',
        },
        {
            linkId: 'policy-holder-last-name',
        },
        {
            linkId: 'policy-holder-date-of-birth',
        },
        {
            linkId: 'policy-holder-birth-sex',
        },
        {
            linkId: 'policy-holder-address-as-patient',
        },
        {
            linkId: 'policy-holder-address',
        },
        {
            linkId: 'policy-holder-address-additional-line',
        },
        {
            linkId: 'policy-holder-city',
        },
        {
            linkId: 'policy-holder-state',
        },
        {
            linkId: 'policy-holder-zip',
        },
        {
            linkId: 'patient-relationship-to-insured',
        },
        {
            linkId: 'insurance-card-front',
        },
        {
            linkId: 'insurance-card-back',
        },
        {
            linkId: 'insurance-eligibility-verification-status',
        },
        {
            linkId: 'display-secondary-insurance',
        },
        {
            linkId: 'secondary-insurance',
        },
    ];
    return copy;
};
exports.selectSelfPayOption = selectSelfPayOption;
