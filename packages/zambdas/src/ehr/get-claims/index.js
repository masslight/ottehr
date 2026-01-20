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
exports.index = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("../../shared/helpers");
var fhir_utils_1 = require("./helpers/fhir-utils");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
var ZAMBDA_NAME = 'get-claims';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, oystehr, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, validatedParameters.secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, helpers_1.createOystehrClient)(m2mToken, validatedParameters.secrets);
                // const userToken = input.headers.Authorization.replace('Bearer ', '');
                console.log('Created zapToken and fhir client');
                return [4 /*yield*/, performEffect(oystehr, validatedParameters)];
            case 2:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _a.sent();
                console.error(error_1, JSON.stringify(error_1));
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 4: return [2 /*return*/];
        }
    });
}); });
function performEffect(oystehr, validatedInput) {
    return __awaiter(this, void 0, void 0, function () {
        var packages, items;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, getPreFilteredClaimPackages(oystehr, validatedInput)];
                case 1:
                    packages = _b.sent();
                    items = [];
                    packages.forEach(function (pkg) {
                        var claim = pkg.claim, appointment = pkg.appointment, coverage = pkg.coverage, chargeItem = pkg.chargeItem, eligibilityResponse = pkg.eligibilityResponse, location = pkg.location, paymentData = pkg.paymentData, status = pkg.status, patient = pkg.patient, insurance = pkg.insurance;
                        if (claim && claim.id && appointment && location && coverage && paymentData && status && patient) {
                            items.push({
                                id: claim === null || claim === void 0 ? void 0 : claim.id,
                                appointment: appointment,
                                location: location,
                                coverage: coverage,
                                assignee: undefined,
                                claim: claim,
                                eligibilityResponse: eligibilityResponse,
                                chargeItem: chargeItem,
                                paymentData: paymentData,
                                status: status,
                                patient: patient,
                                insurancePlan: insurance,
                            });
                        }
                    });
                    return [2 /*return*/, {
                            items: items,
                            offset: (_a = validatedInput.offset) !== null && _a !== void 0 ? _a : 0,
                            count: items.length,
                        }];
            }
        });
    });
}
function getPreFilteredClaimPackages(oystehr, validatedInput) {
    return __awaiter(this, void 0, void 0, function () {
        var offset, pageSize, claimId, visitId, patient, teamMember, facility, facilityGroup, insurance, dosFrom, dosTo, queue, status, dayInQueue, query, resources, resultPackages;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    offset = validatedInput.offset, pageSize = validatedInput.pageSize, claimId = validatedInput.claimId, visitId = validatedInput.visitId, patient = validatedInput.patient, teamMember = validatedInput.teamMember, facility = validatedInput.facility, facilityGroup = validatedInput.facilityGroup, insurance = validatedInput.insurance, dosFrom = validatedInput.dosFrom, dosTo = validatedInput.dosTo, queue = validatedInput.queue, status = validatedInput.status, dayInQueue = validatedInput.dayInQueue;
                    console.time('track-all');
                    console.log('Getting first set of resources');
                    query = "/Claim?_include=Claim:encounter&_include=Claim:patient&_include:iterate=Encounter:appointment&_revinclude:iterate=ChargeItem:context&_include=Claim:facility";
                    if (pageSize)
                        query = query.concat("&_count=".concat(pageSize));
                    if (offset)
                        query = query.concat("&_offset=".concat(offset));
                    if (patient)
                        query = query.concat("&patient=".concat(patient)); // id
                    if (claimId)
                        query = query.concat("&_id=".concat(claimId));
                    if (visitId)
                        query = query.concat("&encounter.appointment=".concat(visitId));
                    if (teamMember)
                        query = query.concat("&enterer=".concat(teamMember));
                    if (facility)
                        query = query.concat("&facility=".concat(facility));
                    if (facilityGroup)
                        query = query.concat("&facility.organization=".concat(facilityGroup));
                    if (dosFrom)
                        query = query.concat("&encounter.date=ge".concat(dosFrom));
                    if (dosTo)
                        query = query.concat("&encounter.date=le".concat(dosTo));
                    if (queue)
                        query = query.concat("&_tag=".concat(queue));
                    if (status)
                        query = query.concat("&_tag=".concat(status));
                    console.log('Query before searching resources: ', query);
                    return [4 /*yield*/, (0, utils_1.getResourcesFromBatchInlineRequests)(oystehr, [query])];
                case 1:
                    resources = _a.sent();
                    console.log('Parsing claim resources into claims packages');
                    resultPackages = parseResourcesIntoClaimPackages(resources);
                    console.log('Getting coverage and related resources to packages async');
                    return [4 /*yield*/, (0, fhir_utils_1.addCoverageAndRelatedResourcesToPackages)(oystehr, resultPackages)];
                case 2:
                    _a.sent();
                    console.log('Add payment status to packages');
                    addPaymentStatusToPackages(resultPackages);
                    // console.log('Filter by balance');
                    // if (balance) {
                    //   resultPackages = resultPackages.filter((pkg) => (pkg.claim?.total?.value ?? 0) > balance);
                    // }
                    console.log('Filter by insurance name');
                    if (insurance) {
                        // here we are filtering claims packages by insurance name,
                        // coverage resource contains insurance name in class.name property
                        resultPackages = resultPackages.filter(function (pkg) { return pkg.coverage && (0, utils_1.getInsuranceNameFromCoverage)(pkg.coverage) === insurance; });
                    }
                    console.log('Filter by day in queue');
                    if (dayInQueue) {
                        console.log('Adding day in queue to packages');
                        addDayInQueueToClaimPackages(resultPackages);
                        console.log('Filtering');
                        resultPackages = resultPackages.filter(function (pkg) { return pkg.daysInQueue === dayInQueue; });
                    }
                    // todo: think about making pagination at the end, after we processed all resources and getting as much as we need
                    return [4 /*yield*/, (0, fhir_utils_1.addInsuranceToResultPackages)(oystehr, resultPackages)];
                case 3:
                    // todo: think about making pagination at the end, after we processed all resources and getting as much as we need
                    _a.sent();
                    console.timeEnd('track-all');
                    return [2 /*return*/, resultPackages];
            }
        });
    });
}
function addPaymentStatusToPackages(packages) {
    packages.forEach(function (pkg) {
        var _a;
        var payment = pkg.paymentReconciliation;
        if (payment) {
            console.log("PaymentReconciliation: ".concat(payment.id, " for appointment: ").concat((_a = pkg.appointment) === null || _a === void 0 ? void 0 : _a.id));
            if (payment.status === 'active' && payment.outcome === 'complete' && payment.disposition !== 'authorized') {
                // it's a pending charge here, according to Roberts words
                pkg.paymentData = { paymentStatus: 'pending' };
            }
            else if (payment.status === 'active' &&
                payment.outcome === 'complete' &&
                payment.disposition === 'authorized') {
                // fully paid
                // cSpell:disable-next pully :(
                pkg.paymentData = { paymentStatus: 'pully paid' };
            }
            else if (payment.status === 'cancelled' && payment.outcome === 'complete') {
                // refunded
                pkg.paymentData = { paymentStatus: 'refunded' };
            }
        }
        else {
            // not paid
            pkg.paymentData = { paymentStatus: 'not paid' };
        }
    });
}
function getClaimStatusFromTag(claim) {
    var _a, _b, _c;
    var status = (_c = (_b = (_a = claim.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.system === 'current-status'; })) === null || _c === void 0 ? void 0 : _c.code;
    if (status && utils_1.ClaimsQueueItemStatuses.find(function (el) { return el === status; }))
        return status;
    return 'open';
}
function getClaimDaysInQueue(claim) {
    var _a, _b, _c, _d, _e;
    var queueHistoryExtension = (_a = claim.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === 'queue-history'; });
    var lastQueueElement = (_b = queueHistoryExtension === null || queueHistoryExtension === void 0 ? void 0 : queueHistoryExtension.extension) === null || _b === void 0 ? void 0 : _b[queueHistoryExtension.extension.length - 1];
    var lastQueueRecordStartTimeIso = (_e = (_d = (_c = lastQueueElement === null || lastQueueElement === void 0 ? void 0 : lastQueueElement.extension) === null || _c === void 0 ? void 0 : _c.find(function (ext) { return ext.url === 'period'; })) === null || _d === void 0 ? void 0 : _d.valuePeriod) === null || _e === void 0 ? void 0 : _e.start;
    if (lastQueueRecordStartTimeIso) {
        var lastRecordStart = luxon_1.DateTime.fromISO(lastQueueRecordStartTimeIso);
        return luxon_1.DateTime.now().diff(lastRecordStart, 'days').days;
    }
    return 0;
}
function addDayInQueueToClaimPackages(packages) {
    packages.forEach(function (pkg) {
        if (pkg.claim)
            pkg.daysInQueue = getClaimDaysInQueue(pkg.claim);
    });
}
function parseResourcesIntoClaimPackages(resources) {
    var resultPackages = [];
    var claims = resources.filter(function (res) { return res.resourceType === 'Claim'; });
    claims.forEach(function (claim) {
        var _a;
        var appointment;
        var chargeItem;
        var location;
        var encounter = resources.find(function (res) {
            var _a;
            return res.resourceType === 'Encounter' &&
                ((_a = claim.item) === null || _a === void 0 ? void 0 : _a.find(function (item) { var _a; return (_a = item.encounter) === null || _a === void 0 ? void 0 : _a.find(function (enc) { return enc.reference === (0, utils_1.createReference)(res).reference; }); }));
        });
        if ((_a = claim.facility) === null || _a === void 0 ? void 0 : _a.reference)
            location = resources.find(function (res) { var _a; return ((_a = claim.facility) === null || _a === void 0 ? void 0 : _a.reference) === (0, utils_1.createReference)(res).reference; });
        if (encounter) {
            appointment = resources.find(function (res) { var _a; return (_a = encounter.appointment) === null || _a === void 0 ? void 0 : _a.find(function (appt) { return appt.reference === (0, utils_1.createReference)(res).reference; }); });
            chargeItem = resources.find(function (res) {
                var _a;
                return res.resourceType === 'ChargeItem' &&
                    ((_a = res.context) === null || _a === void 0 ? void 0 : _a.reference) === (0, utils_1.createReference)(encounter).reference;
            });
        }
        var patient = resources.find(function (res) { return res.resourceType === 'Patient' && claim.patient.reference === (0, utils_1.createReference)(res).reference; });
        var status = getClaimStatusFromTag(claim);
        resultPackages.push({
            claim: claim,
            appointment: appointment,
            chargeItem: chargeItem,
            location: location,
            status: status,
            patient: patient,
        });
    });
    return resultPackages;
}
