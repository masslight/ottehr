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
exports.createSearchUrlFromReference = createSearchUrlFromReference;
exports.addCoverageAndRelatedResourcesToPackages = addCoverageAndRelatedResourcesToPackages;
exports.addInsuranceToResultPackages = addInsuranceToResultPackages;
var utils_1 = require("utils");
var helpers_1 = require("../../../shared/appointment/helpers");
function createSearchUrlFromReference(inputReference) {
    var parsedReference = inputReference.split('/');
    var resourceType = parsedReference[0];
    var id = parsedReference[1];
    return "".concat(resourceType, "?_id=").concat(id);
}
function addCoverageAndRelatedResourcesToPackages(oystehr, packages) {
    return __awaiter(this, void 0, void 0, function () {
        var appointmentIdToResourcesRefsMap, requests, batchResponse;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    appointmentIdToResourcesRefsMap = {};
                    requests = [];
                    packages.forEach(function (pkg) {
                        var _a, _b, _c;
                        if (pkg.appointment && pkg.appointment.id) {
                            var resourcesRefs = (0, helpers_1.getInsuranceRelatedRefsFromAppointmentExtension)(pkg.appointment);
                            // console.log('all resources refs: ', JSON.stringify(resourcesRefs));
                            appointmentIdToResourcesRefsMap[pkg.appointment.id] = resourcesRefs;
                            var paymentReconciliationRef = (_c = (_b = (_a = pkg.chargeItem) === null || _a === void 0 ? void 0 : _a.supportingInformation) === null || _b === void 0 ? void 0 : _b.find(function (info) { return info.type === 'PaymentReconciliation'; })) === null || _c === void 0 ? void 0 : _c.reference;
                            if (paymentReconciliationRef)
                                requests.push(createSearchUrlFromReference(paymentReconciliationRef));
                            if (resourcesRefs.primaryCoverage)
                                requests.push(createSearchUrlFromReference(resourcesRefs.primaryCoverage));
                            if (resourcesRefs.primaryCoverageEligibilityResponse)
                                requests.push(createSearchUrlFromReference(resourcesRefs.primaryCoverageEligibilityResponse));
                            // This code to search all coverage resources from all fields
                            // for (const ref in resourcesRefs) {
                            //   requests.push(createSearchUrlFromReference(ref));
                            // }
                        }
                    });
                    console.log('Requests to get all coverages and related resources: ', JSON.stringify(requests));
                    return [4 /*yield*/, (0, utils_1.getResourcesFromBatchInlineRequests)(oystehr, requests)];
                case 1:
                    batchResponse = _a.sent();
                    // console.log('resources we received: ', JSON.stringify(batchResponse));
                    packages.forEach(function (pkg) {
                        var _a, _b, _c, _d, _e, _f;
                        if (pkg.appointment && pkg.appointment.id) {
                            var resourcesRefs = appointmentIdToResourcesRefsMap[pkg.appointment.id];
                            var primaryCoverageId_1 = (_a = resourcesRefs.primaryCoverage) === null || _a === void 0 ? void 0 : _a.split('/')[1];
                            var primaryEligibilityResponseId_1 = (_b = resourcesRefs.primaryCoverageEligibilityResponse) === null || _b === void 0 ? void 0 : _b.split('/')[1];
                            var paymentReconciliationId_1 = (_f = (_e = (_d = (_c = pkg.chargeItem) === null || _c === void 0 ? void 0 : _c.supportingInformation) === null || _d === void 0 ? void 0 : _d.find(function (info) { return info.type === 'PaymentReconciliation'; })) === null || _e === void 0 ? void 0 : _e.reference) === null || _f === void 0 ? void 0 : _f.split('/')[1];
                            if (primaryCoverageId_1)
                                pkg.coverage = batchResponse.find(function (res) { return res.id === primaryCoverageId_1; });
                            if (primaryEligibilityResponseId_1)
                                pkg.eligibilityResponse = batchResponse.find(function (res) { return res.id === primaryEligibilityResponseId_1; });
                            if (paymentReconciliationId_1)
                                pkg.paymentReconciliation = batchResponse.find(function (res) { return res.id === paymentReconciliationId_1; });
                        }
                    });
                    return [2 /*return*/];
            }
        });
    });
}
function addInsuranceToResultPackages(oystehr, packages) {
    return __awaiter(this, void 0, void 0, function () {
        var requests, resources;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    requests = [];
                    packages.forEach(function (pkg) {
                        if (pkg.coverage)
                            requests.push("/InsurancePlan?phonetic=".concat((0, utils_1.getInsuranceNameFromCoverage)(pkg.coverage)));
                    });
                    return [4 /*yield*/, (0, utils_1.getResourcesFromBatchInlineRequests)(oystehr, requests)];
                case 1:
                    resources = _a.sent();
                    packages.forEach(function (pkg) {
                        var coverage = pkg.coverage;
                        if (coverage) {
                            console.log("Searching for ".concat((0, utils_1.getInsuranceNameFromCoverage)(coverage), " insurance"));
                            pkg.insurance = resources.find(function (res) {
                                return res.resourceType === 'InsurancePlan' && res.name === (0, utils_1.getInsuranceNameFromCoverage)(coverage);
                            });
                        }
                    });
                    return [2 /*return*/];
            }
        });
    });
}
