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
exports.getPayorRef = exports.parseEligibilityCheckResponsePromiseResult = exports.makeCoverageEligibilityRequest = exports.getInsurancePlansAndOrgs = void 0;
var aws_serverless_1 = require("@sentry/aws-serverless");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var getInsurancePlansAndOrgs = function (planIds, oystehrClient) { return __awaiter(void 0, void 0, void 0, function () {
    var orgs, sorted;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, oystehrClient.fhir.search({
                    resourceType: 'Organization',
                    params: [
                        {
                            name: '_id',
                            value: "".concat(planIds.primary).concat(planIds.secondary ? ",".concat(planIds.secondary) : ''),
                        },
                    ],
                })];
            case 1:
                orgs = (_a.sent()).unbundle();
                sorted = orgs.sort(function (r1, r2) {
                    if (r1.id === planIds.primary) {
                        return -1;
                    }
                    else if (r2.id === planIds.secondary) {
                        return 1;
                    }
                    return 0;
                });
                console.log('sorted', JSON.stringify(sorted, null, 2));
                return [2 /*return*/, sorted];
        }
    });
}); };
exports.getInsurancePlansAndOrgs = getInsurancePlansAndOrgs;
var makeCoverageEligibilityRequest = function (input) {
    var coverageReference = input.coverageReference, patientReference = input.patientReference, payorReference = input.payorReference, providerReference = input.providerReference, contained = input.contained;
    var today = (0, utils_1.removeTimeFromDate)(luxon_1.DateTime.now().toISO());
    var coverageEligibilityRequest = {
        resourceType: 'CoverageEligibilityRequest',
        status: 'active',
        purpose: ['benefits'],
        created: today,
        servicedDate: today,
        contained: contained,
        patient: {
            reference: patientReference,
        },
        insurer: {
            reference: payorReference,
        },
        provider: {
            reference: providerReference,
        },
        item: [
            {
                category: {
                    coding: [
                        {
                            system: 'http://terminology.oystehr.com/CodeSystem/benefit-category',
                            code: utils_1.ELIGIBILITY_BENEFIT_CODES,
                        },
                    ],
                },
            },
        ],
        insurance: [
            {
                coverage: {
                    reference: coverageReference,
                },
            },
        ],
    };
    return coverageEligibilityRequest;
};
exports.makeCoverageEligibilityRequest = makeCoverageEligibilityRequest;
var parseEligibilityCheckResponsePromiseResult = function (eligibilityCheckResponse) { return __awaiter(void 0, void 0, void 0, function () {
    var now, message, coverageResponse, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                now = luxon_1.DateTime.now().toISO();
                if (!(eligibilityCheckResponse.status === 'rejected')) return [3 /*break*/, 1];
                console.log('eligibility check service failure reason: ', JSON.stringify(eligibilityCheckResponse.reason, null, 2));
                return [2 /*return*/, { status: utils_1.InsuranceEligibilityCheckStatus.eligibilityNotChecked, dateISO: now }];
            case 1:
                if (!!eligibilityCheckResponse.value.ok) return [3 /*break*/, 3];
                return [4 /*yield*/, eligibilityCheckResponse.value.json()];
            case 2:
                message = _a.sent();
                console.log('eligibility check service failure reason: ', JSON.stringify(message, null, 2));
                return [2 /*return*/, { status: utils_1.InsuranceEligibilityCheckStatus.eligibilityNotChecked, dateISO: now }];
            case 3:
                _a.trys.push([3, 5, , 6]);
                return [4 /*yield*/, eligibilityCheckResponse.value.json()];
            case 4:
                coverageResponse = (_a.sent());
                console.log('coverageResponse: ', JSON.stringify(coverageResponse, null, 2));
                return [2 /*return*/, (0, utils_1.parseCoverageEligibilityResponse)(coverageResponse)];
            case 5:
                error_1 = _a.sent();
                console.error('API response included an error', error_1);
                (0, aws_serverless_1.captureException)(error_1);
                return [2 /*return*/, { status: utils_1.InsuranceEligibilityCheckStatus.eligibilityNotChecked, dateISO: now }];
            case 6: return [2 /*return*/];
        }
    });
}); };
exports.parseEligibilityCheckResponsePromiseResult = parseEligibilityCheckResponsePromiseResult;
var getPayorRef = function (coverage, orgs) {
    var payor = orgs.find(function (org) {
        return coverage.payor.some(function (res) {
            return res.reference === "Organization/".concat(org.id);
        });
    });
    return payor ? "Organization/".concat(payor.id) : undefined;
};
exports.getPayorRef = getPayorRef;
