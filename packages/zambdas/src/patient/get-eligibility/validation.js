"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultBillingProviderResource = exports.complexBillingProviderValidation = exports.validateInsuranceRequirements = exports.complexInsuranceValidation = void 0;
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
var harvest_1 = require("../../ehr/shared/harvest");
function validateRequestParameters(input) {
    var _a;
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var _b = JSON.parse(input.body), appointmentId = _b.appointmentId, patientId = _b.patientId, coveragePrevalidationInput = _b.coveragePrevalidationInput, billingProvider = _b.billingProvider, coverageToCheck = _b.coverageToCheck;
    if (appointmentId && !(0, utils_1.isValidUUID)(appointmentId)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('Parameter "appointmentId" must be a valid UUID.');
    }
    if (!patientId || !(0, utils_1.isValidUUID)(patientId)) {
        console.error('Invalid patientId', patientId);
        throw (0, utils_1.INVALID_INPUT_ERROR)('Parameter "patientId" must be included in input body and be a valid UUID.');
    }
    if (billingProvider && typeof billingProvider !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('Parameter "billingProvider" must be a string.');
    }
    var _c = (_a = billingProvider === null || billingProvider === void 0 ? void 0 : billingProvider.split('/')) !== null && _a !== void 0 ? _a : [], billingProviderType = _c[0], billingProviderId = _c[1];
    if (billingProvider && (!billingProviderType || !billingProviderId)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('Parameter "billingProvider" must be a valid FHIR reference.');
    }
    if (billingProvider && !(0, utils_1.isValidUUID)(billingProviderId)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('Parameter "billingProvider" must be a valid FHIR reference.');
    }
    if (billingProvider && ['Practitioner', 'Location', 'Organization'].includes(billingProviderType) === false) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('Parameter "billingProvider" must be a valid FHIR reference of type Practitioner, Location, or Organization.');
    }
    if (coveragePrevalidationInput !== undefined) {
        var responseItems = coveragePrevalidationInput.responseItems;
        if (responseItems === undefined) {
            throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['prevalidationInput.responseItems']);
        }
        if (responseItems !== undefined && (!Array.isArray(responseItems) || typeof responseItems[0] !== 'object')) {
            throw (0, utils_1.INVALID_INPUT_ERROR)('Parameter "prevalidationInput.responseItems" must be an array of objects when included');
        }
        if (responseItems) {
            return {
                type: 'prevalidation',
                appointmentId: appointmentId,
                patientId: patientId,
                secrets: input.secrets,
                responseItems: responseItems,
            };
        }
    }
    if (coverageToCheck === undefined || (coverageToCheck !== 'primary' && coverageToCheck !== 'secondary')) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('Parameter "coverageToCheck" is required and must be either "primary" or "secondary".');
    }
    return {
        type: 'standard',
        appointmentId: appointmentId,
        coverageToCheck: coverageToCheck,
        patientId: patientId,
        billingProvider: billingProvider,
        secrets: input.secrets,
    };
}
var complexInsuranceValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var appointmentId, patientId, appointment, appointmentResource, responseItems, primaryPolicyHolder, primaryInsuranceData, secondaryInsuranceItem, secondaryPolicyHolder, secondaryInsuranceData, maybeBillingProvider, coverageToCheck, billingProvider, coverageResources;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                appointmentId = input.appointmentId, patientId = input.patientId;
                if (!appointmentId) return [3 /*break*/, 2];
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Appointment',
                        id: appointmentId,
                    })];
            case 1:
                appointmentResource = _c.sent();
                if (appointmentResource) {
                    appointment = appointmentResource;
                }
                else {
                    throw utils_1.APIErrorCode.APPOINTMENT_NOT_FOUND;
                }
                _c.label = 2;
            case 2:
                if (!(input.type === 'prevalidation')) return [3 /*break*/, 3];
                responseItems = input.responseItems;
                primaryPolicyHolder = mapResponseItemsToInsurancePolicyHolder(responseItems);
                primaryInsuranceData = mapResponseItemsToInsuranceData(responseItems);
                secondaryInsuranceItem = responseItems.find(function (item) { return item.linkId === 'secondary-insurance'; });
                secondaryPolicyHolder = void 0;
                secondaryInsuranceData = void 0;
                if (secondaryInsuranceItem !== undefined) {
                    try {
                        secondaryPolicyHolder = mapResponseItemsToInsurancePolicyHolder((_a = secondaryInsuranceItem === null || secondaryInsuranceItem === void 0 ? void 0 : secondaryInsuranceItem.item) !== null && _a !== void 0 ? _a : [], '-2');
                        secondaryInsuranceData = mapResponseItemsToInsuranceData((_b = secondaryInsuranceItem.item) !== null && _b !== void 0 ? _b : [], '-2');
                    }
                    catch (e) {
                        console.error('Error parsing secondary insurance data', e);
                        secondaryPolicyHolder = undefined;
                        secondaryInsuranceData = undefined;
                    }
                }
                console.log('primaryPolicyHolder', JSON.stringify(primaryPolicyHolder));
                console.log('primaryInsuranceData', JSON.stringify(primaryInsuranceData));
                return [2 /*return*/, {
                        type: 'prevalidation',
                        appointmentId: appointmentId,
                        patientId: patientId,
                        primaryInsuranceData: primaryInsuranceData,
                        primaryPolicyHolder: primaryPolicyHolder,
                        secondaryInsuranceData: secondaryInsuranceData,
                        secondaryPolicyHolder: secondaryPolicyHolder,
                        appointment: appointment,
                    }];
            case 3:
                maybeBillingProvider = input.billingProvider, coverageToCheck = input.coverageToCheck;
                return [4 /*yield*/, resolveBillingProviderReference(maybeBillingProvider, oystehr, input.secrets)];
            case 4:
                billingProvider = _c.sent();
                return [4 /*yield*/, (0, harvest_1.getAccountAndCoverageResourcesForPatient)(patientId, oystehr)];
            case 5:
                coverageResources = _c.sent();
                return [2 /*return*/, {
                        type: 'standard',
                        appointmentId: appointmentId,
                        patientId: patientId,
                        billingProvider: billingProvider,
                        coverageResources: coverageResources,
                        appointment: appointment,
                        coverageToCheck: coverageToCheck,
                    }];
        }
    });
}); };
exports.complexInsuranceValidation = complexInsuranceValidation;
var validateInsuranceRequirements = function (_a) {
    var insurancePlanDto = _a.insurancePlanDto, insuranceData = _a.insuranceData, policyHolder = _a.policyHolder, primary = _a.primary;
    var prefix = function (letter) {
        if (!primary)
            return "Secondary ".concat(letter.toLowerCase());
        return letter;
    };
    console.log('insurance plan policy holder', JSON.stringify(policyHolder));
    if (insurancePlanDto.requiresSubscriberId && !insuranceData.memberId) {
        throw new Error("".concat(prefix('M'), "ember ID was not provided."));
    }
    if (insurancePlanDto.requiresSubscriberName && (!policyHolder.firstName || !policyHolder.lastName)) {
        throw new Error("".concat(prefix('P'), "olicy holder's first or last name was not provided."));
    }
    if (insurancePlanDto.requiresSubscriberDOB && !policyHolder.dob) {
        throw new Error("".concat(prefix('P'), "olicy holder's date of birth was not provided."));
    }
    if (insurancePlanDto.requiresRelationshipToSubscriber && !policyHolder.relationship) {
        throw new Error("".concat(prefix('P'), "olicy holder's relationship to the insured was not provided."));
    }
};
exports.validateInsuranceRequirements = validateInsuranceRequirements;
var mapResponseItemsToInsuranceData = function (items, suffix) {
    if (suffix === void 0) { suffix = ''; }
    var insuranceId, memberId;
    var requiredFields = new Set(["insurance-member-id".concat(suffix), "insurance-carrier".concat(suffix)]);
    (0, utils_1.flattenItems)(items).forEach(function (i) {
        var _a, _b, _c, _d, _e, _f, _g;
        requiredFields.delete(i.linkId);
        if (i.linkId === "insurance-member-id".concat(suffix)) {
            memberId = (_b = (_a = i.answer) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.valueString;
        }
        if (i.linkId === "insurance-carrier".concat(suffix)) {
            insuranceId = (_g = (_f = (_e = (_d = (_c = i.answer) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.valueReference) === null || _e === void 0 ? void 0 : _e.reference) === null || _f === void 0 ? void 0 : _f.split('/')) === null || _g === void 0 ? void 0 : _g[1];
        }
    });
    if (insuranceId === undefined || memberId === undefined) {
        var missingVals = Array.from(requiredFields.values()).join(', ');
        throw new Error("Could not perform eligibility check because QuestionnaireResponse page did not include the following items: ".concat(missingVals));
    }
    return {
        insuranceId: insuranceId,
        memberId: memberId,
    };
};
var mapResponseItemsToInsurancePolicyHolder = function (items, suffix) {
    if (suffix === void 0) { suffix = ''; }
    var firstName, lastName, zip, state, address, addressLine2, sex, dob, relationship;
    var isPatient = false;
    items.forEach(function (i) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
        if (i.linkId === "patient-relationship-to-insured".concat(suffix)) {
            isPatient = ((_c = (_b = (_a = i.answer) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.valueString) === null || _c === void 0 ? void 0 : _c.toLowerCase()) === 'self';
            relationship = (_e = (_d = i.answer) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.valueString;
        }
        if (i.linkId === "policy-holder-first-name".concat(suffix)) {
            firstName = (_g = (_f = i.answer) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.valueString;
        }
        if (i.linkId === "policy-holder-last-name".concat(suffix)) {
            lastName = (_j = (_h = i.answer) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.valueString;
        }
        if (i.linkId === "policy-holder-zip".concat(suffix)) {
            zip = (_l = (_k = i.answer) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.valueString;
        }
        if (i.linkId === "policy-holder-state".concat(suffix)) {
            state = (_o = (_m = i.answer) === null || _m === void 0 ? void 0 : _m[0]) === null || _o === void 0 ? void 0 : _o.valueString;
        }
        if (i.linkId === "policy-holder-address".concat(suffix)) {
            address = (_q = (_p = i.answer) === null || _p === void 0 ? void 0 : _p[0]) === null || _q === void 0 ? void 0 : _q.valueString;
        }
        if (i.linkId === "policy-holder-address-additional-line".concat(suffix)) {
            addressLine2 = (_s = (_r = i.answer) === null || _r === void 0 ? void 0 : _r[0]) === null || _s === void 0 ? void 0 : _s.valueString;
        }
        if (i.linkId === "policy-holder-birth-sex".concat(suffix)) {
            sex = (_u = (_t = i.answer) === null || _t === void 0 ? void 0 : _t[0]) === null || _u === void 0 ? void 0 : _u.valueString;
        }
        if (i.linkId === "policy-holder-dob".concat(suffix)) {
            dob = (_w = (_v = i.answer) === null || _v === void 0 ? void 0 : _v[0]) === null || _w === void 0 ? void 0 : _w.valueString;
        }
    });
    var policyHolder = {
        firstName: firstName,
        lastName: lastName,
        zip: zip,
        state: state,
        address: address,
        addressLine2: addressLine2,
        sex: sex,
        dob: dob,
        isPatient: isPatient,
        relationship: relationship,
    };
    return policyHolder;
};
var complexBillingProviderValidation = function (plans, appointmentId, secrets, oystehrClient) { return __awaiter(void 0, void 0, void 0, function () {
    var input, providerData, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                input = {
                    plans: plans,
                    secrets: secrets,
                    appointmentId: appointmentId,
                };
                _a = utils_1.getBillingProviderData;
                _b = [input];
                return [4 /*yield*/, (0, exports.getDefaultBillingProviderResource)(secrets, oystehrClient)];
            case 1: return [4 /*yield*/, _a.apply(void 0, _b.concat([_c.sent()]))];
            case 2:
                providerData = _c.sent();
                if (providerData === undefined) {
                    throw utils_1.APIErrorCode.MISSING_BILLING_PROVIDER_DETAILS;
                }
                return [2 /*return*/, providerData];
        }
    });
}); };
exports.complexBillingProviderValidation = complexBillingProviderValidation;
var getDefaultBillingProviderResource = function (secrets, oystehrClient) { return __awaiter(void 0, void 0, void 0, function () {
    var defaultBillingResource, defaultBillingResourceType, defaultBillingResourceId, fetchedResources, billingResource;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                defaultBillingResource = (0, utils_1.getSecret)(utils_1.SecretsKeys.DEFAULT_BILLING_RESOURCE, secrets);
                if (!defaultBillingResource) {
                    throw utils_1.BILLING_PROVIDER_RESOURCE_NOT_FOUND;
                }
                defaultBillingResourceType = defaultBillingResource.split('/')[0];
                defaultBillingResourceId = defaultBillingResource.split('/')[1];
                if (defaultBillingResourceType === undefined || defaultBillingResourceId === undefined) {
                    throw utils_1.BILLING_PROVIDER_RESOURCE_NOT_FOUND;
                }
                return [4 /*yield*/, oystehrClient.fhir.search({
                        resourceType: defaultBillingResourceType,
                        params: [
                            {
                                name: '_id',
                                value: defaultBillingResourceId,
                            },
                        ],
                    })];
            case 1:
                fetchedResources = _a.sent();
                billingResource = fetchedResources === null || fetchedResources === void 0 ? void 0 : fetchedResources.unbundle()[0];
                if (!billingResource) {
                    throw utils_1.BILLING_PROVIDER_RESOURCE_NOT_FOUND;
                }
                return [2 /*return*/, billingResource];
        }
    });
}); };
exports.getDefaultBillingProviderResource = getDefaultBillingProviderResource;
var resolveBillingProviderReference = function (providedProviderRef, oystehr, secrets) { return __awaiter(void 0, void 0, void 0, function () {
    var defaultProvider;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!(providedProviderRef === undefined)) return [3 /*break*/, 2];
                return [4 /*yield*/, (0, exports.getDefaultBillingProviderResource)(secrets, oystehr)];
            case 1:
                defaultProvider = _a.sent();
                return [2 /*return*/, "".concat(defaultProvider.resourceType, "/").concat(defaultProvider === null || defaultProvider === void 0 ? void 0 : defaultProvider.id)];
            case 2: return [2 /*return*/, providedProviderRef];
        }
    });
}); };
