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
exports.prevalidationHandler = void 0;
var aws_serverless_1 = require("@sentry/aws-serverless");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("./helpers");
var validation_1 = require("./validation");
var prevalidationHandler = function (input, oystehrClient) { return __awaiter(void 0, void 0, void 0, function () {
    var appointmentId, primaryInsuranceData, patientId, primaryPolicyHolder, secondaryInsuranceData, secondaryPolicyHolder, apiUrl, accessToken, rps, _a, primary, secondary, primaryInsurancePlanRequirements, secondaryInsurancePlanRequirements, coverages, billingProviderData, e_1, eligibilityRequests, batchResults, requestIds, dateISO, results, eligibilityVerdicts, res;
    var _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                appointmentId = input.appointmentId, primaryInsuranceData = input.primaryInsuranceData, patientId = input.patientId, primaryPolicyHolder = input.primaryPolicyHolder, secondaryInsuranceData = input.secondaryInsuranceData, secondaryPolicyHolder = input.secondaryPolicyHolder, apiUrl = input.apiUrl, accessToken = input.accessToken;
                console.log('primary policy holder', JSON.stringify(primaryPolicyHolder), null, 2);
                rps = [];
                if (primaryPolicyHolder && primaryPolicyHolder.isPatient === false) {
                    rps.push(makeRP({ patientId: patientId, relatedPersonData: primaryPolicyHolder, id: 'primaryRP' }));
                }
                if (secondaryInsuranceData && secondaryPolicyHolder && secondaryPolicyHolder.isPatient === false) {
                    rps.push(makeRP({
                        patientId: patientId,
                        relatedPersonData: secondaryPolicyHolder,
                        id: 'secondaryRP',
                    }));
                }
                console.log('rps: ', JSON.stringify(rps));
                return [4 /*yield*/, (0, helpers_1.getInsurancePlansAndOrgs)({
                        primary: primaryInsuranceData.insuranceId,
                        secondary: secondaryInsuranceData === null || secondaryInsuranceData === void 0 ? void 0 : secondaryInsuranceData.insuranceId,
                    }, oystehrClient)];
            case 1:
                _a = _e.sent(), primary = _a[0], secondary = _a[1];
                console.log('primary and secondary insurances: ', primary, secondary);
                primaryInsurancePlanRequirements = (0, shared_1.createInsurancePlanDto)(primary);
                console.log('primaryPolicyHolder', JSON.stringify(primaryPolicyHolder, null, 2));
                (0, validation_1.validateInsuranceRequirements)({
                    insurancePlanDto: primaryInsurancePlanRequirements,
                    insuranceData: primaryInsuranceData,
                    policyHolder: primaryPolicyHolder,
                    primary: true,
                });
                if (secondary && secondaryInsuranceData && secondaryPolicyHolder) {
                    try {
                        secondaryInsurancePlanRequirements = (0, shared_1.createInsurancePlanDto)(secondary);
                        (0, validation_1.validateInsuranceRequirements)({
                            insurancePlanDto: secondaryInsurancePlanRequirements,
                            insuranceData: secondaryInsuranceData,
                            policyHolder: secondaryPolicyHolder,
                            primary: false,
                        });
                    }
                    catch (error) {
                        console.error(error);
                        (0, aws_serverless_1.captureException)(error);
                        secondaryInsurancePlanRequirements = undefined;
                    }
                }
                console.log('primary insurance plan requirements', primaryInsurancePlanRequirements);
                coverages = [
                    makeCoverage({
                        insuranceData: primaryInsuranceData,
                        patientId: patientId,
                        payor: primary,
                        policyHolder: primaryPolicyHolder,
                        relatedPerson: rps[0],
                        primary: true,
                    }),
                ];
                _e.label = 2;
            case 2:
                _e.trys.push([2, 4, , 5]);
                return [4 /*yield*/, (0, validation_1.complexBillingProviderValidation)({ primary: primary, secondary: secondary }, appointmentId !== null && appointmentId !== void 0 ? appointmentId : '', (_b = input.secrets) !== null && _b !== void 0 ? _b : null, oystehrClient)];
            case 3:
                /*
                  for some use cases it might make more sense to go fetch the billing provider data from Candid,
                  in which case a contained resource would be created and added to the eligibility requests contained resources,
                  rather than attempting to get a reference to some resource in the FHIR db here.
                */
                billingProviderData = _e.sent();
                return [3 /*break*/, 5];
            case 4:
                e_1 = _e.sent();
                console.log('error getting billing provider data', e_1);
                throw e_1;
            case 5:
                console.log('billingProviderData', JSON.stringify(billingProviderData), null, 2);
                if (secondaryInsuranceData && secondaryPolicyHolder && secondary && rps.length > 1 && billingProviderData.secondary) {
                    coverages.push(makeCoverage({
                        insuranceData: secondaryInsuranceData,
                        policyHolder: secondaryPolicyHolder,
                        patientId: patientId,
                        payor: secondary,
                        relatedPerson: rps[1],
                        primary: false,
                    }));
                }
                console.log('coverage 1', JSON.stringify(coverages[0], null, 2));
                eligibilityRequests = coverages.map(function (coverage, idx) {
                    var isPrimary = idx === 0;
                    var providerReference = '';
                    if (isPrimary) {
                        providerReference = "".concat(billingProviderData.primary.resourceType, "/").concat(billingProviderData.primary.id);
                    }
                    else if (billingProviderData.secondary) {
                        providerReference = "".concat(billingProviderData.secondary.resourceType, "/").concat(billingProviderData.secondary.id);
                    }
                    var id = isPrimary ? 'covPrimary' : 'covSecondary';
                    coverage.id = id;
                    var coverageReference = "#".concat(coverage.id);
                    var patientReference = "Patient/".concat(patientId);
                    var payorReference = "Organization/".concat(isPrimary ? primary.id : secondary.id);
                    var contained = [coverage];
                    if (rps[idx]) {
                        contained.push(rps[idx]);
                    }
                    var CER = (0, helpers_1.makeCoverageEligibilityRequest)({
                        coverageReference: coverageReference,
                        payorReference: payorReference,
                        providerReference: providerReference,
                        patientReference: patientReference,
                        contained: contained,
                    });
                    console.log('CER', JSON.stringify(CER, null, 2));
                    console.log('END CER');
                    return CER;
                });
                return [4 /*yield*/, oystehrClient.fhir.batch({
                        requests: eligibilityRequests.map(function (cer) {
                            return {
                                method: 'POST',
                                url: '/CoverageEligibilityRequest',
                                resource: cer,
                            };
                        }),
                    })];
            case 6:
                batchResults = (_e.sent());
                console.log('batchResults', JSON.stringify(batchResults, null, 2));
                requestIds = (_d = (_c = batchResults.entry) === null || _c === void 0 ? void 0 : _c.flatMap(function (e) { var _a, _b; return (_b = (_a = e === null || e === void 0 ? void 0 : e.resource) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : []; })) !== null && _d !== void 0 ? _d : [];
                dateISO = luxon_1.DateTime.now().toISO();
                if (requestIds.length < coverages.length) {
                    return [2 /*return*/, {
                            primary: { status: utils_1.InsuranceEligibilityCheckStatus.eligibilityNotChecked, dateISO: dateISO },
                            secondary: coverages.length === 2 ? { status: utils_1.InsuranceEligibilityCheckStatus.eligibilityNotChecked, dateISO: dateISO } : undefined,
                        }];
                }
                console.log('requestIds', requestIds);
                return [4 /*yield*/, Promise.allSettled(requestIds.map(function (reqId) {
                        return performEligibilityCheck(reqId, apiUrl, accessToken);
                    }))];
            case 7:
                results = _e.sent();
                console.log('results', JSON.stringify(results, null, 2));
                return [4 /*yield*/, Promise.all(results.map(function (p) { return (0, helpers_1.parseEligibilityCheckResponsePromiseResult)(p); }))];
            case 8:
                eligibilityVerdicts = _e.sent();
                console.log('eligibility verdicts', eligibilityVerdicts, results.length);
                res = { primary: eligibilityVerdicts[0] };
                if (eligibilityVerdicts.length > 1) {
                    res.secondary = eligibilityVerdicts[1];
                }
                console.log('eligibility result', JSON.stringify(res, null, 2));
                return [2 /*return*/, res];
        }
    });
}); };
exports.prevalidationHandler = prevalidationHandler;
var makeCoverage = function (input) {
    var _a;
    var insuranceData = input.insuranceData, policyHolder = input.policyHolder, patientId = input.patientId, payor = input.payor, relatedPerson = input.relatedPerson, primary = input.primary;
    var subscriber = {
        reference: '',
    };
    if (policyHolder.isPatient) {
        subscriber.reference = "Patient/".concat(patientId);
    }
    else {
        subscriber.reference = "#".concat(relatedPerson.id);
    }
    var relationship = policyHolder.relationship;
    var coverageClass;
    var insuranceIdentifierId;
    (_a = payor.identifier) === null || _a === void 0 ? void 0 : _a.forEach(function (id) {
        var _a, _b;
        (_b = (_a = id.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.forEach(function (coding) {
            if (coding.system === 'payer-id')
                insuranceIdentifierId = coding.code;
        });
    });
    if (insuranceIdentifierId) {
        coverageClass = {
            type: {
                coding: [
                    {
                        code: 'plan',
                        system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                    },
                ],
            },
            value: insuranceIdentifierId,
            name: payor.name,
        };
    }
    // const contained = [relatedPerson, insurancePlan, payor];
    return {
        resourceType: 'Coverage',
        subscriberId: insuranceData.memberId,
        subscriber: subscriber,
        payor: [
            {
                reference: "Organization/".concat(payor.id),
            },
        ],
        relationship: {
            coding: [
                {
                    system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
                    code: relationship === null || relationship === void 0 ? void 0 : relationship.toLowerCase(),
                    display: relationship,
                },
            ],
        },
        status: 'active',
        class: coverageClass ? [coverageClass] : [],
        type: { coding: [utils_1.INSURANCE_COVERAGE_CODING] },
        order: primary ? 1 : 2,
        beneficiary: { reference: "Patient/".concat(patientId) },
    };
};
var makeRP = function (input) {
    var patientId = input.patientId, data = input.relatedPersonData, id = input.id;
    var code = '';
    switch (data.relationship) {
        case 'Father':
            code = 'FTH';
            break;
        case 'Mother':
            code = 'MTH';
            break;
        case 'Parent':
            code = 'PRN';
            break;
        case 'Spouse':
            code = 'SPS';
            break;
        case 'Sibling':
            code = 'SIB';
            break;
        case 'Other':
            code = 'O';
            break;
        default:
            code = 'CHILD';
            break;
    }
    var address = [
        {
            line: data.address ? [data.address] : [],
            city: data.city,
            state: data.state,
            postalCode: data.zip,
            country: 'US',
        },
    ];
    var relatedPerson = {
        resourceType: 'RelatedPerson',
        patient: { reference: "Patient/".concat(patientId) }, // is this valid?
        id: id,
        name: (0, utils_1.createFhirHumanName)(data.firstName, data.middleName, data.lastName),
        birthDate: data.dob,
        gender: getGender(data.sex),
        address: address,
        relationship: [
            {
                coding: [
                    {
                        code: code,
                        display: data.relationship ? data.relationship : 'Child',
                        system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
                    },
                ],
            },
        ],
    };
    return relatedPerson;
};
var getGender = function (sex) {
    if (sex != undefined) {
        switch (sex.toLowerCase()) {
            case 'male':
                return 'male';
            case 'female':
                return 'female';
            case 'unknown':
                return 'unknown';
            default:
                return 'other';
        }
    }
    return 'unknown';
};
var performEligibilityCheck = function (coverageEligibilityRequestId, projectApiURL, oystehrToken) {
    return fetch("".concat(projectApiURL, "/rcm/eligibility-check"), {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            Authorization: "Bearer ".concat(oystehrToken),
        },
        body: JSON.stringify({
            eligibilityRequestId: coverageEligibilityRequestId,
        }),
    });
};
