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
var sdk_1 = require("@oystehr/sdk");
var fs = require("fs");
var utils_1 = require("utils");
var shared_1 = require("../shared");
var helpers_1 = require("./helpers");
var PAYER_ID_SYSTEM = 'payer-id';
function getPayerOrganizations(oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var currentIndex, total, result, bundledResponse, unbundled;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    currentIndex = 0;
                    total = 1;
                    result = [];
                    _a.label = 1;
                case 1:
                    if (!(currentIndex < total)) return [3 /*break*/, 3];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Organization',
                            params: [
                                {
                                    name: 'type',
                                    value: "".concat(utils_1.ORG_TYPE_CODE_SYSTEM, "|").concat(utils_1.ORG_TYPE_PAYER_CODE),
                                },
                                {
                                    name: '_offset',
                                    value: currentIndex,
                                },
                                {
                                    name: '_count',
                                    value: 1000,
                                },
                                {
                                    name: '_total',
                                    value: 'accurate',
                                },
                            ],
                        })];
                case 2:
                    bundledResponse = _a.sent();
                    total = bundledResponse.total || 0;
                    unbundled = bundledResponse.unbundle();
                    result.push.apply(result, unbundled);
                    currentIndex += unbundled.length;
                    return [3 /*break*/, 1];
                case 3:
                    console.log('Found', result.length, 'organizations');
                    return [2 /*return*/, result];
            }
        });
    });
}
function fixOrganizations(oystehr, organizations) {
    return __awaiter(this, void 0, void 0, function () {
        var codeCount, _i, organizations_1, org, payerIdentifier, code, duplicateCount, uniqueOrgIds, organizationsToDelete, _a, _b, _c, code, orgs, orgsWithoutCoverage, orgsWithCoverage, _d, orgs_1, org, eligibilityIdentifier, eligibilityPayerId, allCoverageResources, totalResources, _e, _f, coverage, beneficiary, patientName, orgToKeep, _loop_1, i, _g, organizationsToDelete_1, orgId, organizationIdsArray, deletionResults;
        var _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
        return __generator(this, function (_t) {
            switch (_t.label) {
                case 0:
                    codeCount = new Map();
                    for (_i = 0, organizations_1 = organizations; _i < organizations_1.length; _i++) {
                        org = organizations_1[_i];
                        payerIdentifier = (_h = org.identifier) === null || _h === void 0 ? void 0 : _h.find(function (id) { var _a, _b; return (_b = (_a = id.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.system === PAYER_ID_SYSTEM; }); });
                        if (payerIdentifier) {
                            code = (_l = (_k = (_j = payerIdentifier.type) === null || _j === void 0 ? void 0 : _j.coding) === null || _k === void 0 ? void 0 : _k.find(function (coding) { return coding.system === PAYER_ID_SYSTEM; })) === null || _l === void 0 ? void 0 : _l.code;
                            if (code) {
                                if (!codeCount.has(code)) {
                                    codeCount.set(code, []);
                                }
                                codeCount.get(code).push(org);
                            }
                        }
                    }
                    // Find and print duplicates
                    console.log('\n=== Duplicate Organizations ===');
                    duplicateCount = 0;
                    uniqueOrgIds = new Set();
                    organizationsToDelete = new Set();
                    _a = 0, _b = codeCount.entries();
                    _t.label = 1;
                case 1:
                    if (!(_a < _b.length)) return [3 /*break*/, 15];
                    _c = _b[_a], code = _c[0], orgs = _c[1];
                    if (!(orgs.length > 1)) return [3 /*break*/, 14];
                    duplicateCount++;
                    console.log("\nDuplicate Payer ID: \"".concat(code, "\" (").concat(orgs.length, " occurrences)"));
                    orgsWithoutCoverage = [];
                    orgsWithCoverage = [];
                    _d = 0, orgs_1 = orgs;
                    _t.label = 2;
                case 2:
                    if (!(_d < orgs_1.length)) return [3 /*break*/, 10];
                    org = orgs_1[_d];
                    // Add organization ID to the set for unique count
                    if (org.id) {
                        uniqueOrgIds.add(org.id);
                    }
                    eligibilityIdentifier = (_m = org.identifier) === null || _m === void 0 ? void 0 : _m.find(function (id) {
                        var _a, _b;
                        return (_b = (_a = id.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.code === 'XX' && coding.system === 'http://terminology.hl7.org/CodeSystem/v2-0203'; });
                    });
                    eligibilityPayerId = (eligibilityIdentifier === null || eligibilityIdentifier === void 0 ? void 0 : eligibilityIdentifier.value) || 'N/A';
                    console.log("  - ID: ".concat(org.id, ", Name: ").concat(org.name || 'N/A', ", Code: ").concat(code, ", Eligibility Payer ID: ").concat(eligibilityPayerId));
                    return [4 /*yield*/, findAllCoverageResources(oystehr, org)];
                case 3:
                    allCoverageResources = _t.sent();
                    totalResources = allCoverageResources.coverages.length +
                        allCoverageResources.eligibilityRequests.length +
                        allCoverageResources.eligibilityResponses.length;
                    if (!(totalResources > 0)) return [3 /*break*/, 8];
                    console.log("      Found ".concat(totalResources, " total coverage-related resource(s) for organization ").concat(org.id, " (").concat(org.name || 'N/A', ")"));
                    console.log("        - ".concat(allCoverageResources.coverages.length, " Coverage resources"));
                    console.log("        - ".concat(allCoverageResources.eligibilityRequests.length, " CoverageEligibilityRequest resources"));
                    console.log("        - ".concat(allCoverageResources.eligibilityResponses.length, " CoverageEligibilityResponse resources"));
                    _e = 0, _f = allCoverageResources.coverages;
                    _t.label = 4;
                case 4:
                    if (!(_e < _f.length)) return [3 /*break*/, 7];
                    coverage = _f[_e];
                    return [4 /*yield*/, findBeneficiaryPatient(oystehr, coverage)];
                case 5:
                    beneficiary = _t.sent();
                    if (beneficiary && beneficiary.id) {
                        patientName = "".concat(((_q = (_p = (_o = beneficiary.name) === null || _o === void 0 ? void 0 : _o[0]) === null || _p === void 0 ? void 0 : _p.given) === null || _q === void 0 ? void 0 : _q.join(' ')) || '', " ").concat(((_s = (_r = beneficiary.name) === null || _r === void 0 ? void 0 : _r[0]) === null || _s === void 0 ? void 0 : _s.family) || '').trim() ||
                            'N/A';
                        console.log("           Coverage Beneficiary ID: ".concat(beneficiary.id, ", Name: ").concat(patientName));
                    }
                    _t.label = 6;
                case 6:
                    _e++;
                    return [3 /*break*/, 4];
                case 7:
                    orgsWithCoverage.push({ org: org, resources: allCoverageResources });
                    return [3 /*break*/, 9];
                case 8:
                    console.log("      No coverage-related resources found for organization ".concat(org.id));
                    orgsWithoutCoverage.push(org);
                    _t.label = 9;
                case 9:
                    _d++;
                    return [3 /*break*/, 2];
                case 10:
                    orgToKeep = orgs[0];
                    console.log("\n      \uD83D\uDEE1\uFE0F  Keeping organization: ".concat(orgToKeep.id, " (").concat(orgToKeep.name || 'N/A', ")"));
                    _loop_1 = function (i) {
                        var orgToTransferFrom, resourcesFromDuplicate, _u, coverages, eligibilityRequests, eligibilityResponses, _v, coverages_1, coverage, success, _w, eligibilityRequests_1, request, success, _x, eligibilityResponses_1, response, success;
                        return __generator(this, function (_y) {
                            switch (_y.label) {
                                case 0:
                                    orgToTransferFrom = orgs[i];
                                    console.log("\n      \uD83D\uDCCB Transferring resources from ".concat(orgToTransferFrom.id, " to ").concat(orgToKeep.id, "..."));
                                    resourcesFromDuplicate = orgsWithCoverage.find(function (item) { return item.org.id === orgToTransferFrom.id; });
                                    if (!resourcesFromDuplicate) return [3 /*break*/, 12];
                                    _u = resourcesFromDuplicate.resources, coverages = _u.coverages, eligibilityRequests = _u.eligibilityRequests, eligibilityResponses = _u.eligibilityResponses;
                                    if (!(coverages.length > 0)) return [3 /*break*/, 4];
                                    console.log("        Updating ".concat(coverages.length, " Coverage resources..."));
                                    _v = 0, coverages_1 = coverages;
                                    _y.label = 1;
                                case 1:
                                    if (!(_v < coverages_1.length)) return [3 /*break*/, 4];
                                    coverage = coverages_1[_v];
                                    return [4 /*yield*/, updateCoverageOrganization(oystehr, coverage, orgToKeep)];
                                case 2:
                                    success = _y.sent();
                                    if (success) {
                                        console.log("          \u2705 Updated Coverage ".concat(coverage.id));
                                    }
                                    else {
                                        console.log("          \u274C Failed to update Coverage ".concat(coverage.id));
                                    }
                                    _y.label = 3;
                                case 3:
                                    _v++;
                                    return [3 /*break*/, 1];
                                case 4:
                                    if (!(eligibilityRequests.length > 0)) return [3 /*break*/, 8];
                                    console.log("        Updating ".concat(eligibilityRequests.length, " CoverageEligibilityRequest resources..."));
                                    _w = 0, eligibilityRequests_1 = eligibilityRequests;
                                    _y.label = 5;
                                case 5:
                                    if (!(_w < eligibilityRequests_1.length)) return [3 /*break*/, 8];
                                    request = eligibilityRequests_1[_w];
                                    return [4 /*yield*/, updateCoverageEligibilityRequest(oystehr, request, orgToKeep)];
                                case 6:
                                    success = _y.sent();
                                    if (success) {
                                        console.log("          \u2705 Updated CoverageEligibilityRequest ".concat(request.id));
                                    }
                                    else {
                                        console.log("          \u274C Failed to update CoverageEligibilityRequest ".concat(request.id));
                                    }
                                    _y.label = 7;
                                case 7:
                                    _w++;
                                    return [3 /*break*/, 5];
                                case 8:
                                    if (!(eligibilityResponses.length > 0)) return [3 /*break*/, 12];
                                    console.log("        Updating ".concat(eligibilityResponses.length, " CoverageEligibilityResponse resources..."));
                                    _x = 0, eligibilityResponses_1 = eligibilityResponses;
                                    _y.label = 9;
                                case 9:
                                    if (!(_x < eligibilityResponses_1.length)) return [3 /*break*/, 12];
                                    response = eligibilityResponses_1[_x];
                                    return [4 /*yield*/, updateCoverageEligibilityResponse(oystehr, response, orgToKeep)];
                                case 10:
                                    success = _y.sent();
                                    if (success) {
                                        console.log("          \u2705 Updated CoverageEligibilityResponse ".concat(response.id));
                                    }
                                    else {
                                        console.log("          \u274C Failed to update CoverageEligibilityResponse ".concat(response.id));
                                    }
                                    _y.label = 11;
                                case 11:
                                    _x++;
                                    return [3 /*break*/, 9];
                                case 12:
                                    // Mark duplicate organization for deletion (whether it had resources or not)
                                    if (orgToTransferFrom.id) {
                                        organizationsToDelete.add(orgToTransferFrom.id);
                                        console.log("        \uD83D\uDDD1\uFE0F Marked for deletion: ".concat(orgToTransferFrom.id, " (duplicate #").concat(i + 1, ")"));
                                    }
                                    return [2 /*return*/];
                            }
                        });
                    };
                    i = 1;
                    _t.label = 11;
                case 11:
                    if (!(i < orgs.length)) return [3 /*break*/, 14];
                    return [5 /*yield**/, _loop_1(i)];
                case 12:
                    _t.sent();
                    _t.label = 13;
                case 13:
                    i++;
                    return [3 /*break*/, 11];
                case 14:
                    _a++;
                    return [3 /*break*/, 1];
                case 15:
                    if (duplicateCount === 0) {
                        console.log('No duplicate organization Payer IDs found.');
                    }
                    else {
                        console.log("\nTotal duplicate Payer IDs found: ".concat(duplicateCount));
                        console.log("Total unique organization IDs in duplicates: ".concat(uniqueOrgIds.size));
                    }
                    // Display organizations marked for deletion
                    console.log("\n=== Organizations Marked for Deletion ===");
                    if (!(organizationsToDelete.size > 0)) return [3 /*break*/, 17];
                    console.log("Total organizations in deletion set: ".concat(organizationsToDelete.size));
                    console.log("Organization IDs to delete:");
                    for (_g = 0, organizationsToDelete_1 = organizationsToDelete; _g < organizationsToDelete_1.length; _g++) {
                        orgId = organizationsToDelete_1[_g];
                        console.log("  - ".concat(orgId));
                    }
                    // Actually delete the organizations
                    console.log("\n\uD83D\uDDD1\uFE0F Proceeding with deletion...");
                    organizationIdsArray = Array.from(organizationsToDelete);
                    return [4 /*yield*/, deleteOrganizations(oystehr, organizationIdsArray)];
                case 16:
                    deletionResults = _t.sent();
                    console.log("\n=== Final Deletion Results ===");
                    console.log("\u2705 Successfully deleted: ".concat(deletionResults.successful.length, " organizations"));
                    console.log("\u274C Failed to delete: ".concat(deletionResults.failed.length, " organizations"));
                    if (deletionResults.successful.length > 0) {
                        console.log("Successfully deleted IDs: ".concat(deletionResults.successful.join(', ')));
                    }
                    if (deletionResults.failed.length > 0) {
                        console.log("Failed to delete IDs: ".concat(deletionResults.failed.join(', ')));
                    }
                    return [3 /*break*/, 18];
                case 17:
                    console.log('No organizations meet the deletion criteria');
                    _t.label = 18;
                case 18: return [2 /*return*/];
            }
        });
    });
}
function findCoverageDetails(oystehr, organization) {
    return __awaiter(this, void 0, void 0, function () {
        var bundleResponse, coverages, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!organization.id) {
                        console.log('Organization has no ID, skipping coverage search');
                        return [2 /*return*/, []];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Coverage',
                            params: [
                                {
                                    name: 'payor',
                                    value: "Organization/".concat(organization.id),
                                },
                                {
                                    name: '_count',
                                    value: 10,
                                },
                            ],
                        })];
                case 2:
                    bundleResponse = _a.sent();
                    coverages = bundleResponse.unbundle();
                    return [2 /*return*/, coverages];
                case 3:
                    error_1 = _a.sent();
                    console.log("Error searching for coverage for organization ".concat(organization.id, ": ").concat(error_1));
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function findCoverageEligibilityRequests(oystehr, organization) {
    return __awaiter(this, void 0, void 0, function () {
        var bundleResponse, requests, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!organization.id) {
                        console.log('Organization has no ID, skipping CoverageEligibilityRequest search');
                        return [2 /*return*/, []];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'CoverageEligibilityRequest',
                            params: [
                                {
                                    name: 'insurer',
                                    value: "Organization/".concat(organization.id),
                                },
                                {
                                    name: '_count',
                                    value: 10,
                                },
                            ],
                        })];
                case 2:
                    bundleResponse = _a.sent();
                    requests = bundleResponse.unbundle();
                    console.log("Found ".concat(requests.length, " CoverageEligibilityRequest(s) for organization ").concat(organization.id, " (").concat(organization.name || 'N/A', ")"));
                    return [2 /*return*/, requests];
                case 3:
                    error_2 = _a.sent();
                    console.log("Error searching for CoverageEligibilityRequest for organization ".concat(organization.id, ": ").concat(error_2));
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function findCoverageEligibilityResponses(oystehr, organization) {
    return __awaiter(this, void 0, void 0, function () {
        var bundleResponse, responses, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!organization.id) {
                        console.log('Organization has no ID, skipping CoverageEligibilityResponse search');
                        return [2 /*return*/, []];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'CoverageEligibilityResponse',
                            params: [
                                {
                                    name: 'insurer',
                                    value: "Organization/".concat(organization.id),
                                },
                                {
                                    name: '_count',
                                    value: 10,
                                },
                            ],
                        })];
                case 2:
                    bundleResponse = _a.sent();
                    responses = bundleResponse.unbundle();
                    console.log("Found ".concat(responses.length, " CoverageEligibilityResponse(s) for organization ").concat(organization.id, " (").concat(organization.name || 'N/A', ")"));
                    return [2 /*return*/, responses];
                case 3:
                    error_3 = _a.sent();
                    console.log("Error searching for CoverageEligibilityResponse for organization ".concat(organization.id, ": ").concat(error_3));
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function deleteOrganization(oystehr, organizationId) {
    return __awaiter(this, void 0, void 0, function () {
        var error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    console.log("Deleting organization with ID: ".concat(organizationId, "..."));
                    return [4 /*yield*/, oystehr.fhir.delete({
                            resourceType: 'Organization',
                            id: organizationId,
                        })];
                case 1:
                    _a.sent();
                    console.log("Successfully deleted organization ID: ".concat(organizationId));
                    return [2 /*return*/, true];
                case 2:
                    error_4 = _a.sent();
                    console.error("Failed to delete organization ID: ".concat(organizationId, ". Error: ").concat(error_4));
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function deleteOrganizations(oystehr, organizationIds) {
    return __awaiter(this, void 0, void 0, function () {
        var results, _i, organizationIds_1, id, success;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    results = { successful: [], failed: [] };
                    console.log("\nAttempting to delete ".concat(organizationIds.length, " organizations..."));
                    _i = 0, organizationIds_1 = organizationIds;
                    _a.label = 1;
                case 1:
                    if (!(_i < organizationIds_1.length)) return [3 /*break*/, 4];
                    id = organizationIds_1[_i];
                    return [4 /*yield*/, deleteOrganization(oystehr, id)];
                case 2:
                    success = _a.sent();
                    if (success) {
                        results.successful.push(id);
                    }
                    else {
                        results.failed.push(id);
                    }
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    console.log("\n=== Deletion Summary ===");
                    console.log("Successfully deleted: ".concat(results.successful.length, " organizations"));
                    console.log("Failed to delete: ".concat(results.failed.length, " organizations"));
                    if (results.failed.length > 0) {
                        console.log("Failed IDs: ".concat(results.failed.join(', ')));
                    }
                    return [2 /*return*/, results];
            }
        });
    });
}
function findAllCoverageResources(oystehr, organization) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, coverages, eligibilityRequests, eligibilityResponses, error_5;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!organization.id) {
                        console.log('Organization has no ID, skipping all coverage resource searches');
                        return [2 /*return*/, {
                                coverages: [],
                                eligibilityRequests: [],
                                eligibilityResponses: [],
                            }];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.all([
                            findCoverageDetails(oystehr, organization),
                            findCoverageEligibilityRequests(oystehr, organization),
                            findCoverageEligibilityResponses(oystehr, organization),
                        ])];
                case 2:
                    _a = _b.sent(), coverages = _a[0], eligibilityRequests = _a[1], eligibilityResponses = _a[2];
                    return [2 /*return*/, {
                            coverages: coverages,
                            eligibilityRequests: eligibilityRequests,
                            eligibilityResponses: eligibilityResponses,
                        }];
                case 3:
                    error_5 = _b.sent();
                    console.log("Error searching for coverage resources for organization ".concat(organization.id, ": ").concat(error_5));
                    return [2 /*return*/, {
                            coverages: [],
                            eligibilityRequests: [],
                            eligibilityResponses: [],
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function findBeneficiaryPatient(oystehr, coverage) {
    return __awaiter(this, void 0, void 0, function () {
        var patientReference, patientId, patient, error_6;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!((_a = coverage.beneficiary) === null || _a === void 0 ? void 0 : _a.reference)) {
                        console.log("Coverage ".concat(coverage.id, " has no beneficiary reference"));
                        return [2 /*return*/, null];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    patientReference = coverage.beneficiary.reference;
                    patientId = patientReference.replace('Patient/', '');
                    if (!patientId) {
                        console.log("Invalid patient reference format: ".concat(patientReference));
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Patient',
                            id: patientId,
                        })];
                case 2:
                    patient = _b.sent();
                    return [2 /*return*/, patient];
                case 3:
                    error_6 = _b.sent();
                    console.log("Error finding beneficiary patient for coverage ".concat(coverage.id, ": ").concat(error_6));
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function updateCoverageOrganization(oystehr, coverage, newPayorOrganization) {
    return __awaiter(this, void 0, void 0, function () {
        var payerIdentifier, payerId, newPayorReference, updatedCoverage, _i, _a, identifier, hasMBCode, _b, _c, coverageClass, hasPlanType, error_7;
        var _d, _e, _f, _g, _h, _j, _k, _l;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0:
                    if (!coverage.id) {
                        console.log('Coverage has no ID, cannot update');
                        return [2 /*return*/, false];
                    }
                    if (!newPayorOrganization.id) {
                        console.log('New payor organization has no ID, cannot update coverage');
                        return [2 /*return*/, false];
                    }
                    _m.label = 1;
                case 1:
                    _m.trys.push([1, 3, , 4]);
                    console.log("Updating coverage ".concat(coverage.id, " to use payor organization ").concat(newPayorOrganization.id));
                    payerIdentifier = (_d = newPayorOrganization.identifier) === null || _d === void 0 ? void 0 : _d.find(function (id) { var _a, _b; return (_b = (_a = id.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.system === PAYER_ID_SYSTEM; }); });
                    payerId = (_g = (_f = (_e = payerIdentifier === null || payerIdentifier === void 0 ? void 0 : payerIdentifier.type) === null || _e === void 0 ? void 0 : _e.coding) === null || _f === void 0 ? void 0 : _f.find(function (coding) { return coding.system === PAYER_ID_SYSTEM; })) === null || _g === void 0 ? void 0 : _g.code;
                    newPayorReference = {
                        reference: "Organization/".concat(newPayorOrganization.id),
                        display: newPayorOrganization.name || undefined,
                    };
                    updatedCoverage = __assign(__assign({}, coverage), { payor: [newPayorReference] });
                    // Find and update the identifier with system http://terminology.hl7.org/CodeSystem/v2-0203 and code MB
                    if (updatedCoverage.identifier) {
                        for (_i = 0, _a = updatedCoverage.identifier; _i < _a.length; _i++) {
                            identifier = _a[_i];
                            hasMBCode = (_j = (_h = identifier.type) === null || _h === void 0 ? void 0 : _h.coding) === null || _j === void 0 ? void 0 : _j.some(function (coding) { return coding.system === 'http://terminology.hl7.org/CodeSystem/v2-0203' && coding.code === 'MB'; });
                            if (hasMBCode) {
                                // Update the assigner reference to the new payor organization
                                identifier.assigner = {
                                    reference: "Organization/".concat(newPayorOrganization.id),
                                    display: newPayorOrganization.name || undefined,
                                };
                                console.log("  Updated MB identifier assigner to organization ".concat(newPayorOrganization.id));
                                break; // Assuming there's only one MB identifier
                            }
                        }
                    }
                    // Find and update the coverage class with "plan" type
                    if (updatedCoverage.class) {
                        for (_b = 0, _c = updatedCoverage.class; _b < _c.length; _b++) {
                            coverageClass = _c[_b];
                            hasPlanType = (_l = (_k = coverageClass.type) === null || _k === void 0 ? void 0 : _k.coding) === null || _l === void 0 ? void 0 : _l.some(function (coding) { return coding.system === 'http://terminology.hl7.org/CodeSystem/coverage-class' && coding.code === 'plan'; });
                            if (hasPlanType) {
                                // Update the class value to the organization's payor-id and name to org's name
                                coverageClass.value = payerId || newPayorOrganization.id || '';
                                coverageClass.name = newPayorOrganization.name || undefined;
                                console.log("  Updated plan class value to ".concat(coverageClass.value, " and name to ").concat(coverageClass.name));
                                break; // Assuming there's only one plan class
                            }
                        }
                    }
                    // Update the coverage resource
                    return [4 /*yield*/, oystehr.fhir.update(updatedCoverage)];
                case 2:
                    // Update the coverage resource
                    _m.sent();
                    console.log("\u2705 Successfully updated coverage ".concat(coverage.id, " payor, MB identifier assigner, and plan class to organization ").concat(newPayorOrganization.id, " (").concat(newPayorOrganization.name || 'N/A', ")"));
                    return [2 /*return*/, true];
                case 3:
                    error_7 = _m.sent();
                    console.error("\u274C Error updating coverage ".concat(coverage.id, " payor: ").concat(error_7));
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function updateCoverageEligibilityResponse(oystehr, eligibilityResponse, newInsurerOrganization) {
    return __awaiter(this, void 0, void 0, function () {
        var newInsurerReference, updatedEligibilityResponse, error_8;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!eligibilityResponse.id) {
                        console.log('CoverageEligibilityResponse has no ID, cannot update');
                        return [2 /*return*/, false];
                    }
                    if (!newInsurerOrganization.id) {
                        console.log('New insurer organization has no ID, cannot update CoverageEligibilityResponse');
                        return [2 /*return*/, false];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    console.log("Updating CoverageEligibilityResponse ".concat(eligibilityResponse.id, " to use insurer organization ").concat(newInsurerOrganization.id));
                    newInsurerReference = {
                        reference: "Organization/".concat(newInsurerOrganization.id),
                    };
                    updatedEligibilityResponse = __assign(__assign({}, eligibilityResponse), { insurer: newInsurerReference });
                    // Update the eligibility response resource
                    return [4 /*yield*/, oystehr.fhir.update(updatedEligibilityResponse)];
                case 2:
                    // Update the eligibility response resource
                    _a.sent();
                    return [2 /*return*/, true];
                case 3:
                    error_8 = _a.sent();
                    console.error("\u274C Error updating CoverageEligibilityResponse ".concat(eligibilityResponse.id, " insurer: ").concat(error_8));
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function updateCoverageEligibilityRequest(oystehr, eligibilityRequest, newInsurerOrganization) {
    return __awaiter(this, void 0, void 0, function () {
        var newInsurerReference, updatedEligibilityRequest, error_9;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!eligibilityRequest.id) {
                        console.log('CoverageEligibilityRequest has no ID, cannot update');
                        return [2 /*return*/, false];
                    }
                    if (!newInsurerOrganization.id) {
                        console.log('New insurer organization has no ID, cannot update CoverageEligibilityRequest');
                        return [2 /*return*/, false];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    console.log("Updating CoverageEligibilityRequest ".concat(eligibilityRequest.id, " to use insurer organization ").concat(newInsurerOrganization.id));
                    newInsurerReference = {
                        reference: "Organization/".concat(newInsurerOrganization.id),
                        display: newInsurerOrganization.name || undefined,
                    };
                    updatedEligibilityRequest = __assign(__assign({}, eligibilityRequest), { insurer: newInsurerReference });
                    // Update the eligibility request resource
                    return [4 /*yield*/, oystehr.fhir.update(updatedEligibilityRequest)];
                case 2:
                    // Update the eligibility request resource
                    _a.sent();
                    console.log("\u2705 Successfully updated CoverageEligibilityRequest ".concat(eligibilityRequest.id, " insurer to organization ").concat(newInsurerOrganization.id, " (").concat(newInsurerOrganization.name || 'N/A', ")"));
                    return [2 /*return*/, true];
                case 3:
                    error_9 = _a.sent();
                    console.error("\u274C Error updating CoverageEligibilityRequest ".concat(eligibilityRequest.id, " insurer: ").concat(error_9));
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var env, secrets, token, oystehr, organizations;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    env = process.argv[2];
                    secrets = JSON.parse(fs.readFileSync(".env/".concat(env, ".json"), 'utf8'));
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
                case 1:
                    token = _a.sent();
                    if (!token) {
                        throw new Error('❌ Failed to fetch auth token.');
                    }
                    oystehr = new sdk_1.default({
                        accessToken: token,
                        fhirApiUrl: (0, helpers_1.fhirApiUrlFromAuth0Audience)(secrets.AUTH0_AUDIENCE),
                    });
                    return [4 /*yield*/, getPayerOrganizations(oystehr)];
                case 2:
                    organizations = _a.sent();
                    return [4 /*yield*/, fixOrganizations(oystehr, organizations)];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () { return console.log('✅ Completed looking for duplicate organizations'); })
    .catch(function (error) {
    console.error(error);
    throw error;
});
