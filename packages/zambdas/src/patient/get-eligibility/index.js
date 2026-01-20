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
exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("./helpers");
var prevalidation_handler_1 = require("./prevalidation-handler");
var validation_1 = require("./validation");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)('get-eligibility', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var primary, secondary, validatedParameters, validatedParams, secrets, apiUrl, oystehr, complexInput, result, appointmentId, appointment, patientId, billingProvider, coverageResources, coverageToCheck, coverages, insuranceOrgs, coverageToUse, payorReference, CER, coverageEligibilityRequest, projectApiURL, tagProps, eligibilityCheckResult, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 10, , 11]);
                console.group('validateRequestParameters');
                validatedParameters = void 0;
                try {
                    validatedParameters = (0, validation_1.validateRequestParameters)(input);
                }
                catch (error) {
                    console.error(error);
                    return [2 /*return*/, (0, shared_1.lambdaResponse)(400, { message: error.message })];
                }
                validatedParams = validatedParameters;
                secrets = validatedParams.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                console.log('validatedParameters', JSON.stringify(validatedParameters));
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrToken = _a.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _a.label = 3;
            case 3:
                console.group('createOystehrClient');
                apiUrl = (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets);
                oystehr = (0, utils_1.createOystehrClient)(oystehrToken, (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, secrets), (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets));
                console.groupEnd();
                console.debug('createOystehrClient success');
                return [4 /*yield*/, (0, validation_1.complexInsuranceValidation)(validatedParams, oystehr)];
            case 4:
                complexInput = _a.sent();
                if (!(complexInput.type === 'prevalidation')) return [3 /*break*/, 6];
                console.log('prevalidation path...');
                return [4 /*yield*/, (0, prevalidation_handler_1.prevalidationHandler)(__assign(__assign({}, complexInput), { apiUrl: apiUrl, accessToken: oystehrToken, secrets: secrets }), oystehr)];
            case 5:
                result = _a.sent();
                console.log('prevalidation primary', JSON.stringify(result.primary));
                console.log('prevalidation secondary', JSON.stringify(result.secondary));
                primary = result.primary;
                secondary = result.secondary;
                return [3 /*break*/, 9];
            case 6:
                appointmentId = complexInput.appointmentId, appointment = complexInput.appointment, patientId = complexInput.patientId, billingProvider = complexInput.billingProvider, coverageResources = complexInput.coverageResources, coverageToCheck = complexInput.coverageToCheck;
                coverages = coverageResources.coverages, insuranceOrgs = coverageResources.insuranceOrgs;
                coverageToUse = coverages[coverageToCheck];
                if (!coverageToUse) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Coverage');
                }
                payorReference = (0, helpers_1.getPayorRef)(coverageToUse, insuranceOrgs);
                if (!payorReference) {
                    throw new Error('Payor reference not found');
                }
                CER = (0, helpers_1.makeCoverageEligibilityRequest)({
                    coverageReference: "Coverage/".concat(coverageToUse.id),
                    payorReference: payorReference,
                    providerReference: billingProvider,
                    patientReference: "Patient/".concat(patientId),
                });
                return [4 /*yield*/, oystehr.fhir.create(CER)];
            case 7:
                coverageEligibilityRequest = _a.sent();
                projectApiURL = (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets);
                tagProps = void 0;
                if (appointment && appointmentId) {
                    tagProps = {
                        appointment: appointment,
                        appointmentId: appointmentId,
                        oystehr: oystehr,
                    };
                }
                console.log('coverageToCheck', coverageToCheck);
                return [4 /*yield*/, performEligibilityCheckAndReturnStatus(coverageEligibilityRequest.id, projectApiURL, tagProps)];
            case 8:
                eligibilityCheckResult = _a.sent();
                if (coverageToCheck === 'primary') {
                    primary = eligibilityCheckResult;
                    secondary = undefined;
                }
                else {
                    secondary = eligibilityCheckResult;
                    primary = undefined;
                }
                _a.label = 9;
            case 9: return [2 /*return*/, (0, shared_1.lambdaResponse)(200, { primary: primary, secondary: secondary })];
            case 10:
                error_1 = _a.sent();
                console.error(error_1, error_1.message);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('get-eligibility', error_1, ENVIRONMENT)];
            case 11: return [2 /*return*/];
        }
    });
}); });
var performEligibilityCheckAndReturnStatus = function (coverageEligibilityRequestId, projectApiURL, tagProps) { return __awaiter(void 0, void 0, void 0, function () {
    var response, now, _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                console.log('coverageEligibilityRequestId', coverageEligibilityRequestId);
                console.log('projectApiURL', projectApiURL, coverageEligibilityRequestId);
                return [4 /*yield*/, fetch("".concat(projectApiURL, "/rcm/eligibility-check"), {
                        method: 'POST',
                        headers: {
                            'content-type': 'application/json',
                            Authorization: "Bearer ".concat(oystehrToken),
                        },
                        body: JSON.stringify({
                            eligibilityRequestId: coverageEligibilityRequestId,
                        }),
                    })];
            case 1:
                response = _f.sent();
                now = new Date().toISOString();
                if (!!response.ok) return [3 /*break*/, 3];
                _b = (_a = console).error;
                _c = ['eligibility check service failure reason: '];
                _e = (_d = JSON).stringify;
                return [4 /*yield*/, response.json()];
            case 2:
                _b.apply(_a, _c.concat([_e.apply(_d, [_f.sent(), null, 2])]));
                return [2 /*return*/, { status: utils_1.InsuranceEligibilityCheckStatus.eligibilityNotChecked, dateISO: now }];
            case 3: return [2 /*return*/, checkEligibility({ eligibilityCheckResponse: response, tagProps: tagProps })];
        }
    });
}); };
var checkEligibility = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var res, _c;
    var eligibilityCheckResponse = _b.eligibilityCheckResponse, tagProps = _b.tagProps;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _c = helpers_1.parseEligibilityCheckResponsePromiseResult;
                return [4 /*yield*/, Promise.resolve({ status: 'fulfilled', value: eligibilityCheckResponse })];
            case 1: return [4 /*yield*/, _c.apply(void 0, [_d.sent()])];
            case 2:
                res = _d.sent();
                if (res.status === utils_1.InsuranceEligibilityCheckStatus.eligibilityConfirmed) {
                    return [2 /*return*/, res];
                }
                if (!(res.status === utils_1.InsuranceEligibilityCheckStatus.eligibilityCheckNotSupported)) return [3 /*break*/, 5];
                console.log('Payer does not support real-time eligibility. Bypassing.');
                if (!((tagProps === null || tagProps === void 0 ? void 0 : tagProps.appointment) && (tagProps === null || tagProps === void 0 ? void 0 : tagProps.appointmentId))) return [3 /*break*/, 4];
                return [4 /*yield*/, tagAppointmentWithEligibilityFailureReason(__assign(__assign({}, tagProps), { reason: utils_1.ELIGIBILITY_FAILED_REASONS.realTimeEligibilityUnsupported }))];
            case 3:
                _d.sent();
                _d.label = 4;
            case 4: return [2 /*return*/, res];
            case 5:
                if (!(res.status === utils_1.InsuranceEligibilityCheckStatus.eligibilityNotChecked)) return [3 /*break*/, 7];
                if (!((tagProps === null || tagProps === void 0 ? void 0 : tagProps.appointment) && (tagProps === null || tagProps === void 0 ? void 0 : tagProps.appointmentId))) return [3 /*break*/, 7];
                return [4 /*yield*/, tagAppointmentWithEligibilityFailureReason(__assign(__assign({}, tagProps), { reason: utils_1.ELIGIBILITY_FAILED_REASONS.apiFailure }))];
            case 6:
                _d.sent();
                _d.label = 7;
            case 7: return [2 /*return*/, res];
        }
    });
}); };
// todo: not sure putting a meta tag on the appointment is the best thing to do here. probably better
// to return information about the outcome and let the handler decide what to do with that information
var tagAppointmentWithEligibilityFailureReason = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var system, index;
    var _c, _d;
    var appointment = _b.appointment, appointmentId = _b.appointmentId, oystehr = _b.oystehr, reason = _b.reason;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                system = "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/").concat(utils_1.ELIGIBILITY_FAILED_REASON_META_TAG);
                index = (_d = (_c = appointment.meta) === null || _c === void 0 ? void 0 : _c.tag) === null || _d === void 0 ? void 0 : _d.findIndex(function (tag) { return tag.system === system; });
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'Appointment',
                        id: appointmentId,
                        operations: [
                            {
                                op: 'add',
                                path: "/meta/tag/".concat(index === -1 ? 0 : index),
                                value: {
                                    system: system,
                                    code: reason,
                                    display: reason,
                                },
                            },
                        ],
                    })];
            case 1:
                _e.sent();
                return [2 /*return*/];
        }
    });
}); };
