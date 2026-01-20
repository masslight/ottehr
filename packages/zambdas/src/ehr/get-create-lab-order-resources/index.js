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
var helpers_1 = require("../../shared/helpers");
var labs_1 = require("../shared/labs");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'get-create-lab-order-resources';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, patientId, testItemSearch, secrets, labOrgIdsString, oystehr, _a, accounts, coverages, labOrgsGUIDs, orderingLocationDetails, coverageInfo, labs, response, error_1, ENVIRONMENT;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 5, , 6]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                patientId = validatedParameters.patientId, testItemSearch = validatedParameters.search, secrets = validatedParameters.secrets, labOrgIdsString = validatedParameters.labOrgIdsString;
                console.log('search passed', testItemSearch);
                console.groupEnd();
                console.debug('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _b.sent();
                oystehr = (0, helpers_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, getResources(oystehr, patientId, testItemSearch, labOrgIdsString)];
            case 2:
                _a = _b.sent(), accounts = _a.accounts, coverages = _a.coverages, labOrgsGUIDs = _a.labOrgsGUIDs, orderingLocationDetails = _a.orderingLocationDetails;
                coverageInfo = void 0;
                if (patientId) {
                    coverageInfo = getCoverageInfo(accounts, coverages);
                }
                labs = [];
                if (!testItemSearch) return [3 /*break*/, 4];
                return [4 /*yield*/, getLabs(labOrgsGUIDs, testItemSearch, m2mToken)];
            case 3:
                labs = _b.sent();
                _b.label = 4;
            case 4:
                response = __assign({ coverages: coverageInfo, labs: labs }, orderingLocationDetails);
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 5:
                error_1 = _b.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('admin-get-create-lab-order-resources', error_1, ENVIRONMENT)];
            case 6: return [2 /*return*/];
        }
    });
}); });
var getResources = function (oystehr, patientId, testItemSearch, labOrgIdsString) { return __awaiter(void 0, void 0, void 0, function () {
    var requests, coverageSearchRequest, accountSearchRequest, organizationSearchRequest, orderingLocationsRequest, searchResults, resources, coverages, accounts, organizations, labOrgsGUIDs, orderingLocations, orderingLocationIds;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                requests = [];
                if (patientId) {
                    coverageSearchRequest = {
                        method: 'GET',
                        url: "/Coverage?patient=Patient/".concat(patientId, "&status=active"),
                    };
                    accountSearchRequest = {
                        method: 'GET',
                        url: "/Account?subject=Patient/".concat(patientId, "&status=active"),
                    };
                    requests.push(coverageSearchRequest, accountSearchRequest);
                }
                if (testItemSearch) {
                    organizationSearchRequest = {
                        method: 'GET',
                        url: "/Organization?type=".concat(utils_1.LAB_ORG_TYPE_CODING.system, "|").concat(utils_1.LAB_ORG_TYPE_CODING.code).concat(labOrgIdsString ? "&_id=".concat(labOrgIdsString) : ''),
                    };
                    requests.push(organizationSearchRequest);
                }
                orderingLocationsRequest = {
                    method: 'GET',
                    url: "/Location?status=active&identifier=".concat(utils_1.LAB_ACCOUNT_NUMBER_SYSTEM, "|"),
                };
                requests.push(orderingLocationsRequest);
                return [4 /*yield*/, oystehr.fhir.batch({
                        requests: requests,
                    })];
            case 1:
                searchResults = _a.sent();
                resources = (0, utils_1.flattenBundleResources)(searchResults);
                coverages = [];
                accounts = [];
                organizations = [];
                labOrgsGUIDs = [];
                orderingLocations = [];
                orderingLocationIds = [];
                resources.forEach(function (resource) {
                    var _a, _b, _c;
                    if (resource.resourceType === 'Organization') {
                        var fhirOrg = resource;
                        organizations.push(fhirOrg);
                        var labGuid = (_b = (_a = fhirOrg.identifier) === null || _a === void 0 ? void 0 : _a.find(function (id) { return id.system === utils_1.OYSTEHR_LAB_GUID_SYSTEM; })) === null || _b === void 0 ? void 0 : _b.value;
                        if (labGuid)
                            labOrgsGUIDs.push(labGuid);
                    }
                    if (resource.resourceType === 'Coverage')
                        coverages.push(resource);
                    if (resource.resourceType === 'Account') {
                        // todo labs team - this logic will change when we implement workers comp, but for now
                        // we will just ignore those types of accounts to restore functionality
                        if ((0, labs_1.accountIsPatientBill)(resource)) {
                            accounts.push(resource);
                        }
                    }
                    if (resource.resourceType === 'Location') {
                        var loc = resource;
                        if (loc.id &&
                            loc.identifier &&
                            loc.name &&
                            !((_c = loc.extension) === null || _c === void 0 ? void 0 : _c.some(function (ext) {
                                var _a, _b;
                                return ((_a = ext.valueCoding) === null || _a === void 0 ? void 0 : _a.code) === 'vi' &&
                                    ((_b = ext.valueCoding) === null || _b === void 0 ? void 0 : _b.system) === 'http://terminology.hl7.org/CodeSystem/location-physical-type';
                            }))) {
                            orderingLocations.push({
                                name: loc.name,
                                id: loc.id,
                                enabledLabs: loc.identifier
                                    .filter(function (id) { return id.system === utils_1.LAB_ACCOUNT_NUMBER_SYSTEM && id.value && id.assigner && id.assigner.reference; })
                                    .map(function (id) {
                                    return {
                                        accountNumber: id.value,
                                        labOrgRef: id.assigner.reference,
                                    };
                                }),
                            });
                            orderingLocationIds.push(loc.id);
                        }
                    }
                });
                return [2 /*return*/, {
                        coverages: coverages,
                        accounts: accounts,
                        labOrgsGUIDs: labOrgsGUIDs,
                        orderingLocationDetails: { orderingLocationIds: orderingLocationIds, orderingLocations: orderingLocations },
                    }];
        }
    });
}); };
var getLabs = function (labOrgsGUIDs, search, m2mToken) { return __awaiter(void 0, void 0, void 0, function () {
    var labIds, cursor, totalReturn, items, url, orderableItemsSearch, response, orderableItemRes, itemsToBeReturned;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                labIds = labOrgsGUIDs.join(',');
                cursor = '';
                totalReturn = 0;
                items = [];
                _b.label = 1;
            case 1:
                url = "".concat(utils_1.OYSTEHR_LAB_ORDERABLE_ITEM_SEARCH_API, "?labIds=").concat(labIds, "&itemNames=").concat(search, "&limit=100&cursor=").concat(cursor);
                return [4 /*yield*/, fetch(url, {
                        method: 'GET',
                        headers: {
                            Authorization: "Bearer ".concat(m2mToken),
                        },
                    })];
            case 2:
                orderableItemsSearch = _b.sent();
                if (!orderableItemsSearch.ok)
                    throw (0, utils_1.EXTERNAL_LAB_ERROR)("Failed to fetch orderable items: ".concat(orderableItemsSearch.status));
                console.log("orderable item search for search term \"".concat(search, "\""));
                return [4 /*yield*/, orderableItemsSearch.json()];
            case 3:
                response = _b.sent();
                orderableItemRes = response.orderableItems;
                if (!Array.isArray(orderableItemRes)) {
                    console.error("orderableItemRes was not an array. It was: ".concat(JSON.stringify(orderableItemRes), ". Returning no orderable items"));
                    orderableItemRes = [];
                }
                itemsToBeReturned = orderableItemRes.length;
                console.log('This is orderableItemRes len', itemsToBeReturned);
                items.push.apply(items, orderableItemRes);
                cursor = ((_a = response === null || response === void 0 ? void 0 : response.metadata) === null || _a === void 0 ? void 0 : _a.nextCursor) || '';
                totalReturn += itemsToBeReturned;
                console.log('totalReturn:', totalReturn);
                _b.label = 4;
            case 4:
                if (cursor && totalReturn <= 100) return [3 /*break*/, 1];
                _b.label = 5;
            case 5: // capping at 100 so that the zambda doesn't fail. (no one is scrolling through that many anyway)
            // if we hear no complaints about the 100 return (i highly doubt we will) we can simplify this logic by getting rid of the cursor logic
            // and the do while - the first call will only ever return 100 and i suspect thats really all we need
            return [2 /*return*/, items];
        }
    });
}); };
var getCoverageInfo = function (accounts, coverages) {
    var _a;
    if (accounts.length !== 1) {
        console.log('accounts.length', accounts.length);
        // there should only be one active account
        throw (0, utils_1.EXTERNAL_LAB_ERROR)('Please update responsible party information - patient must have one active account record to represent a guarantor to external lab orders');
    }
    var patientAccount = accounts[0];
    if (!patientAccount.guarantor) {
        throw (0, utils_1.EXTERNAL_LAB_ERROR)('Please update responsible party information - patient must have an account with a guarantor resource to external lab orders');
    }
    var isSelfPay = !((_a = patientAccount.coverage) === null || _a === void 0 ? void 0 : _a.length) ? true : false;
    var coveragesSortedByPriority = (0, labs_1.sortCoveragesByPriority)(patientAccount, coverages);
    if (!coveragesSortedByPriority && !isSelfPay) {
        throw (0, utils_1.EXTERNAL_LAB_ERROR)('Please update patient payment information - patient must have insurance or have designated self pay to external lab orders');
    }
    if (coveragesSortedByPriority) {
        var coverageInfo = coveragesSortedByPriority.map(function (coverage, idx) {
            var _a, _b;
            var coverageName = (_b = (_a = coverage.class) === null || _a === void 0 ? void 0 : _a.find(function (c) { var _a; return (_a = c.type.coding) === null || _a === void 0 ? void 0 : _a.find(function (code) { return code.system === utils_1.CODE_SYSTEM_COVERAGE_CLASS; }); })) === null || _b === void 0 ? void 0 : _b.name;
            var coverageId = coverage.id;
            if (!coverageName || !coverageId) {
                throw (0, utils_1.EXTERNAL_LAB_ERROR)("Insurance appears to be malformed, cannot reconcile insurance class name and/or coverage id: ".concat(coverageName, ", ").concat(coverageId));
            }
            if (idx === 0) {
                return { coverageName: coverageName, coverageId: coverageId, isPrimary: true };
            }
            else {
                return { coverageName: coverageName, coverageId: coverageId, isPrimary: false };
            }
        });
        return coverageInfo;
    }
    else {
        // todo labs this could change when client bill is implemented
        // empty array equates to self pay
        return [];
    }
};
